import React from 'react';
import { BriefcaseBusiness, Lock, Mail, RefreshCw, ShieldAlert, User } from 'lucide-react';

interface AuthPanelProps {
  mode: 'signin' | 'signup';
  selectedRole: 'candidate' | 'recruiter';
  name: string;
  email: string;
  password: string;
  error: string;
  loading: boolean;
  onModeChange: (mode: 'signin' | 'signup') => void;
  onRoleChange: (role: 'candidate' | 'recruiter') => void;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onGoogleSignUp: () => void;
}

export function AuthPanel({
  mode,
  selectedRole,
  name,
  email,
  password,
  error,
  loading,
  onModeChange,
  onRoleChange,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onGoogleSignUp
}: AuthPanelProps) {
  const roleOptions = [
    { id: 'candidate' as const, title: 'Candidate', subtitle: 'Attend Interview' },
    { id: 'recruiter' as const, title: 'Admin', subtitle: 'Control Panel' }
  ];

  return (
    <div className="interactive-card w-full max-w-2xl bg-white rounded-2xl p-7 sm:p-8 shadow-[0_18px_45px_rgba(15,23,42,0.08)] border border-slate-100 text-left animate-fade-in">
      <div className="mb-6 flex items-center justify-center">
        <div className="flex items-center gap-3">
          
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-950">airecruite</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Secure hiring access</p>
          </div>
        </div>
      </div>
      <form onSubmit={onSubmit} className="space-y-5">
        {mode === 'signup' && (
          <div>
            <label htmlFor="auth-name" className="block text-sm font-semibold text-slate-900 mb-1.5">Full Name</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                id="auth-name"
                required
                type="text"
                placeholder="Your full name"
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                className="w-full h-11 pl-11 pr-4 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-all duration-200 focus:-translate-y-0.5"
              />
            </div>
          </div>
        )}

        <div>
          <label htmlFor="auth-email" className="block text-sm font-semibold text-slate-900 mb-1.5">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              id="auth-email"
              required
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              className="w-full h-11 pl-11 pr-4 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-all duration-200 focus:-translate-y-0.5"
            />
          </div>
        </div>

        <div>
          <label htmlFor="auth-password" className="block text-sm font-semibold text-slate-900 mb-1.5">Password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              id="auth-password"
              required
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              className="w-full h-11 pl-11 pr-4 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-all duration-200 focus:-translate-y-0.5"
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900 mb-2">Sign in as</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {roleOptions.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => onRoleChange(role.id)}
                className={`interactive-card min-h-[80px] rounded-lg border p-4 text-left transition cursor-pointer ${
                  selectedRole === role.id
                    ? 'border-amber-500 bg-amber-50 shadow-[0_0_0_1px_rgba(245,158,11,0.55)]'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <BriefcaseBusiness className={`w-5 h-5 mt-0.5 ${selectedRole === role.id ? 'text-amber-600' : 'text-slate-400'}`} />
                  <div>
                    <span className={`block text-sm font-extrabold uppercase tracking-wide ${selectedRole === role.id ? 'text-amber-700' : 'text-slate-950'}`}>
                      {role.title}
                    </span>
                    <span className="block mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      {role.subtitle}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 text-rose-900 rounded-lg text-xs font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="interactive-button w-full h-11 bg-amber-400 hover:bg-amber-500 text-slate-950 font-semibold text-base rounded-lg shadow-[0_8px_18px_rgba(245,158,11,0.25)] transition cursor-pointer disabled:opacity-60 flex items-center justify-center"
        >
          {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : mode === 'signup' ? 'Sign Up' : 'Sign In'}
        </button>

        {mode === 'signup' && (
          <button
            type="button"
            onClick={onGoogleSignUp}
            disabled={loading}
            className="interactive-button w-full h-10 rounded-lg border border-amber-200 text-sm font-semibold text-slate-800 hover:bg-amber-50 transition cursor-pointer disabled:opacity-60"
          >
            Sign up with Google
          </button>
        )}

        <button
          type="button"
          onClick={() => onModeChange(mode === 'signin' ? 'signup' : 'signin')}
          className="w-full text-center text-sm font-medium text-amber-700 hover:text-amber-800 cursor-pointer"
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}
