# airecruite

An AI-powered video interview platform that automates candidate screening through live browser recording, proctoring, transcription, AI-generated questions, AI scoring, and recruiter review.

## Problem Understanding

### What problem are you solving?

Recruiters often need to screen many candidates before a human interview. The early-stage process is repetitive, time-consuming, and difficult to audit consistently. airecruite solves this by giving candidates a structured video interview flow and giving recruiters a review dashboard with recordings, transcripts, scores, and suspicious activity logs.

### Why is this system needed?

Hiring teams need faster shortlisting without losing evidence quality. A resume or form answer is easy to fake and hard to compare across candidates. A recorded, transcribed, proctored assessment gives recruiters a richer screening signal:

- Candidate answers are captured as video, audio-derived transcripts, and speech metrics.
- Recruiters can review the exact question-answer history instead of relying only on AI output.
- Suspicious behavior such as tab switching, missing face, multiple people, or possible external assistance is logged.
- AI helps generate role-aware follow-up questions and summarize performance, while the recruiter remains the final decision maker.

## Architecture Overview

### High-Level System Architecture

```text
Candidate Browser
  React + Vite UI
  MediaRecorder
  Web Speech API
  FaceDetector / camera-frame proctoring
        |
        | REST API calls
        v
Express Server
  Gemini API proxy
  question generation
  transcript evaluation
  proctor frame analysis
        |
        | Supabase client
        v
Supabase
  Auth
  Postgres tables
  Storage bucket: interview-videos
        |
        v
Recruiter Browser
  dashboard
  candidate table
  video playback
  transcript review
  suspicious logs
  AI evaluation
```

Main code locations:

- Frontend app: `airecruite/src/App.tsx`
- Candidate interview components: `airecruite/src/components/CandidateInterviewComponents.tsx`
- Gemini API service: `airecruite/src/services/gemini.ts`
- Supabase service: `airecruite/src/services/supabase.ts`
- Express backend: `airecruite/server.ts`
- Database/storage schema: `airecruite/supabase/schema.sql`

### Media Flow

```text
Frontend camera/mic permission
  -> MediaRecorder records one answer per question as a WebM blob
  -> Web Speech API produces live/interim transcript text
  -> audio meter calculates average volume and speech confidence
  -> frontend submits the completed question chunk
  -> Supabase Storage stores the WebM in interview-videos
  -> Supabase returns a public video URL
  -> response metadata is saved with transcript, duration, volume, confidence
  -> after five questions, Gemini evaluates all transcripts and suspicious logs
  -> candidate record is upserted into Supabase Postgres
  -> recruiter dashboard loads recordings, transcripts, logs, and AI scoring
```

The current implementation chunks by interview question instead of uploading one large final file. Each answer is independently uploaded and attached to the candidate response list.

### WebSocket/Event Flow Explanation

The submitted implementation does not currently run a WebSocket server. The live interview flow is event-driven inside the browser and uses REST calls for backend work:

- Browser events track `blur`, `visibilitychange`, `pagehide`, paste, right click, restricted key combinations, and fullscreen exit.
- Recorder events track `ondataavailable`, `onstop`, speech recognition results, and upload state.
- Proctoring events are emitted from browser face detection and periodic Gemini camera-frame analysis.
- REST endpoints handle `/api/gemini/generate-question`, `/api/gemini/evaluate`, and `/api/gemini/proctor-frame`.

In a production WebSocket version, the same event model would be pushed through a socket channel:

```text
candidate joins interview session
  -> server acknowledges session
  -> client emits recording/proctor/network events
  -> server broadcasts session status to recruiter dashboard
  -> reconnect resumes using candidate id, question id, and last uploaded chunk metadata
```

## Technical Decisions & Tradeoffs

### Why this approach?

I chose a browser-first recording and transcription pipeline because it keeps the candidate experience lightweight. The candidate does not need to install software; the app uses standard browser capabilities: `getUserMedia`, `MediaRecorder`, Web Speech API, browser events, and optional browser face detection.

