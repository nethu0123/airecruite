/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

function getReadableGeminiError(err: any) {
  const rawMessage = err?.message || String(err || 'Gemini request was rejected.');

  try {
    const parsed = JSON.parse(rawMessage);
    const status = parsed?.error?.status;
    const message = parsed?.error?.message || rawMessage;
    if (status === 'RESOURCE_EXHAUSTED' || parsed?.error?.code === 429) {
      const retryDelay = parsed?.error?.details?.find((detail: any) => detail?.['@type']?.includes('RetryInfo'))?.retryDelay;
      return `Gemini quota exhausted for ${GEMINI_MODEL}. Enable billing, increase quota, or use another API key/project with available Gemini quota${retryDelay ? `, then retry after ${retryDelay}` : ''}.`;
    }
    return message;
  } catch {
    if (/quota|resource_exhausted|429/i.test(rawMessage)) {
      return `Gemini quota exhausted for ${GEMINI_MODEL}. Enable billing, increase quota, or use another API key/project with available Gemini quota.`;
    }
    return rawMessage;
  }
}

function clampScore(value: unknown, fallback = 0) {
  const score = Number(value);
  if (!Number.isFinite(score)) return fallback;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function recommendationFromScore(score: number, hasCriticalIntegrityIssue: boolean) {
  if (hasCriticalIntegrityIssue || score < 45) return 'No Hire';
  if (score < 65) return 'Review';
  if (score < 82) return 'Hire';
  return 'Strong Hire';
}

function calculateIntegrityPenalty(logs: any[]) {
  const penaltyByType: Record<string, number> = {
    'tab-switched': 8,
    'gaze-drifted': 6,
    'multiple-persons': 20,
    'ai-tool-detected': 18,
    'unusual-noise': 5,
    'camera-disconnected': 15,
    'mic-disconnected': 12,
    'network-interrupted': 6,
    'compliance-breach': 35
  };

  return Math.min(
    45,
    logs.reduce((total, log) => total + (penaltyByType[log?.type] || 4), 0)
  );
}

// Initialize the Gemini client lazily to handle missing keys gracefully
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== 'MY_GEMINI_API_KEY') {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
    }
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const HMR_PORT = Number(process.env.HMR_PORT || PORT + 21678);

  // Middleware
  app.use(express.json({ limit: '20mb' }));

  // API Route: Generate Question dynamically
  app.post('/api/gemini/generate-question', async (req, res) => {
    const { role, questionNumber, answersHistory } = req.body;
    try {
      const client = getGeminiClient();

      if (!client) {
        return res.status(503).json({ error: 'GEMINI_API_KEY is required for AI question generation.' });
      }

      // We have Gemini! Generate question dynamically based on user answer and role
      const historyText = (answersHistory || []).map((h: any, i: number) => {
        return `Q${i+1}: ${h.questionText}\nCandidate Answer: ${h.answerText}`;
      }).join('\n\n');

      const systemPrompt = `You are an expert HR interviewer for the system 'airecruite'.
The position applied for is: "${role}".
We are conducting an automated screening interview consisting of exactly 5 questions.
You are generating Question number ${questionNumber} out of 5.
${answersHistory && answersHistory.length > 0 ? `The interview history is as follows:\n${historyText}\n\nGenerate a logical, follow-up screening page, probing their previous answers for clarity or testing a separate key skill required for "${role}".` : `This is the very first question. Generate a friendly, welcoming, standard introductory and screening question appropriate for "${role}".`}

Style rules:
1. Moderate difficulty: Not too abstract or overly difficult, and not too simple. It should be easy to understand by anyone.
2. Directness: Response must be the clean text of the interview question ONLY. No preamble, introduction, brackets, or meta-comments.
3. Keep it professional, friendly, and under 30 words.`;

      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Generate interview question ${questionNumber} for candidate.`,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7
        }
      });

      const questionText = response.text?.trim() || "What core expertise do you bring to this role?";
      return res.json({ question: questionText });
    } catch (err: any) {
      console.warn('Gemini generate question error:', err.message || err);
      return res.status(502).json({ error: `AI question generation failed: ${getReadableGeminiError(err)}` });
    }
  });

  // API Route: Evaluate transcripts
  app.post('/api/gemini/evaluate', async (req, res) => {
    try {
      const { responses, suspiciousCount, suspiciousLogs, role } = req.body;
      const client = getGeminiClient();

      if (!client) {
        return res.status(503).json({ error: 'GEMINI_API_KEY is required for AI candidate evaluation.' });
      }

      const normalizedLogs = Array.isArray(suspiciousLogs) ? suspiciousLogs : [];
      const normalizedResponses = Array.isArray(responses) ? responses : [];
      const transcriptText = normalizedResponses.map((item: any, index: number) => (
        `Q${index + 1}: ${item?.questionText || 'Unknown question'}\nAnswer: ${item?.transcript || '[no usable answer captured]'}\nSpeech duration: ${item?.duration ?? 0}s\nAverage audio level: ${item?.averageVolume ?? 0}/100\nSpeech capture confidence: ${item?.speechConfidence ?? 0}/100`
      )).join('\n\n');

      const promptText = `Evaluate this candidate like a strict, real hiring manager for the "${role}" role.

Interview transcript:
${transcriptText}

Proctor/integrity logs:
${JSON.stringify(normalizedLogs, null, 2)}

Scoring rules:
- Score only from the candidate's actual answers to the questions, role relevance, specificity, correctness, communication clarity, confidence, attitude, and integrity logs.
- Penalize vague, generic, memorized, evasive, copied, silent, or unrelated answers.
- Confidence/attitude must be inferred from answer completeness, ownership language, clarity, and consistency. Do not invent visual emotions.
- Do not make the hiring recommendation random. Use evidence from the transcript.

Return JSON only with:
{
  "communicationScore": integer 0-100,
  "technicalScore": integer 0-100,
  "confidenceScore": integer 0-100,
  "summary": "2-4 sentences explaining the score with specific evidence"
}`;

      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: promptText,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
          systemInstruction: "You are a strict professional hiring manager. Evaluate only the supplied answers and logs. Return conservative, evidence-based JSON."
        }
      });

      const parsedEval = JSON.parse(response.text || '{}');
      if (
        parsedEval.communicationScore === undefined ||
        parsedEval.technicalScore === undefined ||
        parsedEval.confidenceScore === undefined ||
        typeof parsedEval.summary !== 'string'
      ) {
        throw new Error('AI evaluation did not return required real scoring fields.');
      }
      const communicationScore = clampScore(parsedEval.communicationScore);
      const technicalScore = clampScore(parsedEval.technicalScore);
      const confidenceScore = clampScore(parsedEval.confidenceScore);
      const integrityPenalty = calculateIntegrityPenalty(normalizedLogs);
      const weightedScore = Math.round(
        (communicationScore * 0.3) +
        (technicalScore * 0.45) +
        (confidenceScore * 0.25) -
        integrityPenalty
      );
      const totalScore = clampScore(weightedScore);
      const hasCriticalIntegrityIssue = normalizedLogs.some((log: any) => (
        log?.type === 'compliance-breach' ||
        log?.type === 'multiple-persons' ||
        log?.type === 'ai-tool-detected'
      )) || Number(suspiciousCount || 0) > 3;
      const recommendation = recommendationFromScore(totalScore, hasCriticalIntegrityIssue);

      return res.json({
        evaluation: {
          ...parsedEval,
          communicationScore,
          technicalScore,
          confidenceScore,
          recommendation,
          summary: `${parsedEval.summary} Hiring rate was calculated from the captured transcript, speech metrics, role-fit scoring, and a ${integrityPenalty}-point integrity penalty.`,
          score: totalScore
        }
      });
    } catch (err: any) {
      console.error('Gemini evaluate responses error:', err);
      return res.status(502).json({ error: `AI candidate evaluation failed: ${getReadableGeminiError(err)}` });
    }
  });

  app.post('/api/gemini/proctor-frame', async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      const client = getGeminiClient();

      if (!client) {
        return res.status(503).json({ error: 'GEMINI_API_KEY is required for AI proctor analysis.' });
      }

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({ error: 'A camera frame is required.' });
      }

      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageBase64
            }
          },
          {
            text: `Analyze this live interview proctor camera frame.
Return JSON only:
{
  "faceCount": number of visible human faces,
  "gazeStatus": "centered" | "away" | "unknown",
  "aiToolDetected": boolean,
  "reason": "short factual reason"
}

Strict rules:
- faceCount must be 0 if no candidate face is visible.
- aiToolDetected is true only when a phone, second device, helper screen, notes, another person assisting, or visible AI/chat tool is evident.
- Do not guess emotions. Only report visible compliance evidence.`
          }
        ],
        config: {
          responseMimeType: 'application/json',
          temperature: 0,
          systemInstruction: 'You are a strict remote-interview proctor. Return only factual JSON from the provided frame.'
        }
      } as any);

      const parsed = JSON.parse(response.text || '{}');
      return res.json({
        faceCount: Number.isFinite(Number(parsed.faceCount)) ? Number(parsed.faceCount) : 0,
        gazeStatus: ['centered', 'away', 'unknown'].includes(parsed.gazeStatus) ? parsed.gazeStatus : 'unknown',
        aiToolDetected: Boolean(parsed.aiToolDetected),
        reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 220) : 'AI proctor frame analysis completed.'
      });
    } catch (err: any) {
      console.error('Gemini proctor frame error:', err);
      return res.status(502).json({ error: `AI proctor frame analysis failed: ${getReadableGeminiError(err)}` });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          port: HMR_PORT
        }
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[airecruite] Server running on http://localhost:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err?.code === 'EADDRINUSE') {
      console.error(`[airecruite] Port ${PORT} is already in use. Stop the existing server or run with PORT=${PORT + 1}.`);
      process.exit(1);
    }
    throw err;
  });
}

startServer();
