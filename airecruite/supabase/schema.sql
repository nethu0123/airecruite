-- Supabase setup for Airecruite.
-- Run this in Supabase Dashboard > SQL Editor for a new project.

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('candidate', 'recruiter')),
  full_name text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.candidates (
  id text primary key,
  "fullName" text not null,
  email text not null,
  role text not null,
  token text not null,
  "batchCode" text,
  status text not null check (status in ('pending', 'completed', 'failed')),
  date timestamptz not null,
  score numeric,
  "aiEvaluation" jsonb,
  "suspiciousLogs" jsonb not null default '[]'::jsonb,
  responses jsonb not null default '[]'::jsonb
);

create table if not exists public.disqualified_candidates (
  id text primary key,
  "fullName" text not null,
  email text not null,
  role text not null,
  token text not null,
  "batchCode" text,
  status text not null check (status in ('pending', 'completed', 'failed')),
  date timestamptz not null,
  score numeric,
  "aiEvaluation" jsonb,
  "suspiciousLogs" jsonb not null default '[]'::jsonb,
  responses jsonb not null default '[]'::jsonb
);

create table if not exists public.recruiter_questions (
  id bigint generated always as identity primary key,
  questions jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;
alter table public.candidates enable row level security;
alter table public.disqualified_candidates enable row level security;
alter table public.recruiter_questions enable row level security;

drop policy if exists "Users can read their own profile" on public.user_profiles;
create policy "Users can read their own profile"
  on public.user_profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can upsert their own profile" on public.user_profiles;
create policy "Users can upsert their own profile"
  on public.user_profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.user_profiles;
create policy "Users can update their own profile"
  on public.user_profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Authenticated users can read candidates" on public.candidates;
create policy "Authenticated users can read candidates"
  on public.candidates for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can write candidates" on public.candidates;
create policy "Authenticated users can write candidates"
  on public.candidates for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update candidates" on public.candidates;
create policy "Authenticated users can update candidates"
  on public.candidates for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete candidates" on public.candidates;
create policy "Authenticated users can delete candidates"
  on public.candidates for delete
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read disqualified candidates" on public.disqualified_candidates;
create policy "Authenticated users can read disqualified candidates"
  on public.disqualified_candidates for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can write disqualified candidates" on public.disqualified_candidates;
create policy "Authenticated users can write disqualified candidates"
  on public.disqualified_candidates for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update disqualified candidates" on public.disqualified_candidates;
create policy "Authenticated users can update disqualified candidates"
  on public.disqualified_candidates for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete disqualified candidates" on public.disqualified_candidates;
create policy "Authenticated users can delete disqualified candidates"
  on public.disqualified_candidates for delete
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read recruiter questions" on public.recruiter_questions;
create policy "Authenticated users can read recruiter questions"
  on public.recruiter_questions for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can save recruiter questions" on public.recruiter_questions;
create policy "Authenticated users can save recruiter questions"
  on public.recruiter_questions for insert
  to authenticated
  with check (true);

insert into storage.buckets (id, name, public)
values ('interview-videos', 'interview-videos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Authenticated users can upload interview videos" on storage.objects;
create policy "Authenticated users can upload interview videos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'interview-videos');

drop policy if exists "Authenticated users can update interview videos" on storage.objects;
create policy "Authenticated users can update interview videos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'interview-videos')
  with check (bucket_id = 'interview-videos');

drop policy if exists "Public can read interview videos" on storage.objects;
create policy "Public can read interview videos"
  on storage.objects for select
  to public
  using (bucket_id = 'interview-videos');

notify pgrst, 'reload schema';