The backend is intentionally small. Express acts as a secure proxy for Gemini calls so API keys are not exposed to the browser. Supabase handles authentication, relational data, row-level policies, and media storage, which keeps the project practical for a hackathon/submission environment.

### Why streaming/chunking over full upload?

Uploading by question is safer than waiting for a single full interview upload:

- If a later question fails, earlier answers can already be stored.
- Recruiter review maps naturally to question-level clips and transcripts.
- The UI can show progress after each answer instead of waiting until the end.
- Smaller media files reduce the chance of browser memory pressure and upload timeouts.
- AI follow-up questions can use previous answer history immediately.

This project does not do low-level byte streaming to the server; it uses question-level media chunks. That is the right tradeoff for a browser-only MVP because it provides most recovery and review benefits without building custom streaming infrastructure.

### Why this architecture/design?

- React/Vite gives fast iteration and a single-page candidate/recruiter workflow.
- Supabase reduces backend scope by providing auth, database, storage, and policies.
- Gemini is accessed only through the backend so prompts, scoring rules, and keys remain server-side.
- The recruiter dashboard stores raw evidence alongside AI summaries, avoiding an AI-only decision flow.
- Browser-native proctoring is used first, with Gemini frame analysis as an additive signal.

Tradeoffs:

- Browser speech recognition support varies by browser.
- Public Supabase video URLs are convenient for the demo, but production should use signed URLs.
- Client-side proctoring is useful but not tamper-proof.
- REST polling/loading is simpler than WebSockets but less real-time for recruiter monitoring.

## Failure Scenarios & Edge Cases

- Network interruptions: The app checks `navigator.onLine` and periodically measures network speed. Production should persist pending uploads locally and resume them.
- Duplicate chunks: Supabase uploads use generated filenames and `upsert: true`. A production chunk manifest should add deterministic chunk ids to make duplicate uploads idempotent.
- Camera/mic disconnects: Hardware is checked before the interview. If recording cannot start, the candidate sees an error and the recorder becomes inactive.
- Partial upload failures: If a question upload fails, the current flow stops before final candidate submission. Production recovery should retry the exact failed question chunk.
- WebSocket reconnects: No WebSocket server is implemented yet. The intended production strategy is reconnect by session id and compare uploaded chunk manifest with local pending chunks.
- Empty/corrupted media chunks: Empty `MediaRecorder` chunks are ignored. Low transcript length or low average volume creates an `unusual-noise` suspicious log.
- Speech recognition failure: The app still records video, but transcript quality and confidence can be low. The recruiter can review video evidence.
- AI quota or API failure: The backend returns readable Gemini errors and the frontend can fall back to predefined role questions.

## Recovery Mechanisms

### Reconnect Handling

Current recovery is session-level rather than socket-level:

- The app stores the authenticated user through Supabase Auth.
- Candidate results are saved to Supabase after successful uploads/evaluation.
- The hardware check can be rerun if camera, mic, or network checks fail.
- Gemini question generation can fall back to static role questions.

For production WebSocket reconnects, the system should store a session manifest:

```text
candidateId
sessionId
currentQuestionId
uploadedQuestionIds
chunkChecksum
recordingState
lastEventTimestamp
```

On reconnect, the client would ask the server which question chunks are already durable and retry only missing chunks.

### Retry/Recovery Logic

Current retry logic exists at the UX and fallback level:

- Hardware checks can be re-evaluated.
- Speech recognition restarts when the browser ends recognition unexpectedly.
- Gemini question generation falls back to static questions.
- Gemini errors are converted into readable messages for quota/configuration issues.

Future production retry logic:

- Retry Supabase uploads with exponential backoff.
- Store failed blobs in IndexedDB until upload succeeds.
- Add upload status per question: `pending`, `uploading`, `uploaded`, `failed`.
- Add server-side idempotency keys for candidate id + question id.

### Chunk Recovery Strategy

The current chunk unit is one answer/question. The recovery strategy is:

1. Keep each answer as an independent WebM blob.
2. Upload immediately after the candidate submits that answer or the timer ends.
3. Save transcript, duration, average volume, speech confidence, and video URL together.
4. Evaluate only after all five responses are captured.

