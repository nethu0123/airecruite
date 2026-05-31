/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Candidate, SuspiciousLog, VideoResponse, AiEvaluation } from '../types';
import { StatusBadge } from './UIBase';
import { AlertTriangle, ChevronRight, User, Eye, Sparkles, BookOpen, AlertCircle, PlayCircle, Tv } from 'lucide-react';

/**
 * Recruiter Dashboard Candidate Table.
 */
export interface CandidateTableProps {
  candidates: Candidate[];
  onSelectCandidate: (candidate: Candidate) => void;
}

export function CandidateTable({ candidates, onSelectCandidate }: CandidateTableProps) {
  return (
    <div id="candidate-table-container" className="interactive-card bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-[0_12px_45px_rgba(0,0,0,0.06)] transition-all duration-300 overflow-hidden text-left">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-stone-50/80 text-[11px] uppercase tracking-widest font-extrabold text-stone-400">
              <th className="px-6 py-4.5">Candidate Details</th>
              <th className="px-6 py-4.5">Target Directives</th>
              <th className="px-6 py-4.5 font-mono">Date Tested</th>
              <th className="px-6 py-4.5">Audit Status</th>
              <th className="px-6 py-4.5 text-center">Compliance Flags</th>
              <th className="px-6 py-4.5 text-center">AI Hiring Recommendation</th>
              <th className="px-6 py-4.5 text-center font-mono">Hiring Rate</th>
              <th className="px-6 py-4.5 text-right">Action Gate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {candidates.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center text-xs text-stone-400 font-bold uppercase tracking-wider">
                  No applicant records match current filters
                </td>
              </tr>
            ) : (
              candidates.map((cand) => {
                const flagsCount = cand.suspiciousLogs.length;
                return (
                  <tr 
                    key={cand.id} 
                    id={`candidate-row-${cand.id}`}
                    className="group hover:bg-amber-50/25 hover:shadow-[inset_3px_0_0_rgba(245,158,11,0.75)] transition-all duration-300"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-amber-50 text-amber-900 rounded-full flex items-center justify-center font-bold text-xs uppercase shadow-2xs transition-transform duration-300 group-hover:scale-105">
                          {cand.fullName.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-stone-850 leading-tight">{cand.fullName}</h4>
                          <p className="text-[10px] text-stone-400 mt-0.5 font-medium">{cand.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-stone-550">
                      {cand.role}
                    </td>
                    <td className="px-6 py-4 text-xs text-stone-400 font-mono font-medium">
                      {cand.date}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={cand.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center">
                        {flagsCount > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-800 text-3xs font-extrabold rounded-lg shadow-[inset_0_1px_2px_rgba(244,63,94,0.06)]">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 mb-0.5" />
                            {flagsCount} DISPFLAGS
                          </span>
                        ) : (
                          <span className="text-[10px] leading-none text-stone-400 font-bold uppercase tracking-wider">Pass</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center px-3 py-1 bg-stone-50 text-stone-700 text-3xs font-extrabold rounded-lg uppercase tracking-wider">
                        {cand.aiEvaluation?.recommendation || 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-center">
                        {cand.score !== undefined ? (
                          <span className={`text-xs font-bold font-mono ${
                            cand.score >= 80 ? 'text-amber-600' : cand.score >= 60 ? 'text-stone-700' : 'text-rose-600'
                          }`}>
                            {cand.score} / 100
                          </span>
                        ) : (
                          <span className="text-3xs font-bold text-stone-405 uppercase tracking-wider bg-stone-50 px-2 py-1 rounded">Pending</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => onSelectCandidate(cand)}
                        className="interactive-button inline-flex items-center gap-1.5 text-xs font-bold text-stone-850 bg-amber-450 hover:bg-amber-500 px-4 py-2.5 rounded-xl transition duration-200 cursor-pointer shadow-[0_4px_12px_rgba(245,158,11,0.15)] hover:shadow-[0_8px_20px_rgba(245,158,11,0.3)]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Audit Record</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Reusable Transcript Viewer component
 */
export interface TranscriptCardProps {
  responses: VideoResponse[];
}

export function TranscriptCard({ responses }: TranscriptCardProps) {
  const [activeQuestion, setActiveQuestion] = useState<number>(1);

  if (responses.length === 0) {
    return (
      <div id="transcript-empty" className="bg-stone-50 rounded-2xl p-6 text-center text-xs font-bold uppercase tracking-wider text-stone-400">
        No transcription records logged.
      </div>
    );
  }

  const selectedResponse = responses.find(r => r.questionId === activeQuestion) || responses[0];

  return (
    <div id="transcript-card-panel" className="interactive-card bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.03)] text-left">
      <div className="flex items-center gap-2 mb-5 border-b-transparent">
        <BookOpen className="w-5 h-5 text-amber-500" />
        <h3 className="text-sm font-extrabold text-stone-900 tracking-tight">Verbatim Speech Records</h3>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-thin">
        {responses.map((resp) => (
          <button
            key={resp.questionId}
            onClick={() => setActiveQuestion(resp.questionId)}
            className={`hover-lift px-4.5 py-3 text-xs font-bold rounded-2xl shrink-0 transition-all cursor-pointer ${
              activeQuestion === resp.questionId
                ? 'bg-amber-50 text-amber-950 shadow-[inset_0_1px_2px_rgba(245,158,11,0.1)]'
                : 'bg-stone-50 text-stone-500 hover:bg-stone-100'
            }`}
          >
            Question {resp.questionId} Transcript
          </button>
        ))}
      </div>

      <div className="bg-stone-50 rounded-3xl p-6 space-y-4 shadow-[0_4px_12px_rgba(0,0,0,0.01)]">
        <div>
          <span className="text-[9px] font-extrabold text-stone-400 uppercase tracking-widest block mb-1">PROMPTED DISCUSSION TASK</span>
          <h4 className="text-sm font-bold text-stone-850 leading-relaxed font-sans">{selectedResponse.questionText}</h4>
        </div>

        <div className="pt-3 border-t border-stone-100/60">
          <span className="text-[9px] font-extrabold text-stone-400 uppercase tracking-widest block mb-1.5">TRANSCRIBED CLIENT RECORD</span>
          <div className="text-sm text-stone-605 leading-relaxed font-sans bg-white p-4.5 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.005)] font-medium">
            "{selectedResponse.transcript || "Speech capture was silent or unreadable."}"
          </div>
        </div>

        <div className="flex justify-between items-center text-[10px] text-stone-400 font-extrabold tracking-wider uppercase mt-4">
          <span>SPEECH CAPTURE DURATION: {selectedResponse.duration}s</span>
          <span className="text-amber-600 font-mono">
            AUDIO LEVEL: {selectedResponse.averageVolume ?? 0}/100 • SPEECH CONFIDENCE: {selectedResponse.speechConfidence ?? 0}/100
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Reusable Suspicious Log Viewer
 */
export interface SuspiciousLogsProps {
  logs: SuspiciousLog[];
}

export function SuspiciousLogs({ logs }: SuspiciousLogsProps) {
  const getLogStyles = (type: string) => {
    switch (type) {
      case 'tab-switched':
        return {
          bg: 'bg-amber-50/60',
          text: 'text-amber-900',
          badge: 'bg-amber-100 text-amber-950'
        };
      default:
        return {
          bg: 'bg-rose-50/60',
          text: 'text-rose-900',
          badge: 'bg-rose-100 text-rose-950'
        };
    }
  };

  return (
    <div id="suspicious-logs-panel" className="interactive-card bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.03)] text-left">
      <div className="flex items-center gap-2 mb-5 border-b-transparent">
        <AlertTriangle className="w-5 h-5 text-rose-500 hover:scale-105 transition-all" />
        <h3 className="text-sm font-extrabold text-stone-900 tracking-tight">Proctor Verification Logs</h3>
      </div>

      {logs.length === 0 ? (
        <div className="flex items-center gap-3 p-5 bg-emerald-50 rounded-2xl text-emerald-950">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold leading-normal">Full compliance passed. No anomaly flags triggered during session.</span>
        </div>
      ) : (
        <div className="space-y-3.5 max-h-[220px] overflow-y-auto pr-2 scrollbar-thin">
          {logs.map((log) => {
            const styles = getLogStyles(log.type);
            return (
              <div 
                key={log.id} 
                className={`hover-lift p-4 rounded-2xl flex items-start gap-3 transition-all ${styles.bg}`}
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                <div className="flex-1 text-left">
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <span className={`text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md ${styles.badge}`}>
                      {log.type.replace('-', ' ')}
                    </span>
                    <span className="text-[10px] text-stone-400 font-mono font-bold">
                      {log.timestamp}
                    </span>
                  </div>
                  <p className={`text-xs mt-1.5 leading-relaxed font-semibold ${styles.text}`}>
                    {log.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CheckCircle({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

/**
 * Reusable AI Evaluation Card
 */
export interface EvaluationCardProps {
  evaluation?: AiEvaluation;
}

export function EvaluationCard({ evaluation }: EvaluationCardProps) {
  if (!evaluation) {
    return (
      <div id="evaluation-pending" className="interactive-card bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.03)] text-center">
        <Sparkles className="w-6 h-6 text-amber-500 mx-auto mb-3 animate-pulse" />
        <h4 className="text-sm font-extrabold text-stone-850">AI Assessment Pending</h4>
        <p className="text-xs text-stone-400 leading-relaxed font-medium mt-1">
          Our model will analyze transcripts and score responses once they are generated.
        </p>
      </div>
    );
  }

  const getRecommendationBadge = (rec: string) => {
    switch (rec) {
      case 'Strong Hire':
        return 'bg-emerald-50 text-emerald-950';
      case 'Hire':
        return 'bg-amber-50 text-amber-950';
      case 'Review':
        return 'bg-stone-100 text-stone-800';
      default:
        return 'bg-rose-50 text-rose-950';
    }
  };

  const scores = [
    { label: 'Expression & Delivery Accuracy', val: evaluation.communicationScore, color: 'bg-amber-400', trail: 'bg-amber-100/50' },
    { label: 'Subject Competency depth', val: evaluation.technicalScore, color: 'bg-amber-500', trail: 'bg-amber-100/50' },
    { label: 'Posture, Decorum, & confidence', val: evaluation.confidenceScore, color: 'bg-stone-700', trail: 'bg-stone-100/50' }
  ];

  return (
    <div id="evaluation-card-panel" className="interactive-card bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-6 text-left">
      <div className="flex items-center justify-between border-b-transparent">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
          <h3 className="text-sm font-extrabold text-stone-900 tracking-tight">AI Assessment Insights</h3>
        </div>
        <span className={`px-3.5 py-1 text-2xs font-extrabold rounded-lg uppercase tracking-wider ${getRecommendationBadge(evaluation.recommendation)}`}>
          {evaluation.recommendation}
        </span>
      </div>

      <div className="space-y-4">
        {scores.map((score, i) => (
          <div key={i}>
            <div className="flex justify-between items-center text-xs font-bold text-stone-500 mb-1.5">
              <span>{score.label}</span>
              <span className="font-mono text-stone-850">{score.val} / 100</span>
            </div>
            <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
              <div 
                className={`${score.color} h-full rounded-full transition-all duration-700`}
                style={{ width: `${score.val}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-amber-50/40 rounded-2xl p-5 shadow-[0_4px_12px_rgba(245,158,11,0.02)]">
        <span className="text-[9px] font-extrabold text-amber-900 tracking-widest uppercase block mb-1">Qualitative Synthesis</span>
        <p className="text-xs text-stone-605 leading-relaxed font-sans font-medium">
          "{evaluation.summary}"
        </p>
      </div>
    </div>
  );
}
