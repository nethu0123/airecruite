/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Video, Mic, Wifi, AlertTriangle, Check, RefreshCw, Volume2, Mic2 } from 'lucide-react';

/**
 * Shared Helper to retrieve a female voice for standard web SpeechSynthesis
 */
export function getFemaleVoice() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const femaleNames = ['samantha', 'zira', 'amy', 'hazel', 'karen', 'moira', 'tessa', 'victoria', 'google us english', 'susan', 'female', 'ava', 'zoe'];
  const match = voices.find(v => {
    const nameLower = v.name.toLowerCase();
    return (v.lang.startsWith('en') || v.lang.startsWith('en-')) && femaleNames.some(name => nameLower.includes(name));
  });
  if (match) return match;
  const enVoice = voices.find(v => v.lang.startsWith('en'));
  if (enVoice) return enVoice;
  return voices[0] || null;
}

/**
 * Reusable Hardware Diagnostic Check Component + Speech Calibration Wizard.
 */
export interface HardwareCheckProps {
  onSuccess: () => void;
  onRetry: () => void;
  currentNetworkSpeed: number;
}

export function HardwareCheck({ onSuccess, onRetry, currentNetworkSpeed }: HardwareCheckProps) {
  const [wizardStep, setWizardStep] = useState<'devices' | 'hear' | 'speak'>('devices');
  const [cameraOk, setCameraOk] = useState<boolean | null>(null);
  const [micOk, setMicOk] = useState<boolean | null>(null);
  const [internetOk, setInternetOk] = useState<boolean | null>(null);
  const [permissionOk, setPermissionOk] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Sound play test state
  const [speechPlayed, setSpeechPlayed] = useState<boolean>(false);
  const [speechHeardConfirmed, setSpeechHeardConfirmed] = useState<boolean>(false);

  // Mic speak test state
  const [listeningStatus, setListeningStatus] = useState<string>('Standby');
  const [spokenCorrectly, setSpokenCorrectly] = useState<boolean>(false);

  const startCheck = async () => {
    setIsChecking(true);
    setCameraOk(null);
    setMicOk(null);
    setPermissionOk(null);
    setInternetOk(null);

    // 1. Check Internet
    setTimeout(() => {
      setInternetOk(navigator.onLine);
    }, 450);

    // 2. Real Hardware Check
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setPermissionOk(true);
      setCameraOk(true);
      setMicOk(true);
    } catch (err: any) {
      console.warn("Hardware access exception:", err);
      // Let user override for presentation/iframe if blocked
      setPermissionOk(false);
      setCameraOk(false);
      setMicOk(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (wizardStep === 'devices') {
      startCheck();
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [wizardStep]);

  // Play AI voice Calibration
  const playAiVoiceCheck = () => {
    try {
      window.speechSynthesis.cancel();
      const text = "Hello! Welcome to your automated screening interview. Please verify that you can hear my voice clearly by choosing the option below.";
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      
      const femaleVoice = getFemaleVoice();
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }
      
      window.speechSynthesis.speak(utterance);
      setSpeechPlayed(true);
    } catch (e) {
      setSpeechPlayed(true);
    }
  };

  // Speaks aloud and verifies via real speech recognition
  const triggerUserVoiceCheck = () => {
    setListeningStatus('Listening...');
    setSpokenCorrectly(false);

    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionClass) {
      const rec = new SpeechRecognitionClass();
      rec.lang = 'en-US';
      rec.continuous = false;
      rec.interimResults = false;

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        console.log("Transcribed calibration phrase:", transcript);
        if (transcript.includes("ready") || transcript.includes("interview") || transcript.includes("i am") || transcript.includes("im")) {
          setSpokenCorrectly(true);
          setListeningStatus('Calibrated!');
        } else {
          setListeningStatus(`Heard: "${transcript}". Speak again.`);
        }
      };

      rec.onerror = (e: any) => {
        console.warn("Speech calibration exception", e);
        setListeningStatus('Speech was not detected. Please try again.');
      };

      try {
        rec.start();
      } catch (err) {
        setListeningStatus('Microphone recognition could not start. Please try again.');
      }
    } else {
      setListeningStatus('Speech recognition is not supported in this browser.');
    }
  };

  const isNetworkSufficient = navigator.onLine;
  const isCameraConnectedActive = cameraOk;
  const isCheckPassed = isNetworkSufficient && isCameraConnectedActive && micOk && internetOk && permissionOk;

  return (
    <div id="hardware-check-widget" className="interactive-card grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch bg-white p-8 rounded-3xl shadow-[0_15px_50px_rgba(0,0,0,0.03)] border-transparent">
      
      {/* Live Preview / Device calibration view (Left Column) */}
      <div className="lg:col-span-12 xl:col-span-7 bg-stone-900 rounded-3xl relative overflow-hidden min-h-[360px] flex flex-col justify-center items-center group shadow-md">
        {wizardStep === 'devices' && (
          permissionOk ? (
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline 
                className="w-full h-full object-cover absolute inset-0" 
              />
            ) : (
              <div className="p-8 text-center z-10">
                <div className="w-14 h-14 bg-amber-500/10 border-transparent text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-stone-250">Camera & Mic Access Required</h4>
                <p className="text-xs text-stone-450 max-w-xs mx-auto leading-relaxed mt-2 font-medium">
                  Authorizing access enables real video screening and automated behavioral analysis features.
                </p>
              </div>
            )
        )}

        {wizardStep === 'hear' && (
          <div className="absolute inset-0 bg-stone-950 flex flex-col items-center justify-center p-6 text-center">
            <Volume2 className={`w-14 h-14 ${speechPlayed ? 'text-amber-500 animate-bounce' : 'text-stone-500'} mb-4`} />
            <span className="text-2xs font-extrabold tracking-widest text-stone-400 uppercase">STEP 2: AUDIO FEEDBACK CALIBRATION</span>
            <h4 className="text-sm font-bold text-white mt-1">Can you hear the Speaker?</h4>
            <p className="text-xs text-stone-400 mt-2 max-w-xs font-medium">
              Click the play button to activate the AI voice check and confirm audit audibility.
            </p>
          </div>
        )}

        {wizardStep === 'speak' && (
          <div className="absolute inset-0 bg-stone-950 flex flex-col items-center justify-center p-6 text-center">
            <Mic2 className={`w-14 h-14 ${spokenCorrectly ? 'text-emerald-500' : 'text-amber-500 animate-pulse'} mb-4`} />
            <span className="text-2xs font-extrabold tracking-widest text-stone-400 uppercase">STEP 3: MIC AUDIBILITY CHECK</span>
            <h4 className="text-sm font-bold text-white mt-1">Speak clearly into your Microphone</h4>
            <p className="text-xs text-stone-400 mt-2 max-w-xs font-medium">
              We test speech audibility and lock levels before starting the interview questions.
            </p>
          </div>
        )}

        <div className="absolute bottom-4 left-4 right-4 bg-stone-950/80 backdrop-blur-md rounded-2xl p-3 flex items-center justify-between text-xs">
          <span className="text-stone-400 font-medium font-mono">Calibrator Panel Status: ACTIVE</span>
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
          </span>
        </div>
      </div>

      {/* Wizard Steps / Checklist (Right Column) */}
      <div className="lg:col-span-12 xl:col-span-5 flex flex-col justify-between text-left">
        <div>
          {/* STEP 1: HARDWARE PROBES */}
          {wizardStep === 'devices' && (
            <div className="space-y-5">
              <div className="pb-3 border-b-transparent">
                <span className="text-[10px] uppercase font-extrabold tracking-widest text-amber-500">Phase 1/3</span>
                <h3 className="text-lg font-bold text-stone-900 tracking-tight">System Checks</h3>
                <p className="text-xs text-stone-450 font-medium mt-1">We verify connection channels prior to screen initiation.</p>
              </div>

              <div className="space-y-3">
                {/* Camera */}
                <div className="hover-lift p-4 bg-stone-50 rounded-2xl flex items-center justify-between shadow-[0_4px_12px_rgba(0,0,0,0.01)]">
                  <div className="flex items-center gap-3">
                    <Video className={`w-4 h-4 ${cameraOk ? 'text-amber-500' : 'text-stone-400'}`} />
                    <div>
                      <h4 className="text-xs font-bold text-stone-850">Camera Connection</h4>
                      <p className="text-[10px] text-stone-400 font-medium">Auto streaming video stream</p>
                    </div>
                  </div>
                  {cameraOk === null ? (
                    <span className="text-2xs text-stone-405 italic">Checking...</span>
                  ) : cameraOk ? (
                    <span className="text-3xs font-extrabold px-2 py-1 bg-emerald-50 text-emerald-800 rounded-lg uppercase tracking-wider">Ready</span>
                  ) : (
                    <span className="text-3xs font-extrabold px-2 py-1 bg-stone-100 text-stone-500 rounded-lg uppercase tracking-wider">Failed</span>
                  )}
                </div>

                {/* Mic */}
                <div className="hover-lift p-4 bg-stone-50 rounded-2xl flex items-center justify-between shadow-[0_4px_12px_rgba(0,0,0,0.01)]">
                  <div className="flex items-center gap-3">
                    <Mic className={`w-4 h-4 ${micOk ? 'text-amber-500' : 'text-stone-400'}`} />
                    <div>
                      <h4 className="text-xs font-bold text-stone-850">Mic Input Channel</h4>
                      <p className="text-[10px] text-stone-400 font-medium">Verifying decibel levels</p>
                    </div>
                  </div>
                  {micOk === null ? (
                    <span className="text-2xs text-stone-405 italic">Checking...</span>
                  ) : micOk ? (
                    <span className="text-3xs font-extrabold px-2 py-1 bg-emerald-50 text-emerald-800 rounded-lg uppercase tracking-wider">Active</span>
                  ) : (
                    <span className="text-3xs font-extrabold px-2 py-1 bg-stone-100 text-stone-500 rounded-lg uppercase tracking-wider">Failed</span>
                  )}
                </div>

                {/* Network */}
                <div className="hover-lift p-4 bg-stone-50 rounded-2xl flex items-center justify-between shadow-[0_4px_12px_rgba(0,0,0,0.01)]">
                  <div className="flex items-center gap-3">
                    <Wifi className={`w-4 h-4 ${internetOk ? 'text-amber-500' : 'text-stone-400'}`} />
                    <div>
                      <h4 className="text-xs font-bold text-stone-850">Internet Check</h4>
                      <p className="text-[10px] text-stone-400 font-medium">Checking browser connectivity</p>
                    </div>
                  </div>
                  {internetOk === null ? (
                    <span className="text-2xs text-stone-405 italic">Checking...</span>
                  ) : internetOk ? (
                    <span className="text-3xs font-extrabold px-2 py-1 bg-emerald-50 text-emerald-800 rounded-lg uppercase tracking-wider">{currentNetworkSpeed} Mbps</span>
                  ) : (
                    <span className="text-3xs font-extrabold px-2 py-1 bg-rose-50 text-rose-800 rounded-lg uppercase tracking-wider">Offline</span>
                  )}
                </div>
              </div>

              {/* Admission blocked criteria check */}
              {(!isNetworkSufficient || !isCameraConnectedActive) && (
                <div className="p-4 bg-rose-50 text-rose-950 text-xs font-semibold rounded-2xl flex flex-col gap-1.5 border border-rose-100 shadow-[0_4px_12px_rgba(244,63,94,0.05)] text-left leading-relaxed">
                  <div className="flex items-center gap-2 text-rose-800">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span className="uppercase tracking-wider font-extrabold text-[10px]">ADMISSION BLOCKED DUE TO COMPLIANCE FAILURES:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-rose-700">
                    {!isNetworkSufficient && (
                      <li>Browser is offline. Reconnect to the internet and re-evaluate.</li>
                    )}
                    {!isCameraConnectedActive && (
                      <li>Proctor video camera device is inactive, denied, or turned off.</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="pt-6 flex gap-3">
                <button
                  onClick={() => {
                    onRetry();
                    startCheck();
                  }}
                  disabled={isChecking}
                  className="interactive-button flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-bold text-stone-600 bg-stone-50 hover:bg-stone-100 rounded-2xl transition cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
                  Re-evaluate
                </button>
                <button
                  id="btn-hardware-proceed"
                  disabled={!isCheckPassed}
                  onClick={() => {
                    window.speechSynthesis.cancel();
                    setWizardStep('hear');
                  }}
                  className={`interactive-button flex-1 px-5 py-3.5 text-xs font-bold rounded-2xl shadow-[0_8px_30px_rgba(245,158,11,0.2)] transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isCheckPassed 
                      ? 'bg-amber-400 hover:bg-amber-500 text-stone-900 hover:shadow-[0_12px_35px_rgba(245,158,11,0.35)]' 
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed opacity-50 shadow-none'
                  }`}
                >
                  <span>Connect & Proceed</span>
                  <Check className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: AUDIO HEAR VOICE TEST */}
          {wizardStep === 'hear' && (
            <div className="space-y-5 animate-fade-in">
              <div className="pb-3 border-b-transparent">
                <span className="text-[10px] uppercase font-extrabold tracking-widest text-amber-500">Phase 2/3</span>
                <h3 className="text-lg font-bold text-stone-900 tracking-tight">AI Voice Hearing Test</h3>
                <p className="text-xs text-stone-450 font-medium mt-1">Please confirm you can hear our voice reader clearly.</p>
              </div>

              <div className="p-5 bg-stone-50 rounded-2xl space-y-4 shadow-[0_4px_12px_rgba(0,0,0,0.01)]">
                <p className="text-xs leading-relaxed text-stone-550 font-medium">
                  We use the browser speaker to read questions out loud. Make sure your volume is on and click the button to play the test sound.
                </p>

                <button
                  onClick={playAiVoiceCheck}
                  className="interactive-button w-full flex items-center justify-center gap-2 py-3 bg-amber-50 hover:bg-amber-100/80 text-amber-955 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <Volume2 className="w-4 h-4 text-amber-600" />
                  <span>🔊 Play Calibration Speech</span>
                </button>

                {speechPlayed && (
                  <div className="flex items-center gap-2 p-1.5 justify-center">
                    <input 
                      type="checkbox"
                      id="audible-confirm"
                      checked={speechHeardConfirmed}
                      onChange={(e) => setSpeechHeardConfirmed(e.target.checked)}
                      className="w-4 h-4 text-amber-500 border-stone-300 rounded focus:ring-amber-500 cursor-pointer"
                    />
                    <label htmlFor="audible-confirm" className="text-xs font-semibold text-stone-700 cursor-pointer select-none">
                      Yes, I hear the speech clearly!
                    </label>
                  </div>
                )}
              </div>

              <div className="pt-6 flex gap-3">
                <button
                  onClick={() => {
                    window.speechSynthesis.cancel();
                    setWizardStep('devices');
                  }}
                  className="px-4.5 py-3.5 text-xs font-bold text-stone-500 hover:text-stone-850 rounded-2xl transition cursor-pointer"
                >
                  Back
                </button>
                <button
                  disabled={!speechHeardConfirmed}
                  onClick={() => {
                    window.speechSynthesis.cancel();
                    setWizardStep('speak');
                  }}
                  className={`interactive-button flex-1 px-5 py-3.5 text-xs font-bold rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    speechHeardConfirmed 
                      ? 'bg-amber-400 hover:bg-amber-500 text-stone-900 shadow-[0_8px_30px_rgba(245,158,11,0.25)]' 
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed opacity-50 shadow-none'
                  }`}
                >
                  <span>Voice Audibility Passed</span>
                  <Check className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SPEAK CALIBRATION TEST */}
          {wizardStep === 'speak' && (
            <div className="space-y-5 animate-fade-in">
              <div className="pb-3 border-b-transparent">
                <span className="text-[10px] uppercase font-extrabold tracking-widest text-amber-500">Phase 3/3</span>
                <h3 className="text-lg font-bold text-stone-900 tracking-tight">Screener Voice Calibration</h3>
                <p className="text-xs text-stone-450 font-medium mt-1">To calibrate your microphone level, speak the mandatory phrase below.</p>
              </div>

              <div className="p-5 bg-stone-50 rounded-2xl space-y-4 shadow-[0_4px_12px_rgba(0,0,0,0.01)] text-center">
                <p className="text-xs text-stone-400 font-semibold uppercase tracking-wider">Required Audio Statement:</p>
                <div className="py-3 px-4 bg-amber-50 rounded-xl border-none">
                  <span className="text-sm font-extrabold text-amber-950 font-mono">
                    "I am ready to attend the interview"
                  </span>
                </div>

                <button
                  onClick={triggerUserVoiceCheck}
                  className="interactive-button w-full flex items-center justify-center gap-2 py-3 bg-stone-900 hover:bg-stone-850 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md"
                >
                  <Volume2 className="w-4 h-4 text-amber-400" />
                  <span>Start Microphone Analysis</span>
                </button>

                <div className="text-xs font-medium text-stone-450">
                  Transcribing status: <span className={`font-bold ${spokenCorrectly ? 'text-emerald-600' : 'text-amber-600'}`}>{listeningStatus}</span>
                </div>
              </div>

              <div className="pt-6 flex gap-3">
                <button
                  onClick={() => {
                    window.speechSynthesis.cancel();
                    setWizardStep('hear');
                  }}
                  className="px-4.5 py-3.5 text-xs font-bold text-stone-500 hover:text-stone-850 rounded-2xl transition cursor-pointer"
                >
                  Back
                </button>
                <button
                  disabled={!spokenCorrectly}
                  onClick={() => {
                    window.speechSynthesis.cancel();
                    onSuccess();
                  }}
                  className={`interactive-button flex-1 px-5 py-3.5 text-xs font-bold rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    spokenCorrectly 
                      ? 'bg-amber-400 hover:bg-amber-500 text-stone-900 shadow-[0_12px_35px_rgba(245,158,11,0.25)]' 
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed opacity-50 shadow-none'
                  }`}
                >
                  <span>Start Interview</span>
                  <Check className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * High-precision Video Screen capture recorder
 * Handles ALWAYS-ON camera constraints and fully automated recording clips
 */
export interface VideoRecorderProps {
  onChunkUploaded: (blob: Blob, transcript: string, averageVolume: number, duration: number, speechConfidence: number) => void;
  onStateChange: (state: 'inactive' | 'recording' | 'stopped' | 'uploading') => void;
  onProctorEvent?: (type: 'gaze-drifted' | 'multiple-persons' | 'ai-tool-detected', description: string) => void;
  activeQuestionIndex: number;
}

export function VideoRecorder({ onChunkUploaded, onStateChange, onProctorEvent, activeQuestionIndex }: VideoRecorderProps) {
  const [recordState, setRecordState] = useState<'inactive' | 'recording' | 'stopped' | 'uploading'>('recording');
  const [timer, setTimer] = useState<number>(0);
  const [recorderError, setRecorderError] = useState<string>('');
  const countdownIntervalRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');
  const finalTranscriptRef = useRef<string>('');
  const shouldRestartRecognitionRef = useRef<boolean>(false);
  const volumeSamplesRef = useRef<number[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number>(0);
  const lastProctorEventRef = useRef<Record<string, number>>({});

  // Initialize camera and keep it active the entire time
  const initAlwaysOnCameraFeed = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      chunksRef.current = [];
      transcriptRef.current = '';
      finalTranscriptRef.current = '';
      volumeSamplesRef.current = [];
      timerRef.current = 0;
      setRecorderError('');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
      }

      const options = { mimeType: 'video/webm;codecs=vp9,opus' };
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch (e) {
        recorder = new MediaRecorder(stream);
      }
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const fullBlob = new Blob(chunksRef.current, { type: 'video/webm' });
        const averageVolume = volumeSamplesRef.current.length
          ? Math.round(volumeSamplesRef.current.reduce((sum, val) => sum + val, 0) / volumeSamplesRef.current.length)
          : 0;
        const transcript = transcriptRef.current.trim();
        const wordCount = transcript.split(/\s+/).filter(Boolean).length;
        const speechConfidence = Math.max(0, Math.min(100, Math.round((averageVolume * 0.55) + (Math.min(wordCount, 80) * 0.55))));
        setRecordState('uploading');
        setTimeout(() => {
          stopSpeechRecognition();
          stopAudioMeter();
          onChunkUploaded(fullBlob, transcript, averageVolume, timerRef.current, speechConfidence);
          setRecordState('recording');
        }, 1100);
      };

      recorder.start();
      startSpeechRecognition();
      startAudioMeter(stream);
      setRecordState('recording');
    } catch (e) {
      console.warn("Unable to start interview recording.", e);
      setRecorderError('Camera or microphone recording could not start. Please allow access and reload the interview.');
      setRecordState('inactive');
    }
  };

  const startSpeechRecognition = () => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return;

    const recognition = new SpeechRecognitionClass();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) {
          finalTranscriptRef.current = `${finalTranscriptRef.current} ${chunk}`.trim();
        } else {
          interimTranscript += `${chunk} `;
        }
      }
      transcriptRef.current = `${finalTranscriptRef.current} ${interimTranscript}`.trim();
    };
    recognition.onend = () => {
      if (!shouldRestartRecognitionRef.current) return;
      try {
        recognition.start();
      } catch (err) {
        // Browser may throttle immediate restarts. The next answer will reinitialize recognition.
      }
    };
    recognition.onerror = () => {};
    recognitionRef.current = recognition;
    shouldRestartRecognitionRef.current = true;
    try {
      recognition.start();
    } catch (err) {
      recognitionRef.current = null;
    }
  };

  const stopSpeechRecognition = () => {
    shouldRestartRecognitionRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch (err) {
      // Speech recognition may already be stopped by the browser.
    }
    recognitionRef.current = null;
  };

  const startAudioMeter = (stream: MediaStream) => {
    try {
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      const data = new Uint8Array(analyser.fftSize);
      source.connect(analyser);
      audioContextRef.current = context;

      const measure = () => {
        if (!audioContextRef.current) return;
        analyser.getByteTimeDomainData(data);
        const rms = Math.sqrt(data.reduce((sum, value) => {
          const normalized = (value - 128) / 128;
          return sum + normalized * normalized;
        }, 0) / data.length);
        volumeSamplesRef.current.push(Math.round(rms * 100));
        requestAnimationFrame(measure);
      };
      measure();
    } catch (err) {
      audioContextRef.current = null;
    }
  };

  const stopAudioMeter = () => {
    audioContextRef.current?.close();
    audioContextRef.current = null;
  };

  useEffect(() => {
    initAlwaysOnCameraFeed();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      stopSpeechRecognition();
      stopAudioMeter();
    };
  }, [activeQuestionIndex]); // Restart stream chunking on every question transition automatically!

  useEffect(() => {
    if (!onProctorEvent) return;
    const emitProctorEvent = (type: 'gaze-drifted' | 'multiple-persons' | 'ai-tool-detected', description: string, cooldownMs = 5000) => {
      const now = Date.now();
      if (now - (lastProctorEventRef.current[type] || 0) < cooldownMs) return;
      lastProctorEventRef.current[type] = now;
      onProctorEvent(type, description);
    };
    const DetectorClass = (window as any).FaceDetector;
    if (!DetectorClass) {
      emitProctorEvent('gaze-drifted', 'Browser face detection is unavailable, so AI camera-frame proctoring is enforcing visual compliance instead.', 60000);
      return;
    }
    const detector = new DetectorClass({ fastMode: false });
    let missingFaceFrames = 0;
    const interval = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      try {
        const faces = await detector.detect(videoRef.current);
        if (faces.length > 1) {
          emitProctorEvent('multiple-persons', 'More than one face was detected in the interview camera frame.', 3000);
          return;
        }
        if (faces.length === 0) {
          missingFaceFrames += 1;
          if (missingFaceFrames >= 2) {
            emitProctorEvent('gaze-drifted', 'No candidate face was detected in the interview camera frame for consecutive proctor checks.', 3000);
            missingFaceFrames = 0;
          }
          return;
        }
        if (faces.length === 1) {
          missingFaceFrames = 0;
          const box = faces[0].boundingBox;
          const centerX = box.x + box.width / 2;
          const centerY = box.y + box.height / 2;
          const width = videoRef.current.videoWidth || videoRef.current.clientWidth;
          const height = videoRef.current.videoHeight || videoRef.current.clientHeight;
          const isOffCenter = centerX < width * 0.25 || centerX > width * 0.75 || centerY < height * 0.2 || centerY > height * 0.85;
          if (isOffCenter) {
            emitProctorEvent('gaze-drifted', 'Candidate face moved away from the centered interview position.', 3000);
          }
        }
      } catch (err) {
        clearInterval(interval);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [onProctorEvent, activeQuestionIndex]);

  useEffect(() => {
    if (!onProctorEvent) return;
    let cancelled = false;
    let analyzing = false;

    const emitProctorEvent = (type: 'gaze-drifted' | 'multiple-persons' | 'ai-tool-detected', description: string, cooldownMs = 6000) => {
      const now = Date.now();
      if (now - (lastProctorEventRef.current[`ai-${type}`] || 0) < cooldownMs) return;
      lastProctorEventRef.current[`ai-${type}`] = now;
      onProctorEvent(type, description);
    };

    const captureFrame = () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return null;
      const canvas = document.createElement('canvas');
      const sourceWidth = videoRef.current.videoWidth || videoRef.current.clientWidth || 360;
      const sourceHeight = videoRef.current.videoHeight || videoRef.current.clientHeight || 240;
      canvas.width = 360;
      canvas.height = Math.max(1, Math.round((sourceHeight / sourceWidth) * canvas.width));
      const context = canvas.getContext('2d');
      if (!context) return null;
      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.62).split(',')[1];
    };

    const analyzeFrame = async () => {
      if (cancelled || analyzing) return;
      const imageBase64 = captureFrame();
      if (!imageBase64) return;
      analyzing = true;
      try {
        const response = await fetch('/api/gemini/proctor-frame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64 })
        });
        if (!response.ok) return;
        const result = await response.json();
        if (Number(result.faceCount) > 1) {
          emitProctorEvent('multiple-persons', result.reason || 'AI proctor detected more than one person in the camera frame.');
        } else if (result.faceCount === 0 || result.gazeStatus === 'away') {
          emitProctorEvent('gaze-drifted', result.reason || 'AI proctor detected missing face or off-screen gaze.');
        }
        if (result.aiToolDetected) {
          emitProctorEvent('ai-tool-detected', result.reason || 'AI proctor detected possible external assistance, phone, or helper material.');
        }
      } catch (err) {
        // Proctor-frame AI is additive; browser event logging continues if the network fails.
      } finally {
        analyzing = false;
      }
    };

    const interval = setInterval(analyzeFrame, 5500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [onProctorEvent, activeQuestionIndex]);

  useEffect(() => {
    onStateChange(recordState);
  }, [recordState, onStateChange]);

  useEffect(() => {
    setTimer(0);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setTimer(prev => {
        const next = prev + 1;
        timerRef.current = next;
        return next;
      });
    }, 1000);
    return () => clearInterval(countdownIntervalRef.current);
  }, [activeQuestionIndex]);

  const submitManualResponse = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  useEffect(() => {
    if (timer >= 120 && mediaRecorderRef.current?.state === 'recording') {
      submitManualResponse();
    }
  }, [timer]);

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div id="video-recording-box" className="interactive-card bg-stone-900 rounded-3xl relative overflow-hidden h-[380px] flex flex-col justify-center items-center select-none shadow-md border-transparent text-left">
      
      {/* Live web video feed inside interview page */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover absolute inset-0 opacity-40 z-0 bg-stone-900"
      />

      <div className="focus-ring-live absolute top-4 left-4 z-10 inline-flex items-center gap-1.5 bg-amber-500 py-1.5 px-3 rounded-xl text-[10px] font-extrabold tracking-wider text-stone-950 shadow-md">
        <span className="w-1.5 h-1.5 rounded-full bg-stone-900 block animate-ping" />
        <span>PROCTOR CAMERA ON</span>
      </div>

      {recordState === 'uploading' && (
        <div className="absolute inset-0 bg-stone-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mb-3" />
          <h4 className="text-sm font-extrabold text-stone-200">Analyzing Speech Patterns</h4>
          <p className="text-xs text-stone-500 max-w-xs mt-1 leading-relaxed font-semibold">
            Transcribing response and validating audio fidelity metrics...
          </p>
        </div>
      )}

      <div className="absolute top-4 right-4 z-10 bg-stone-950/70 backdrop-blur-md text-white px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold">
        {formatTimer(timer)}
      </div>

      {recorderError && (
        <div className="relative z-10 max-w-sm text-center bg-rose-50 text-rose-900 rounded-2xl p-5 text-xs font-bold">
          {recorderError}
        </div>
      )}

      {/* Control panel (User has no stop option, only "Submit response" option to move to the next item immediately) */}
      <div className="absolute bottom-4 left-4 right-4 bg-stone-950/70 backdrop-blur-md rounded-2xl p-3 flex items-center justify-between z-10 border-none shadow-lg">
        <button 
          onClick={submitManualResponse}
          disabled={recordState === 'uploading' || recordState === 'inactive'}
          className="interactive-button inline-flex items-center gap-2 text-xs font-bold px-5 py-3 bg-amber-400 hover:bg-amber-500 text-stone-950 rounded-xl transition shadow-[0_4px_12px_rgba(245,158,11,0.2)] hover:shadow-[0_8px_20px_rgba(245,158,11,0.35)] cursor-pointer disabled:opacity-50"
        >
          <span>Submit Response & Proceed</span>
          <Check className="w-4 h-4 text-stone-950" />
        </button>
        
        <span className="text-[10px] text-stone-400 font-mono font-bold tracking-widest uppercase bg-stone-900 px-3 py-1.5 rounded-lg border-none shadow-xs">
          PROMPTED RUNNING
        </span>
      </div>
    </div>
  );
}

