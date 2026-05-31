/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';
import { Candidate, RoleQuestionMap, InterviewQuestion } from '../types';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';
const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'undefined');

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

type UserRole = 'candidate' | 'recruiter';

function getAuthErrorMessage(err: any, fallback: string) {
  const message = err?.message || fallback;
  if (/email rate limit/i.test(message)) {
    return 'Supabase email rate limit exceeded. Wait before trying again, disable email confirmation for local testing, or configure custom SMTP in Supabase Auth.';
  }
  return message;
}

class SupabaseService {
  private requireClient() {
    if (!supabase) {
      throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.');
    }
    return supabase;
  }

  isReal(): boolean {
    return isSupabaseConfigured;
  }

  async signUp(email: string, password: string, role: UserRole = 'candidate', name = '') {
    try {
      const client = this.requireClient();
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: { role, name, fullName: name }
        }
      });

      if (error) throw error;
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return { user: null, session: null, error: 'An account already exists for this email. Please log in instead.' };
      }

      if (data.user) {
        await this.upsertUserProfile(data.user.id, email, role, name);
      }

      return { user: data.user, session: data.session, error: null };
    } catch (err: any) {
      return { user: null, session: null, error: getAuthErrorMessage(err, 'Signup failed. Please check your details and try again.') };
    }
  }

  async signIn(email: string, password: string, role?: UserRole) {
    try {
      const client = this.requireClient();
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (role) {
        const metadataRole = data.user?.user_metadata?.role;
        const profile = await this.getUserProfile(data.user.id);
        const effectiveRole = profile?.role || metadataRole;
        if (effectiveRole && effectiveRole !== role) {
          await client.auth.signOut();
          return { user: null, session: null, error: `This account is not registered as a ${role}.` };
        }
      }

      return { user: data.user, session: data.session, error: null };
    } catch (err: any) {
      return { user: null, session: null, error: getAuthErrorMessage(err, 'Login failed. Please sign up first or check your password.') };
    }
  }

  async signUpWithGoogle(role: UserRole = 'candidate') {
    try {
      const client = this.requireClient();
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            role
          }
        }
      });
      return { data, error: error?.message || null };
    } catch (err: any) {
      return { data: null, error: getAuthErrorMessage(err, 'Google signup failed.') };
    }
  }

  async signOut() {
    const client = this.requireClient();
    await client.auth.signOut();
  }

  async getCurrentUser() {
    const client = this.requireClient();
    const { data: { user } } = await client.auth.getUser();
    return user;
  }

  async upsertUserProfile(id: string, email: string, role: UserRole, name = '') {
    const client = this.requireClient();
    const { error } = await client.from('user_profiles').upsert({
      id,
      email,
      role,
      full_name: name,
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
  }

  async getUserProfile(id: string) {
    const client = this.requireClient();
    const { data, error } = await client.from('user_profiles').select('*').eq('id', id).maybeSingle();
    if (error) return null;
    return data;
  }

  async getCandidates(): Promise<Candidate[]> {
    const client = this.requireClient();
    const { data, error } = await client.from('candidates').select('*').order('date', { ascending: false });
    if (error) throw error;
    return (data || []) as Candidate[];
  }

  async upsertCandidate(candidate: Candidate): Promise<boolean> {
    const client = this.requireClient();
    const { error } = await client.from('candidates').upsert(candidate);
    if (error) throw error;
    return true;
  }

  async getDisqualifiedCandidates(): Promise<Candidate[]> {
    const client = this.requireClient();
    const { data, error } = await client.from('disqualified_candidates').select('*').order('date', { ascending: false });
    if (error) throw error;
    return (data || []) as Candidate[];
  }

  async upsertDisqualifiedCandidate(candidate: Candidate): Promise<boolean> {
    const client = this.requireClient();
    const { error } = await client.from('disqualified_candidates').upsert(candidate);
    if (error) throw error;
    return true;
  }

  async clearDatabase() {
    const client = this.requireClient();
    await client.from('candidates').delete().neq('id', '');
    await client.from('disqualified_candidates').delete().neq('id', '');
  }

  async getRecruiterQuestions(): Promise<RoleQuestionMap | InterviewQuestion[]> {
    const client = this.requireClient();
    const { data, error } = await client
      .from('recruiter_questions')
      .select('questions')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data?.questions) return [];
    return data.questions as RoleQuestionMap | InterviewQuestion[];
  }

  async saveRecruiterQuestions(questions: RoleQuestionMap) {
    const client = this.requireClient();
    const { error } = await client.from('recruiter_questions').insert({
      questions,
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
  }

  async uploadVideo(blob: Blob, fileName: string): Promise<string> {
    const client = this.requireClient();
    const { error } = await client.storage.from('interview-videos').upload(fileName, blob, {
      cacheControl: '3600',
      upsert: true,
      contentType: blob.type || 'video/webm'
    });
    if (error) throw error;

    const { data } = client.storage.from('interview-videos').getPublicUrl(fileName);
    return data.publicUrl;
  }
}

export const supabaseService = new SupabaseService();
export default supabaseService;