Production hardening should add local chunk persistence, checksums, retry queues, and a Supabase table for chunk manifests.

### Failure Handling Approach

The system favors explicit failure over silent data loss:

- Missing camera/mic blocks the candidate during hardware check.
- Recording startup failure shows a recorder error.
- Low audio/transcript confidence is logged as suspicious instead of ignored.
- Critical proctoring issues can terminate the interview and save a failed/disqualified record.
- AI evaluation failure prevents submission with misleading generated scores.

## Product Thinking

### Recruiter Experience Considerations

Recruiters need fast comparison and enough evidence to trust a decision. The dashboard focuses on:

- Candidate list, status, score, role, and flags.
- Per-candidate transcript review.
- Video playback for answer verification.
- AI-generated communication, technical, and confidence scores.
- Suspicious logs grouped into recruiter-readable audit evidence.
- Disqualified candidates stored separately for easier compliance review.

### Candidate Experience Considerations

The candidate flow is designed to reduce confusion before the high-stakes portion starts:

- Candidate logs in and enters role/batch code.
- Hardware check validates camera, microphone, permissions, and network.
- Audio playback and speech calibration confirm the candidate can hear and be heard.
- Questions are read aloud with browser speech synthesis.
- The candidate has a clear submit/proceed control per answer.
- Completion screen confirms that recordings, transcripts, and reports were uploaded.

### How Suspicious Activities Are Tracked

Suspicious activities are stored as `SuspiciousLog` entries with id, timestamp, type, and description. Tracked event types include:

- `tab-switched`
- `gaze-drifted`
- `multiple-persons`
- `ai-tool-detected`
- `unusual-noise`
- `camera-disconnected`
- `mic-disconnected`
- `network-interrupted`
- `compliance-breach`

The app tracks browser focus exits, hidden tabs, page leaving, paste/context-menu/restricted keys, fullscreen exit, face count, off-center face position, Gemini frame analysis, low audio, and weak transcript capture.

### UX Decisions Made

- The interview is limited to five questions to keep screening short and comparable.
- Each question is capped at 120 seconds.
- The app warns before terminating for repeated proctoring issues.
- Critical issues are recorded in logs and may move the candidate to disqualified status.
- Recruiter review shows AI output alongside evidence, not as a black-box replacement.

## Scalability Considerations

### What may break at scale?

- Browser-to-Supabase direct uploads may hit bandwidth, quota, or policy limits.
- Public storage URLs are not suitable for sensitive production interviews.
- Gemini API quota can become a bottleneck during concurrent interviews.
- Client-side proctoring can be inconsistent across browsers and devices.
- Loading all candidates at once will become slow as records grow.
- Large video files can increase storage cost and dashboard load time.

### Performance Bottlenecks

- Media upload size and candidate network quality.
- Gemini frame-analysis calls every few seconds.
- AI evaluation latency after the final answer.
- Supabase table scans if recruiter filtering grows without indexes.
- Video playback bandwidth in recruiter dashboards.

### Future Improvements for High Concurrency

- Use signed upload URLs and private buckets.
- Add background upload workers and retry queues.
- Move AI proctor frame analysis to a queue with rate limits.
- Add pagination and indexed filters for recruiter dashboards.
- Store media metadata and chunk manifests separately.
- Add WebSocket or server-sent events for live recruiter monitoring.
- Add CDN-backed video delivery with signed access.
- Add server-side job processing for evaluation and proctor summaries.

## Observability & Debugging

### Logging Strategy

The project currently logs important client and server events:

- Supabase storage/auth failures surface through thrown errors or UI messages.
- Gemini API failures are logged on the server and converted to readable errors.
- Client services log AI proxy and storage actions in the browser console.
- Suspicious activities are persisted in candidate records for recruiter audit.

### Error Tracking

Current implementation uses local logging and user-visible errors. A production deployment should add:

- Sentry or similar frontend/backend exception tracking.
- Structured server logs with request ids.
- Supabase upload and database error metrics.
- Gemini status, latency, and quota dashboards.
- Candidate session ids included in all logs.