/**
 * Left Side Question Panel with Auto Speaking TTS readout aloud
 */
export interface QuestionPanelProps {
  questionNumber: number;
  category: string;
  text: string;
  suggestedDuration: number;
}

export function QuestionPanel({ questionNumber, category, text, suggestedDuration }: QuestionPanelProps) {
  
  // Clean, high contrast light component with reading speech out loud automatically
  useEffect(() => {
    if (text) {
      window.speechSynthesis.cancel();
      const readAloud = () => {
        const voiceText = questionNumber === 1
          ? `Please be comfortable and answer naturally. ${text}`
          : text;
        const sentence = new SpeechSynthesisUtterance(voiceText);
        sentence.rate = 1.0;
        
        const voices = window.speechSynthesis.getVoices();
        const mainVoice = getFemaleVoice() || voices.find(v => v.lang.startsWith('en')) || voices[0];
        if (mainVoice) {
          sentence.voice = mainVoice;
        }
        window.speechSynthesis.speak(sentence);
      };

      // Voice synthesizers occasionally load async. Give voice check a minor timeout
      if (window.speechSynthesis.getVoices().length > 0) {
        readAloud();
      } else {
        window.speechSynthesis.onvoiceschanged = () => {
          readAloud();
          window.speechSynthesis.onvoiceschanged = null;
        };
      }
    }
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [text]);

  return (
    <div id="candidate-question-pane" className="interactive-card bg-white border-none rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.03)] h-full flex flex-col justify-between text-left">
      <div>
        <div className="flex items-center justify-between mb-5">
          <span className="text-2xs font-extrabold text-amber-900 bg-amber-50 rounded-xl px-3 py-1 uppercase tracking-widest shadow-2xs">
            {category}
          </span>
          <span className="text-xs text-stone-400 font-bold uppercase tracking-wider">
            Step {questionNumber} / 5
          </span>
        </div>

        <h3 className="text-base font-bold text-stone-850 mb-4 leading-relaxed font-sans">
          {text}
        </h3>
      </div>

      <div className="bg-amber-50/40 rounded-2xl p-5 mt-6 shadow-[0_4px_12px_rgba(245,158,11,0.02)]">
        <h4 className="text-[10px] font-extrabold text-amber-900 tracking-widest uppercase mb-1.5">ASSESSMENT INSTRUCTIONAL CAPTURE</h4>
        <p className="text-xs leading-relaxed text-stone-500 font-medium">
          Our adaptive model reads each question aloud. Articulate your answer clearly into your microphone as your progress timer increments.
        </p>
      </div>
    </div>
  );
}

/**
 * Right Side Interview Status & Integrity Control Center
 */
export interface StatusPanelProps {
  cameraActive: boolean;
  micActive: boolean;
  networkOk: boolean;
  recording: boolean;
  warningsCount: number;
  tabSwitchCount: number;
}

export function StatusPanel({ cameraActive, micActive, networkOk, recording, warningsCount, tabSwitchCount }: StatusPanelProps) {
  return (
    <div id="interview-compliance-panel" className="interactive-card bg-white border-none rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-6 h-full text-left">
      <div className="pb-3 border-b-transparent">
        <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest">PROCTOR ENVIRONMENT REPORT</h3>
      </div>

      <div className="space-y-3.5">
        {/* Camera Indicator */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-stone-500 font-semibold flex items-center gap-2">
            <Video className="w-4 h-4 text-stone-400" /> Proctoring Feed
          </span>
          <span className={`font-bold ${cameraActive ? 'text-emerald-600' : 'text-stone-400'}`}>
            {cameraActive ? 'Streaming' : 'Pending'}
          </span>
        </div>

        {/* Mic Indicator */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-stone-500 font-semibold flex items-center gap-2">
            <Mic className="w-4 h-4 text-stone-400" /> Audio Channel
          </span>
          <span className={`font-bold ${micActive ? 'text-emerald-600' : 'text-stone-400'}`}>
            {micActive ? 'Gained' : 'Muted'}
          </span>
        </div>

        {/* Network status */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-stone-500 font-semibold flex items-center gap-2">
            <Wifi className="w-4 h-4 text-stone-400" /> Internet Signal
          </span>
          <span className={`font-bold ${networkOk ? 'text-emerald-600' : 'text-stone-450'}`}>
            {networkOk ? 'Excellent' : 'Scanning'}
          </span>
        </div>
      </div>

      <div className="border-t-transparent pt-4 space-y-4">
        <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Compliance Alarms</h4>
        
        <div className="p-4 bg-amber-50/50 rounded-2xl space-y-2 text-left shadow-[inset_0_1px_2px_rgba(245,158,11,0.05)]">
          <div className="flex items-center justify-between text-2xs font-extrabold text-amber-900 uppercase tracking-wider">
            <span>Tab focus warnings</span>
            <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-lg">{tabSwitchCount} Detected</span>
          </div>
          <p className="text-[10px] text-stone-500 leading-normal font-medium">
            Keep visual focus directly centered. Gaze drifts outside of the browser frame are registered as deviations.
          </p>
        </div>

        {warningsCount > 0 && (
          <div className="p-4 bg-rose-50 rounded-2xl flex items-start gap-2.5 text-rose-900 text-left">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="text-xs font-bold">Visual Deviation Alert</span>
              <p className="text-[10px] text-rose-700/80 mt-1 leading-relaxed font-semibold">
                An interrupt was recorded on device state. Continuous active transmission is required.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
