/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Candidate {
  id: string;
  fullName: string;
  email: string;
  role: string;
  token: string;
  batchCode?: string;
  status: 'pending' | 'completed' | 'failed';
  date: string;
  score?: number; // average of scores
  aiEvaluation?: AiEvaluation;
  suspiciousLogs: SuspiciousLog[];
  responses: VideoResponse[];
}

export interface SuspiciousLog {
  id: string;
  timestamp: string;
  type: 'tab-switched' | 'camera-disconnected' | 'mic-disconnected' | 'network-interrupted' | 'unusual-noise' | 'compliance-breach' | 'gaze-drifted' | 'multiple-persons' | 'ai-tool-detected';
  description: string;
}

export interface VideoResponse {
  questionId: number;
  questionText: string;
  videoUrl?: string; // object URL or placeholder
  transcript: string;
  duration: number; // in seconds
  averageVolume?: number;
  speechConfidence?: number;
}

export interface AiEvaluation {
  communicationScore: number;
  technicalScore: number;
  confidenceScore: number;
  recommendation: 'Strong Hire' | 'Hire' | 'Review' | 'No Hire';
  summary: string;
}

export interface InterviewQuestion {
  id: number;
  text: string;
  category: string;
  suggestedDuration: number; // in seconds
}

export type RoleQuestionMap = Record<string, InterviewQuestion[]>;