### How Production Failures Can Be Debugged

For a failed interview, debug in this order:

1. Check candidate record in Supabase `candidates` or `disqualified_candidates`.
2. Inspect `responses` JSON for missing video URLs, empty transcripts, or low confidence.
3. Inspect `suspiciousLogs` for network, device, tab, gaze, or AI-tool events.
4. Check Supabase Storage bucket `interview-videos` for expected WebM files.
5. Review Express server logs for Gemini or upload errors.
6. Check browser console logs from the candidate session if reproducible.

## AI Usage Documentation

### How AI Tools Were Used

AI is used in three places inside the product:

- Gemini generates dynamic interview questions based on role and prior answer history.
- Gemini evaluates final transcripts and suspicious logs into communication, technical, confidence, recommendation, and summary fields.
- Gemini also analyzes periodic camera frames for face count, gaze status, and possible visible external assistance.

AI assistance was also used during development/documentation to help organize README sections, explain architecture tradeoffs, and phrase edge-case handling clearly.

### Prompts/Thought Process Used

Product prompts in the app are defined in `airecruite/server.ts`. The main prompt patterns are:

- Generate exactly one professional interview question for a given role and question number.
- Use previous answer history to create logical follow-up questions.
- Evaluate only supplied transcripts and suspicious logs.
- Return conservative, evidence-based JSON.
- Penalize vague, unrelated, silent, or suspicious responses.
- Analyze proctor frames factually without guessing emotions.

Documentation thought process:

- Start from the actual implemented flow instead of writing a generic architecture.
- Separate current behavior from future production hardening.
- Call out that WebSockets are not implemented yet, while still explaining the intended event/reconnect design.
- Treat AI as decision support, not the final hiring authority.

### Decisions That Were Mine vs AI-Assisted

Human/project decisions:

- Building a browser-based candidate interview experience.
- Using React, Express, Supabase, and Gemini.
- Recording one clip per question.
- Storing recruiter-reviewable evidence.
- Tracking suspicious activity during interviews.
- Keeping recruiters in the decision loop.

AI-assisted areas:

- Dynamic wording of interview questions.
- AI scoring and summary generation from transcripts.
- Camera-frame proctor analysis.
- README organization and clearer explanation of tradeoffs.

## Demo & Walkthrough

### Setup Instructions

Prerequisites:

- Node.js
- Supabase project
- Gemini API key

Run locally:

```bash
cd airecruite
npm install
cp .env.example .env.local
```

On Windows PowerShell, use this instead of `cp` if needed:

```powershell
Copy-Item .env.example .env.local
```

Update `.env.local`:

```env
GEMINI_API_KEY="your_gemini_api_key"
GEMINI_MODEL="gemini-2.0-flash"
VITE_SUPABASE_URL="your_supabase_project_url"
VITE_SUPABASE_ANON_KEY="your_supabase_anon_key"
PORT="3000"
HMR_PORT="24678"
```

Create Supabase tables and storage:

1. Open Supabase Dashboard.
2. Go to SQL Editor.
3. Run `airecruite/supabase/schema.sql`.
4. Confirm the `interview-videos` bucket exists.

Start the app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

### Demo Video

Demo video: add your submitted recording link here.

```text
TODO: https://...
```

### Live Link

Live link, if deployed:

```text
TODO: https://...
```

### System Walkthrough

1. Candidate signs up or signs in.
2. Candidate enters role and batch code.
3. Candidate completes hardware, speaker, and microphone calibration.
4. App starts a five-question interview.
5. For each question, the browser records camera/mic as a WebM clip.
6. Browser speech recognition captures the transcript.
7. Proctoring logs tab exits, focus loss, suspicious shortcuts, face drift, multiple people, possible AI-tool assistance, and low audio confidence.
8. Each question clip uploads to Supabase Storage.
9. After five answers, transcripts and suspicious logs are sent to Gemini for scoring.
10. Final candidate record is saved to Supabase.
11. Recruiter signs in, opens the dashboard, filters candidates, reviews video clips/transcripts, checks suspicious logs, and reads AI scoring.
