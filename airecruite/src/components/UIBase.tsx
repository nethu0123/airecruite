/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sparkles, ArrowRight, ShieldAlert, Monitor, Video, CheckCircle, Search, LogOut } from 'lucide-react';

/**
 * Reusable simple Status Badge component.
 */
export interface StatusBadgeProps {
  status: 'pending' | 'completed' | 'failed' | 'flagged' | string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const getStyles = () => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-amber-50 text-amber-900 shadow-[inset_0_1px_2px_rgba(251,191,36,0.2)]';
      case 'pending':
        return 'bg-yellow-50 text-yellow-900 shadow-[inset_0_1px_2px_rgba(234,179,8,0.2)]';
      case 'flagged':
      case 'failed':
        return 'bg-rose-50 text-rose-900 shadow-[inset_0_1px_2px_rgba(244,63,94,0.2)]';
      default:
        return 'bg-stone-50 text-stone-900 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]';
    }
  };

  const capitalize = (val: string) => val.charAt(0).toUpperCase() + val.slice(1);

  return (
    <span 
      id={`status-badge-${status}`} 
      className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-transform duration-200 hover:scale-105 ${getStyles()}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {capitalize(status)}
    </span>
  );
}

/**
 * Reusable Landing Feature Card.
 */
export interface FeatureCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

export function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <div 
      id={`feature-card-${title.toLowerCase().replace(/\s+/g, '-')}`} 
      className="interactive-card group relative p-8 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(245,158,11,0.08)] transition-all duration-500 text-left"
    >
      <div className="inline-flex p-4 bg-amber-50 text-amber-600 rounded-2xl mb-5 group-hover:bg-amber-500 group-hover:text-white group-hover:rotate-3 group-hover:scale-110 transition-all duration-300">
        <Icon className="w-6 h-6 transition-transform duration-300 group-hover:-rotate-6" />
      </div>
      <h3 className="text-base font-bold text-stone-900 mb-2 transition-colors group-hover:text-amber-600">{title}</h3>
      <p className="text-xs leading-relaxed text-stone-500 font-medium">{description}</p>
    </div>
  );
}

/**
 * Reusable Recruiter Stat Card.
 */
export interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor?: 'amber' | 'yellow' | 'rose' | 'stone';
}

