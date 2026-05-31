/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InterviewQuestion, AiEvaluation, SuspiciousLog, VideoResponse } from '../types';

class GeminiService {
  private log(message: string, data?: any) {
    console.log(`[airecruite AI Proxy] %c${message}`, 'color: #eab308; font-weight: bold;', data || '');
  }

  /**
   * Generates a tailored screening question dynamically via the backend Proxy.
   * This is called question-by-question during the live interview.
   */
  async generateQuestion(role: string, questionNumber: number, answersHistory: { questionText: string; answerText: string }[]): Promise<string> {
    this.log(`Requesting next dynamic question [Q#${questionNumber}] for role limit: "${role}"`);
    try {
      const response = await fetch('/api/gemini/generate-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role,
          questionNumber,
          answersHistory
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.question || "Could you describe your core experience in this direction?";
    } catch (err: any) {
      this.log('Error requesting server question', err);
      throw new Error(err?.message || 'AI question generation is unavailable. Check the Gemini API configuration.');
    }
  }

  /**
   * Submits full transcripts to the server-side Gemini system for scoring and summaries.
   */
  async generateEvaluation(responses: VideoResponse[], suspiciousLogs: SuspiciousLog[], role: string): Promise<AiEvaluation & { score: number }> {
    this.log(`Submitting candidate transcripts for role "${role}" to AI evaluation endpoint.`);
    try {
      const response = await fetch('/api/gemini/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          responses,
          suspiciousCount: suspiciousLogs.length,
          suspiciousLogs,
          role
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.evaluation) {
        throw new Error('AI evaluation response was empty.');
      }
      return data.evaluation;
    } catch (err: any) {
      this.log('Failed to connect to AI evaluation endpoint', err);
      throw new Error(err?.message || 'AI evaluation is unavailable. Check the Gemini API configuration.');
    }
  }
}

export const geminiService = new GeminiService();
export default geminiService;