export function StatCard({ title, value, description, icon: Icon, accentColor = 'amber' }: StatCardProps) {
  const colorMap = {
    amber: 'bg-amber-50 text-amber-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    rose: 'bg-rose-50 text-rose-600',
    stone: 'bg-stone-50 text-stone-600'
  };

  return (
    <div 
      id={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`} 
      className="interactive-card group p-6 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_15px_35px_rgba(0,0,0,0.08)] transition-all duration-300 flex items-start justify-between text-left"
    >
      <div>
        <span className="text-2xs font-extrabold text-stone-400 uppercase tracking-widest">{title}</span>
        <h4 className="text-2xl font-bold text-stone-850 mt-3 mb-1 tracking-tight">{value}</h4>
        <p className="text-xs text-stone-400 font-medium">{description}</p>
      </div>
      <div className={`p-3.5 rounded-2xl transition-transform duration-300 group-hover:scale-110 ${colorMap[accentColor] || colorMap['amber']}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
}

/**
 * Reusable Interview Progress Bar
 */
export interface ProgressBarProps {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  return (
    <div id="interview-progress-wrapper" className="w-full text-left">
      <div className="flex justify-between items-center mb-1.5 text-xs font-bold text-stone-500">
        <span>Question Progress ({current} of {total})</span>
        <span className="text-amber-600">{Math.round(percentage)}% Complete</span>
      </div>
      <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden">
        <div 
          className="progress-shimmer h-full rounded-full transition-all duration-500 ease-out" 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Global Landing Navbar.
 */
export interface NavbarProps {
  onNavigate: (page: string) => void;
  currentPage: string;
}

export function Navbar({ onNavigate, currentPage }: NavbarProps) {
  const isRecruiter = currentPage.startsWith('#recruiter');
  
  // Custom logo generator with airecruite naming using generated brand logo
  const logo = (
    <div className="flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95" onClick={() => onNavigate('landing')}>
      <img
        src="/src/assets/images/app_logo_1780125395119.png"
        alt="airecruite logo"
        className="w-10 h-10 object-contain"
        referrerPolicy="no-referrer"
      />
      <span className="text-lg font-extrabold tracking-tight text-stone-900">
        airecruite<span className="text-amber-500 font-light">.</span>
      </span>
    </div>
  );

  return (
    <nav id="app-navbar" className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-[0_2px_20px_rgba(0,0,0,0.02)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {logo}

          {/* Links Section: Hidden during the actual active live test to prevent unwanted exits */}
          {currentPage !== '#candidate/interview' && currentPage !== '#candidate/hardware-check' && (
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-xs font-bold text-stone-550 hover:text-amber-500 uppercase tracking-wider transition-colors">Features</a>
              <a href="#how-it-works" className="text-xs font-bold text-stone-550 hover:text-amber-500 uppercase tracking-wider transition-colors">How It Works</a>
              <button 
                onClick={() => onNavigate('recruiter-dashboard')}
                className={`text-xs font-bold uppercase tracking-wider transition-colors ${isRecruiter ? 'text-amber-500' : 'text-stone-550 hover:text-amber-500'}`}
              >
                Admin
              </button>
            </div>
          )}

          <div className="flex items-center gap-3">
            {currentPage !== '#candidate/interview' && currentPage !== '#candidate/hardware-check' && (
              <>
                <button 
                  id="btn-nav-recipient-login"
                  onClick={() => onNavigate('recruiter-dashboard')}
                  className="interactive-button px-4.5 py-2.5 text-xs font-bold text-stone-600 bg-stone-50 hover:bg-stone-100 rounded-xl transition-all shadow-[0_4px_12px_rgba(0,0,0,0.02)] cursor-pointer"
                >
                  Admin -&gt;
                </button>
                <button 
                  id="btn-nav-candidate-login"
                  onClick={() => onNavigate('candidate-login')}
                  className="interactive-button px-5 py-2.5 text-xs font-bold text-stone-900 bg-amber-400 hover:bg-amber-500 rounded-xl shadow-[0_4px_12px_rgba(245,158,11,0.2)] hover:shadow-[0_6px_18px_rgba(245,158,11,0.3)] transition-all duration-300 cursor-pointer"
                >
                  candidate -&gt;
                </button>
              </>
            )}
            
            {currentPage === '#candidate/interview' && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                <span className="text-2xs font-extrabold text-stone-400 tracking-widest uppercase">PROCTOR MONITOR ACTIVE</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

/**
 * Recruiter Portal Responsive Sidebar.
 */
export interface SidebarProps {
  activeTab: 'dashboard' | 'candidates';
  onChangeTab: (tab: 'dashboard' | 'candidates') => void;
  onLogout: () => void;
}

export function Sidebar({ activeTab, onChangeTab, onLogout }: SidebarProps) {
  const items = [
    { id: 'dashboard', label: 'Dashboard Overview', icon: Monitor },
    { id: 'candidates', label: 'Candidates Roster', icon: CheckCircle },
  ] as const;

  return (
    <aside id="recruiter-sidebar" className="w-64 bg-white p-6 flex flex-col justify-between h-[calc(100vh-5rem)] sticky top-20 shadow-[4px_0_24px_rgba(0,0,0,0.015)] text-left">
      <div className="space-y-6">
        <div>
          <span className="text-[10px] font-extrabold text-stone-400 tracking-widest uppercase">Navigation</span>
          <div className="mt-4 space-y-1.5">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onChangeTab(item.id)}
                  className={`hover-lift w-full flex items-center gap-3 px-4 py-3.5 text-xs font-bold rounded-2xl text-left transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-amber-50 text-amber-950 shadow-[inset_0_1px_2px_rgba(245,158,11,0.1)]' 
                      : 'text-stone-500 hover:bg-stone-50 hover:text-stone-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-amber-500' : 'text-stone-400'}`} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-5 bg-amber-50/50 rounded-3xl relative overflow-hidden text-left shadow-[0_8px_20px_rgba(245,158,11,0.03)]">
          <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>AI Automated Assessment</span>
          </div>
          <p className="text-[11px] text-stone-550 leading-relaxed mt-2 font-medium">
            Interviews are transcribed and evaluated immediately upon upload without manual review.
          </p>
        </div>
      </div>

      <button
        onClick={onLogout}
        className="interactive-button flex items-center justify-between px-4 py-3.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-2xl transition-all cursor-pointer"
      >
        <span>Exit Recruiter Area</span>
        <LogOut className="w-4 h-4" />
      </button>
    </aside>
  );
}
