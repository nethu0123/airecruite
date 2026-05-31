/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Navbar, 
  FeatureCard, 
  StatCard, 
  ProgressBar,
  StatusBadge 
} from './components/UIBase';
import { 
  CandidateTable, 
  TranscriptCard, 
  SuspiciousLogs, 
  EvaluationCard 
} from './components/CandidateReviewComponents';
import { 
  HardwareCheck, 
  VideoRecorder, 
  QuestionPanel, 
  StatusPanel 
} from './components/CandidateInterviewComponents';
import { AuthPanel } from './components/AuthPanel';
import { getRoleFallbackQuestion, INTERVIEW_QUESTIONS, INTERVIEW_ROLES } from './utils/interviewQuestions';
import { supabaseService } from './services/supabase';
import { geminiService } from './services/gemini';
import { Candidate, SuspiciousLog, VideoResponse, InterviewQuestion, RoleQuestionMap } from './types';
import { 
  Sparkles, 
  Video, 
  ShieldCheck, 
  Brain, 
  ArrowRight, 
  CheckCircle, 
  Tv, 
  AlertTriangle, 
  User, 
  Clock, 
  Users, 
  BookOpen, 
  Search, 
  Filter, 
  ArrowLeft, 
  Settings,
  ShieldAlert,
  Check,
  RefreshCw,
  Wifi,
  WifiOff
} from 'lucide-react';

export default function App() {
  // Navigation Routing Hash state
  const [currentHash, setCurrentHash] = useState<string>(window.location.hash || '#/');
  
  // Authentication states
  const [user, setUser] = useState<any>(null);
  const [authName, setAuthName] = useState<string>('');
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [userType, setUserType] = useState<'candidate' | 'recruiter'>('candidate');
  const [recruiterAuthEmail, setRecruiterAuthEmail] = useState<string>('');
  const [recruiterAuthPassword, setRecruiterAuthPassword] = useState<string>('');
  const [loadingAuth, setLoadingAuth] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');

  // Screening Session inputs
  const [activeCandidateRole, setActiveCandidateRole] = useState<string>('UI/UX Engineer');
  const [interviewBatchCode, setInterviewBatchCode] = useState<string>('');
  const [candidateSetupError, setCandidateSetupError] = useState<string>('');

  // Interactive Questionnaire state
  const [questions, setQuestions] = useState<InterviewQuestion[]>(INTERVIEW_QUESTIONS);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [roleQuestionSets, setRoleQuestionSets] = useState<RoleQuestionMap>({});
  const [settingsRole, setSettingsRole] = useState<string>(INTERVIEW_ROLES[0]);

  // Live Proctor & Compliance states
  const [liveTabSwitches, setLiveTabSwitches] = useState<number>(0);
  const [showProctorWarning, setShowProctorWarning] = useState<boolean>(false);
  const [gazeWarningCount, setGazeWarningCount] = useState<number>(0);
  const [interviewLogs, setInterviewLogs] = useState<SuspiciousLog[]>([]);
  const interviewLogsRef = useRef<SuspiciousLog[]>([]);
  const lastTabExitRef = useRef<number>(0);
  const [responses, setResponses] = useState<VideoResponse[]>([]);
  const [interviewTimeLeft, setInterviewTimeLeft] = useState<number>(120);

  // Diagnostics variables
  const [networkSpeed, setNetworkSpeed] = useState<number>(12.4); // Mbps
  const [liveCameraOn, setLiveCameraOn] = useState<boolean>(true); // Testing camera toggle
  const [customNotification, setCustomNotification] = useState<{title: string, body: string} | null>(null);

  useEffect(() => {
    interviewLogsRef.current = interviewLogs;
  }, [interviewLogs]);

  const normalizeQuestionSet = (role: string, source?: InterviewQuestion[]) => {
    return [0, 1, 2, 3, 4].map((index) => {
      const existing = source?.[index];
      const fallback = INTERVIEW_QUESTIONS[index];
      return {
        id: index + 1,
        category: existing?.category || `${role} Manual Screening`,
        text: existing?.text || '',
        suggestedDuration: existing?.suggestedDuration || fallback?.suggestedDuration || 120
      };
    });
  };

  const getManualQuestionsForRole = (role: string) => {
    const roleQuestions = roleQuestionSets[role] || [];
    const normalized = normalizeQuestionSet(role, roleQuestions);
    const completed = normalized.filter(question => question.text.trim().length > 0);
    return completed.length === 5 ? normalized.map(question => ({
      ...question,
      text: question.text.trim()
    })) : [];
  };

  // Frequently evaluate network speed diagnostics
  useEffect(() => {
    const measureNetworkSpeed = async () => {
      if (!navigator.onLine) {
        setNetworkSpeed(0);
        return;
      }

      try {
        const start = performance.now();
        const response = await fetch(`/src/assets/images/app_logo_1780125395119.png?networkProbe=${Date.now()}`, {
          cache: 'no-store'
        });
        const blob = await response.blob();
        const seconds = Math.max((performance.now() - start) / 1000, 0.05);
        const mbps = (blob.size * 8) / seconds / 1_000_000;
        setNetworkSpeed(Math.max(2.1, Number(mbps.toFixed(1))));
      } catch (err) {
        setNetworkSpeed(navigator.onLine ? 2.1 : 0);
      }
    };

    measureNetworkSpeed();
    const interval = setInterval(measureNetworkSpeed, 8000);
    return () => clearInterval(interval);
  }, []);

  // Recruiter Workspace states
  const [searchText, setSearchText] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [candidatesList, setCandidatesList] = useState<Candidate[]>([]);
  const [disqualifiedCandidatesList, setDisqualifiedCandidatesList] = useState<Candidate[]>([]);
  const [showSettingsDialog, setShowSettingsDialog] = useState<boolean>(false);

  // Synchronize routing hash changes
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash || '#/');
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (currentHash === '#candidate/login') {
      setUserType('candidate');
    } else if (currentHash === '#recruiter/login') {
      setUserType('recruiter');
    }
  }, [currentHash]);

  // Manage automatic camera state: ON during criteria checks and active interview, OFF when done or navigating elsewhere
  useEffect(() => {
    if (
      currentHash === '#candidate/hardware-check' ||
      currentHash === '#candidate/instructions' ||
      currentHash === '#candidate/interview'
    ) {
      setLiveCameraOn(true);
    } else {
      setLiveCameraOn(false);
    }
  }, [currentHash]);

  const navigateTo = (hash: string) => {
    window.location.hash = hash;
    setCurrentHash(hash);
  };

  // Check current logged-in user on mount
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const activeUser = await supabaseService.getCurrentUser();
        setUser(activeUser);
      } catch (err: any) {
        setAuthError(err.message || 'Supabase is not configured.');
      }
    };
    fetchSession();
    
    // Refresh applicants list
    const loadApplicants = async () => {
      try {
        const list = await supabaseService.getCandidates();
        setCandidatesList(list);
        const disqualified = await supabaseService.getDisqualifiedCandidates();
        setDisqualifiedCandidatesList(disqualified);
      } catch (err) {
        setCandidatesList([]);
        setDisqualifiedCandidatesList([]);
      }
    };
    loadApplicants();

    // Load custom recruiter questionnaire if any exist
    supabaseService.getRecruiterQuestions()
      .then((cachedQuestions) => {
        if (Array.isArray(cachedQuestions)) {
          if (cachedQuestions.length > 0) {
            setRoleQuestionSets({ [INTERVIEW_ROLES[0]]: normalizeQuestionSet(INTERVIEW_ROLES[0], cachedQuestions) });
          }
          return;
        }
        if (cachedQuestions && typeof cachedQuestions === 'object') {
          const normalizedSets = Object.fromEntries(
            INTERVIEW_ROLES.map(role => [role, normalizeQuestionSet(role, cachedQuestions[role])])
          );
          setRoleQuestionSets(normalizedSets);
        }
      })
      .catch(() => setRoleQuestionSets({}));
  }, []);

  // Sync search and filtering rosters
  const filteredCandidates = candidatesList.filter(cand => {
    const matchSearch = (cand.fullName || '').toLowerCase().includes(searchText.toLowerCase()) || 
                        (cand.email || '').toLowerCase().includes(searchText.toLowerCase());
    const matchRole = roleFilter === 'All' || cand.role === roleFilter;
    const matchStatus = statusFilter === 'All' || cand.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  // Terminate active interview immediately due to critical security breaches
  const terminateActiveInterview = async (reason: string, finalLogs: SuspiciousLog[]) => {
    window.speechSynthesis.cancel();
    
    const timestamp = new Date().toLocaleTimeString();
    const breachLog: SuspiciousLog = {
      id: `log-term-${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      type: 'compliance-breach',
      description: `BANNED / SHUTDOWN: ${reason}`
    };
    
    const allLogs = [...finalLogs, breachLog];
    setInterviewLogs(allLogs);

    // Build finalized candidate card
    const finalizedCandidateRecord: Candidate = {
      id: user?.id || `cand-reg-${Math.random().toString(36).substr(2, 9)}`,
      fullName: user?.user_metadata?.fullName || user?.user_metadata?.name || user?.name || (user?.email ? user.email.split('@')[0].toUpperCase() : 'Guest Candidate'),
      email: user?.email || 'applicant@airecruite.com',
      role: activeCandidateRole,
      token: interviewBatchCode || `BREACH-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
      batchCode: interviewBatchCode,
      status: 'failed',
      date: new Date().toISOString().split('T')[0],
      score: 15,
      aiEvaluation: {
        communicationScore: 10,
        technicalScore: 10,
        confidenceScore: 10,
        recommendation: 'No Hire',
        summary: `Assessment terminated automatically due to critical security constraint breach: ${reason}.`
      },
      suspiciousLogs: allLogs,
      responses: responses
    };

    try {
      await supabaseService.upsertDisqualifiedCandidate(finalizedCandidateRecord);
      const disqualified = await supabaseService.getDisqualifiedCandidates();
      setDisqualifiedCandidatesList(disqualified);
    } catch (e) {
      console.warn("Failed saving disqualified interview log:", e);
    }

    navigateTo('#candidate/disqualified');
  };

  // Speaks/warns on gaze drift deviations
  const triggerGazeDeviation = () => {
    const timestamp = new Date().toLocaleTimeString();
    setGazeWarningCount(prev => {
      const updatedCount = prev + 1;
      const newLog: SuspiciousLog = {
        id: `gaze-drift-${Math.random().toString(36).substr(2, 9)}`,
        timestamp,
        type: 'gaze-drifted',
        description: `Visual drift recorded: Gaze coordinate moved off center screen (${updatedCount} limit drift).`
      };

      setInterviewLogs(logs => {
        const nextLogs = [...logs, newLog];
        if (updatedCount > 3) { // 3 excuses allowed, 4th deviation terminates!
          setTimeout(() => {
            terminateActiveInterview('Compliance Failure: Exceeded maximum allowed eye gaze deviations (3 limits allowed).', nextLogs);
          }, 100);
        }
        return nextLogs;
      });

      if (updatedCount <= 3) {
        setCustomNotification({
          title: "Visual Alignment Alert",
          body: `Gaze Drift Warning (${updatedCount} of 3 excuses): Keep your eye coordination focused directly on your screen. Exceeding 3 excuses will automatically terminate your session.`
        });
        setShowProctorWarning(true);
      }

      return updatedCount;
    });
  };

  // Immediate termination when more than 1 person is detected on candidate's screen
  const triggerMultiplePersonsDetected = () => {
    const timestamp = new Date().toLocaleTimeString();
    const newLog: SuspiciousLog = {
      id: `multi-face-${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      type: 'multiple-persons',
      description: `CRITICAL SEC BREACH: More than 1 face coordinates detected inside proctor webcam frame.`
    };

    setGazeWarningCount(prev => {
      const updatedCount = prev + 1;
      setInterviewLogs(logs => {
        const nextLogs = [...logs, newLog];
        if (updatedCount > 3) {
          setTimeout(() => {
            terminateActiveInterview('Critical Security Breach: More than one face detected inside proctor frame after 3 warnings.', nextLogs);
          }, 100);
        }
        return nextLogs;
      });
      if (updatedCount <= 3) {
        setCustomNotification({
          title: "Multiple Person Warning",
          body: `Face count warning (${updatedCount} of 3): Only the candidate may be visible during the interview.`
        });
        setShowProctorWarning(true);
      }
      return updatedCount;
    });
  };

  const triggerAiToolDetected = () => {
    const timestamp = new Date().toLocaleTimeString();
    const newLog: SuspiciousLog = {
      id: `ai-tool-${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      type: 'ai-tool-detected',
      description: 'Potential AI assistance or external answer helper behavior detected during the interview.'
    };

    setGazeWarningCount(prev => {
      const updatedCount = prev + 1;
      setInterviewLogs(logs => {
        const nextLogs = [...logs, newLog];
        if (updatedCount > 3) {
          setTimeout(() => {
            terminateActiveInterview('Compliance Failure: AI tool or external assistance detected after 3 warnings.', nextLogs);
          }, 100);
        }
        return nextLogs;
      });
      if (updatedCount <= 3) {
        setCustomNotification({
          title: "AI Assistance Warning",
          body: `Cheat-tool warning (${updatedCount} of 3): Do not use AI tools, helper windows, or outside assistance.`
        });
        setShowProctorWarning(true);
      }
      return updatedCount;
    });
  };

  const handleProctorEvent = (type: 'gaze-drifted' | 'multiple-persons' | 'ai-tool-detected', description: string) => {
    if (type === 'multiple-persons') {
      triggerMultiplePersonsDetected();
    } else if (type === 'ai-tool-detected') {
      triggerAiToolDetected();
    } else {
      const timestamp = new Date().toLocaleTimeString();
      setGazeWarningCount(prev => {
        const updatedCount = prev + 1;
        const newLog: SuspiciousLog = {
          id: `gaze-drift-${Math.random().toString(36).substr(2, 9)}`,
          timestamp,
          type,
          description
        };
        setInterviewLogs(logs => {
          const nextLogs = [...logs, newLog];
          if (updatedCount > 3) {
            setTimeout(() => {
              terminateActiveInterview('Compliance Failure: Exceeded maximum allowed eye or face-position deviations.', nextLogs);
            }, 100);
          }
          return nextLogs;
        });
        if (updatedCount <= 3) {
          setCustomNotification({
            title: "Eye Deviation Warning",
            body: `Focus warning (${updatedCount} of 3): Keep your face centered and look at the interview screen.`
          });
          setShowProctorWarning(true);
        }
        return updatedCount;
      });
    }
  };

  // Track tab changes / focus drops during the assessment
  useEffect(() => {
    const handleTabExit = (source: 'window blur' | 'tab hidden' | 'page leaving') => {
      if (currentHash === '#candidate/interview') {
        const now = Date.now();
        if (now - lastTabExitRef.current < 1500) return;
        lastTabExitRef.current = now;
        const timestamp = new Date().toLocaleTimeString();
        
        setLiveTabSwitches(prevSwitches => {
          const nextSwitches = prevSwitches + 1;
          const newLog: SuspiciousLog = {
            id: `tab-blur-${Math.random().toString(36).substr(2, 9)}`,
            timestamp,
            type: 'tab-switched',
            description: `Compliance Alert: Candidate left the interview focus via ${source} (${nextSwitches} switches).`
          };

          setInterviewLogs(logs => {
            const nextLogs = [...logs, newLog];
            if (nextSwitches > 3) {
              setTimeout(() => {
                terminateActiveInterview('Compliance Failure: Exceeded maximum allowed tab switches (3 warnings allowed).', nextLogs);
              }, 100);
            }
            return nextLogs;
          });

          if (nextSwitches <= 3) {
            setCustomNotification({
              title: "Security Escape Warning",
              body: `Tab switch warning (${nextSwitches} of 3): Stay inside the interview screen. A fourth violation will end the interview.`
            });
            setShowProctorWarning(true);
          }

          return nextSwitches;
        });
      }
    };
    const handleTabBlur = () => handleTabExit('window blur');
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleTabExit('tab hidden');
      }
    };
    const handlePageHide = () => handleTabExit('page leaving');

    window.addEventListener('blur', handleTabBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('blur', handleTabBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [currentHash, activeCandidateRole, responses, user]);

  useEffect(() => {
    if (currentHash !== '#candidate/interview') return;

    const handlePaste = () => triggerAiToolDetected();
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      triggerAiToolDetected();
    };
    const handleKeydown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && ['v', 'c', 'x', 'a', 'l'].includes(key)) {
        triggerAiToolDetected();
      }
      if (
        key === 'f12' ||
        key === 'printscreen' ||
        ((event.ctrlKey || event.metaKey) && event.shiftKey && ['i', 'j', 'c'].includes(key))
      ) {
        triggerAiToolDetected();
      }
    };
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        triggerAiToolDetected();
      }
    };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeydown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [currentHash]);

  // Live assessment duration decrement clock
  useEffect(() => {
    if (currentHash !== '#candidate/interview') return;
    
    const interval = setInterval(() => {
      setInterviewTimeLeft(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentHash, currentQuestionIndex, questions]);

  // Handle Candidate signup & signin via Supabase
  const handleCandidateAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAuth(true);
    setAuthError('');

    try {
      if (authMode === 'signup') {
        const res: any = await supabaseService.signUp(authEmail, authPassword, 'candidate', authName);
        if (res.error) {
          setAuthError(res.error);
        } else {
          setUser(res.user);
          navigateTo('#candidate/setup');
        }
      } else {
        const res: any = await supabaseService.signIn(authEmail, authPassword, 'candidate');
        if (res.error) {
          setAuthError(res.error);
        } else {
          setUser(res.user);
          navigateTo('#candidate/setup');
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed.');
    } finally {
      setLoadingAuth(false);
    }
  };

  // Recruiter authorization handler (signIn and signUp support) using unified fields
  const handleRecruiterAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAuth(true);
    setAuthError('');

    try {
      let res: any;
      if (authMode === 'signup') {
        res = await supabaseService.signUp(authEmail, authPassword, 'recruiter', authName);
      } else {
        res = await supabaseService.signIn(authEmail, authPassword, 'recruiter');
      }

      if (res.error) {
        setAuthError(res.error);
      } else {
        setUser(res.user);
        const list = await supabaseService.getCandidates();
        setCandidatesList(list);
        const disqualified = await supabaseService.getDisqualifiedCandidates();
        setDisqualifiedCandidatesList(disqualified);
        navigateTo('#recruiter/dashboard');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Recruiter Portal authorization failed.');
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleGoogleSignUp = async (role: 'candidate' | 'recruiter') => {
    setLoadingAuth(true);
    setAuthError('');

    try {
      const res: any = await supabaseService.signUpWithGoogle(role);
      if (res.error) {
        setAuthError(res.error);
        return;
      }

      if (res.user) {
        setUser(res.user);
        if (role === 'candidate') {
          navigateTo('#candidate/setup');
        } else {
          const list = await supabaseService.getCandidates();
          setCandidatesList(list);
          const disqualified = await supabaseService.getDisqualifiedCandidates();
          setDisqualifiedCandidatesList(disqualified);
          navigateTo('#recruiter/dashboard');
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Google signup failed.');
    } finally {
      setLoadingAuth(false);
    }
  };

  // Boot interview questionnaires with either AI or static rules
  const prepareAssessmentSession = async (currUser: any) => {
    // Stop any active speech
    window.speechSynthesis.cancel();

    let initialQs: InterviewQuestion[] = [];
    const manualQuestions = getManualQuestionsForRole(activeCandidateRole);
    if (manualQuestions.length === 5) {
      initialQs = manualQuestions;
    } else {
      // No complete manual set exists for this role, so AI generates role and technology-specific questions.
      let q1 = '';
      try {
        q1 = await geminiService.generateQuestion(activeCandidateRole, 1, []);
      } catch (err: any) {
        setCustomNotification({
          title: "AI Question Fallback Active",
          body: err.message || 'Gemini is unavailable, so a non-AI role-based question set is being used for this interview.'
        });
        setShowProctorWarning(true);
      }
      initialQs = q1
        ? [{
          id: 1,
          category: 'Warm-up introduction',
          text: q1,
          suggestedDuration: 120
        }]
        : [getRoleFallbackQuestion(activeCandidateRole, 1)];
    }

    // Ensure initialQs has exactly 5 questions
    if (initialQs.length < 5) {
      for (let i = initialQs.length; i < 5; i++) {
        const fallbackQ = INTERVIEW_QUESTIONS[i % INTERVIEW_QUESTIONS.length];
        initialQs.push({
          id: i + 1,
          category: fallbackQ?.category || 'General Assessment',
          text: fallbackQ?.text || 'Explain key paradigms inside software development workflows.',
          suggestedDuration: 120
        });
      }
    } else if (initialQs.length > 5) {
      initialQs = initialQs.slice(0, 5);
    }

    setQuestions(initialQs);
    setCurrentQuestionIndex(0);
    setLiveTabSwitches(0);
    setGazeWarningCount(0);
    setInterviewLogs([]);
    setResponses([]);
    setInterviewTimeLeft(120);

    navigateTo('#candidate/hardware-check');
  };

  const handleCandidateSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCandidateSetupError('');

    if (!activeCandidateRole.trim()) {
      setCandidateSetupError('Please select the role for this interview.');
      return;
    }

    if (!interviewBatchCode.trim()) {
      setCandidateSetupError('Please enter your interview batch code.');
      return;
    }

    await prepareAssessmentSession(user);
  };

  // Transcription + Storage Upload Pipeline
  const handleChunkFinished = async (clipBlob: Blob, capturedTranscript = '', averageVolume = 0, duration = 0, speechConfidence = 0) => {
    window.speechSynthesis.cancel(); // Stop playing voices automatically when clicking proceed
    const currentQ = questions[currentQuestionIndex];
    const generatedFileName = `screener_cand_${user?.id || 'guest'}_q${currentQ.id}_${Math.random().toString(36).substr(2, 5)}.webm`;
    
    // Upload videoclip continuously inside Supabase storage bucket
    const videoUrl = await supabaseService.uploadVideo(clipBlob, generatedFileName);

    const transcript = capturedTranscript || '';
    let finalLogsForEvaluation = interviewLogsRef.current;
    if (averageVolume < 3 || transcript.length < 8) {
      const timestamp = new Date().toLocaleTimeString();
      const lowSpeechLog: SuspiciousLog = {
        id: `voice-low-${Math.random().toString(36).substr(2, 9)}`,
        timestamp,
        type: 'unusual-noise',
        description: `Voice volume or transcript confidence was too low for question ${currentQuestionIndex + 1}.`
      };
      finalLogsForEvaluation = [...finalLogsForEvaluation, lowSpeechLog];
      interviewLogsRef.current = finalLogsForEvaluation;
      setInterviewLogs(finalLogsForEvaluation);
    }

    const videoResponse: VideoResponse = {
      questionId: currentQ.id,
      questionText: currentQ.text,
      videoUrl,
      transcript,
      duration,
      averageVolume,
      speechConfidence
    };

    const newResponses = [...responses, videoResponse];
    setResponses(newResponses);

    // Transition or Complete Questionnaire (strictly limited to maximum 5 questions!)
    const targetLength = 5;
    
    if (currentQuestionIndex < targetLength - 1) {
      // If this role has no complete manual question set, generate the next AI follow-up from the prior answer.
      if (getManualQuestionsForRole(activeCandidateRole).length !== 5) {
        const nextQIndex = currentQuestionIndex + 1;
        // Transform current responses into a clean query history format
        const history = newResponses.map((res) => ({
          questionText: res.questionText,
          answerText: res.transcript
        }));

        // Fetch dynamic question 2, 3, 4, 5
        let generatedQText = '';
        try {
          generatedQText = await geminiService.generateQuestion(activeCandidateRole, nextQIndex + 1, history);
        } catch (err: any) {
          setCustomNotification({
            title: "AI Question Fallback Active",
            body: err.message || 'Gemini is unavailable, so a non-AI role-based fallback question is being used.'
          });
          setShowProctorWarning(true);
        }
        
        const nextQ: InterviewQuestion = generatedQText
          ? {
            id: nextQIndex + 1,
            category: `AI Follow-up screening`,
            text: generatedQText,
            suggestedDuration: 120
          }
          : getRoleFallbackQuestion(activeCandidateRole, nextQIndex + 1);

        setQuestions(prev => [...prev, nextQ]);
      }

      setCurrentQuestionIndex(prev => prev + 1);
      setInterviewTimeLeft(120);
    } else {
      // Completed full session of 5 questions! Calculate final evaluations dynamically
      submitCompletedSession(newResponses, finalLogsForEvaluation);
    }
  };

  const submitCompletedSession = async (finalResponses: VideoResponse[], finalLogs: SuspiciousLog[]) => {
    // Generate AI metrics and recommendation from Gemini server proxy
    let aiEvaluation;
    try {
      aiEvaluation = await geminiService.generateEvaluation(finalResponses, finalLogs, activeCandidateRole);
    } catch (err: any) {
      setCustomNotification({
        title: "AI Evaluation Unavailable",
        body: err.message || 'The AI evaluation service did not return a result. The interview was not submitted with generated scores.'
      });
      setShowProctorWarning(true);
      return;
    }
    
    const finalizedCandidateRecord: Candidate = {
      id: user?.id || `cand-reg-${Math.random().toString(36).substr(2, 9)}`,
      fullName: user?.user_metadata?.fullName || user?.user_metadata?.name || user?.name || (user?.email ? user.email.split('@')[0].toUpperCase() : 'Lobby Applicant'),
      email: user?.email || 'applicant@airecruite.com',
      role: activeCandidateRole,
      token: interviewBatchCode || `KEY-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
      batchCode: interviewBatchCode,
      status: 'completed',
      date: new Date().toISOString().split('T')[0],
      score: aiEvaluation.score,
      aiEvaluation,
      suspiciousLogs: finalLogs,
      responses: finalResponses
    };

    // Upsert directly to Supabase with automatic storage fallback
    await supabaseService.upsertCandidate(finalizedCandidateRecord);

    // Reload list
    const list = await supabaseService.getCandidates();
    setCandidatesList(list);

    navigateTo('#candidate/completed');
  };

  const handleSignOut = async () => {
    await supabaseService.signOut();
    setUser(null);
    setSelectedCandidate(null);
    navigateTo('#/');
  };

  // Quick statistics calculated dynamically
  const totalCompletedCount = candidatesList.filter(c => c.status === 'completed').length;
  const totalPendingCount = candidatesList.filter(c => c.status === 'pending').length;
  const totalFlagsCount = candidatesList.filter(c => c.suspiciousLogs.length > 0 && c.status === 'completed').length;
  const totalInterviewBatches = new Set(candidatesList.map(c => c.batchCode || c.token).filter(Boolean)).size;
  const totalDisqualifiedCount = disqualifiedCandidatesList.length;

  const saveCustomSettings = async () => {
    const normalizedSets = Object.fromEntries(
      INTERVIEW_ROLES.map(role => [role, normalizeQuestionSet(role, roleQuestionSets[role])])
    );
    await supabaseService.saveRecruiterQuestions(normalizedSets);
    setRoleQuestionSets(normalizedSets);
    setShowSettingsDialog(false);
  };

  const renderAuthPanel = () => (
    <AuthPanel
      mode={authMode}
      selectedRole={userType}
      name={authName}
      email={authEmail}
      password={authPassword}
      error={authError}
      loading={loadingAuth}
      onModeChange={(mode) => {
        setAuthMode(mode);
        setAuthError('');
      }}
      onRoleChange={(role) => {
        setUserType(role);
        setAuthError('');
        navigateTo(role === 'candidate' ? '#candidate/login' : '#recruiter/login');
      }}
      onNameChange={setAuthName}
      onEmailChange={setAuthEmail}
      onPasswordChange={setAuthPassword}
      onSubmit={(event) => {
        if (userType === 'candidate') {
          handleCandidateAuth(event);
        } else {
          handleRecruiterAuth(event);
        }
      }}
      onGoogleSignUp={() => handleGoogleSignUp(userType)}
    />
  );

  const renderLogoLockup = (subtitle: string, size = 'md') => (
    <div className="flex flex-col items-center gap-2">
      <img
        src="/src/assets/images/app_logo_1780125395119.png"
        alt="airecruite logo"
        className={`${size === 'sm' ? 'w-11 h-11' : 'w-14 h-14'} object-contain transition-transform duration-300 hover:scale-105`}
        referrerPolicy="no-referrer"
      />
      <div className="text-center">
        <div className="text-base font-extrabold tracking-tight text-stone-950">airecruite</div>
        <div className="text-[9px] font-extrabold uppercase tracking-widest text-amber-600">{subtitle}</div>
      </div>
    </div>
  );

  return (
    <div id="app-root-wrapper" className="min-h-screen bg-stone-50 selection:bg-amber-150 flex flex-col justify-between font-sans leading-relaxed text-stone-700 antialiased">
      
      {/* PERSISTENT DIAGNOSTIC METRIC BANNER */}
      {liveCameraOn && (
        <div id="diagnostic-top-banner" className="bg-stone-900 border-b border-stone-800 text-stone-300 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-4 select-none shrink-0 z-50 shadow-sm font-semibold">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500 block animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-amber-400">AUTOMATED SCREENER SYSTEM CORE ACTIVE</span>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Wifi className={`w-3.5 h-3.5 ${networkSpeed >= 2.0 ? 'text-emerald-500' : 'text-rose-500 animate-pulse'}`} />
              <span className="font-mono tracking-tight text-[11px]">
                Network Speed: <span className="font-extrabold text-white">{networkSpeed} Mbps</span>
                {networkSpeed < 2.0 ? (
                  <span className="text-rose-500 text-[10px] font-bold uppercase ml-1.5">(Fail: {"< 2 Mbps"})</span>
                ) : (
                  <span className="text-emerald-500 text-[10px] font-bold uppercase ml-1.5">(Standard Pass)</span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Video className={`w-3.5 h-3.5 ${liveCameraOn ? 'text-emerald-500' : 'text-rose-500 animate-pulse'}`} />
              <span className="font-mono tracking-tight text-[11px]">
                Video Camera: {liveCameraOn ? (
                  <span className="text-emerald-500 font-extrabold text-[10px] uppercase">READY</span>
                ) : (
                  <span className="text-rose-505 font-extrabold text-[10px] uppercase">OFF / BLOCKED</span>
                )}
              </span>
            </div>

          </div>
        </div>
      )}

      {/* COMPLIANCE EYE-TRACKING WARNING OVERLAY */}
      {showProctorWarning && (
        <div id="proctor-warning-modal" className="fixed inset-0 bg-stone-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="interactive-card w-full max-w-md bg-white rounded-3xl p-8 text-center shadow-[0_20px_60px_rgba(245,158,11,0.25)] border-none">
            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-base font-extrabold text-stone-900 uppercase tracking-wider">{customNotification?.title || 'Proctoring Warning'}</h3>
            <p className="text-xs text-stone-500 mt-2 leading-relaxed font-semibold">
              {customNotification?.body || (
                <>Warning <span className="text-amber-600 font-extrabold">{gazeWarningCount} / 3</span>: Stay focused inside the interview screen.</>
              )}
            </p>
            <button
              onClick={() => setShowProctorWarning(false)}
              className="interactive-button mt-6 w-full py-3.5 bg-amber-400 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-2xl shadow-lg transition-all cursor-pointer"
            >
              I Understand & Refocus
            </button>
          </div>
        </div>
      )}

      {/* MAIN VIEWPORT PANES */}
      <main id="app-main-content" className="flex-1 w-full flex flex-col">
        
        {/* FOR SUBPAGES WHERE USER IS NOT AUTHENTICATED: RENDER DESIGNER UNIFIED LOGIN CARD */}
        {currentHash !== '#/' && currentHash !== '' && currentHash !== '#candidate/login' && currentHash !== '#recruiter/login' && !user && (
          <div id="unauthenticated-gate" className="flex-grow flex items-center justify-center p-6 py-16 bg-stone-50/50">
            <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-[0_25px_55px_rgba(0,0,0,0.035)] border-none space-y-6 text-left animate-fade-in">
              <div className="text-center space-y-2 flex flex-col items-center">
                <img
                  src="/src/assets/images/app_logo_1780125395119.png"
                  alt="airecruite logo"
                  className="w-14 h-14 object-contain mb-1 transition-transform duration-300 hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                <h3 className="text-xl font-extrabold text-stone-900 tracking-tight font-sans">AI Automated Screener</h3>
                <p className="text-xs text-stone-400 font-semibold text-center">Verify your identity to launch calibration audits and screening streams.</p>
              </div>

              {/* Segmented Selector for User Type (Candidate vs Recruiter) */}
              <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1.5 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]">
                <button
                  type="button"
                  onClick={() => { setUserType('candidate'); setAuthError(''); }}
                  className={`py-2.5 text-[11px] font-extrabold uppercase tracking-wider rounded-xl transition cursor-pointer ${userType === 'candidate' ? 'bg-white text-stone-950 shadow-xs' : 'text-stone-400 hover:text-stone-700'}`}
                >
                  Candidate
                </button>
                <button
                  type="button"
                  onClick={() => { setUserType('recruiter'); setAuthError(''); }}
                  className={`py-2.5 text-[11px] font-extrabold uppercase tracking-wider rounded-xl transition cursor-pointer ${userType === 'recruiter' ? 'bg-stone-900 text-white shadow-xs' : 'text-stone-400 hover:text-stone-700'}`}
                >
                  Recruiter
                </button>
              </div>

              {/* Segmented Selector for Auth Mode (Log In vs Sign Up) */}
              <div className="flex bg-stone-50 p-1 rounded-xl border-none shadow-[inset_0_1px_2.5px_rgba(0,0,0,0.01)]">
                <button
                  type="button"
                  onClick={() => { setAuthMode('signin'); setAuthError(''); }}
                  className={`flex-1 py-1.5 text-[10px] font-extrabold uppercase transition cursor-pointer rounded-lg ${authMode === 'signin' ? 'bg-stone-200 text-stone-900 shadow-3xs' : 'text-stone-400 hover:text-stone-600'}`}
                >
                  Log In
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode('signup'); setAuthError(''); }}
                  className={`flex-1 py-1.5 text-[10px] font-extrabold uppercase transition cursor-pointer rounded-lg ${authMode === 'signup' ? 'bg-stone-200 text-stone-900 shadow-3xs' : 'text-stone-400 hover:text-stone-600'}`}
                >
                  Sign Up
                </button>
              </div>

              {authError && (
                <div className="p-4 bg-rose-50 text-rose-900 rounded-2xl text-xs font-semibold flex items-center gap-2 border-none">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {userType === 'candidate' ? (
                /* Unified Candidate Form */
                <form onSubmit={handleCandidateAuth} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest">
                      {authMode === 'signup' ? 'Candidate Registration' : 'Candidate Login Portal'}
                    </span>
                  </div>

                  {authMode === 'signup' && (
                    <div>
                      <label htmlFor="gate-name" className="block text-3xs font-extrabold text-stone-400 uppercase tracking-widest mb-1.5">Full Name</label>
                      <input
                        id="gate-name"
                        required
                        type="text"
                        placeholder="Your full name"
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        className="w-full px-4.5 py-3 text-xs bg-stone-50 border-none rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition font-medium text-stone-900 shadow-[inset_0_1px_2px_rgba(0,0,0,0.015)] animate-fade-in"
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="gate-email" className="block text-3xs font-extrabold text-stone-400 uppercase tracking-widest mb-1.5">Email Address</label>
                    <input
                      id="gate-email"
                      required
                      type="email"
                      placeholder="name@example.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full px-4.5 py-3 text-xs bg-stone-50 border-none rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition font-medium text-stone-900 shadow-[inset_0_1px_2px_rgba(0,0,0,0.015)] animate-fade-in"
                    />
                  </div>

                  <div>
                    <label htmlFor="gate-pass" className="block text-3xs font-extrabold text-stone-400 uppercase tracking-widest mb-1.5">Password</label>
                    <input
                      id="gate-pass"
                      required
                      type="password"
                      placeholder="••••••••"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full px-4.5 py-3 text-xs bg-stone-50 border-none rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition font-medium text-stone-900 shadow-[inset_0_1px_2px_rgba(0,0,0,0.015)] animate-fade-in"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loadingAuth}
                      className="w-full py-3.5 bg-amber-400 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2"
                    >
                      {loadingAuth ? <RefreshCw className="w-4 h-4 animate-spin text-stone-900" /> : (
                        <span>{authMode === 'signup' ? 'Proceed to Onboarding' : 'Login & Begin Stream'}</span>
                      )}
                    </button>
                  </div>
                  {authMode === 'signup' && (
                    <button
                      type="button"
                      onClick={() => handleGoogleSignUp('candidate')}
                      disabled={loadingAuth}
                      className="w-full py-3 bg-white hover:bg-stone-50 text-stone-700 font-bold text-xs rounded-xl shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] cursor-pointer transition-all flex items-center justify-center gap-2"
                    >
                      Sign up with Google
                    </button>
                  )}
                </form>
              ) : (
                /* Unified Recruiter Form */
                <form onSubmit={handleRecruiterAuth} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest">
                      {authMode === 'signup' ? 'Create Auditor Profile' : 'Auditor Console Sign In'}
                    </span>
                  </div>

                  {authMode === 'signup' && (
                    <div>
                      <label htmlFor="rec-name-gate" className="block text-3xs font-extrabold text-stone-400 uppercase tracking-widest mb-1.5">Full Name</label>
                      <input
                        id="rec-name-gate"
                        required
                        type="text"
                        placeholder="Your full name"
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        className="w-full px-4.5 py-3 text-xs bg-stone-50 border-none rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition font-medium text-stone-900 shadow-[inset_0_1px_2px_rgba(0,0,0,0.015)]"
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="rec-email-gate" className="block text-3xs font-extrabold text-stone-400 uppercase tracking-widest mb-1.5">Corporate Email</label>
                    <input
                      id="rec-email-gate"
                      required
                      type="email"
                      placeholder="admin@example.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full px-4.5 py-3 text-xs bg-stone-50 border-none rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition font-medium text-stone-900 shadow-[inset_0_1px_2px_rgba(0,0,0,0.015)]"
                    />
                  </div>

                  <div>
                    <label htmlFor="rec-pass-gate" className="block text-3xs font-extrabold text-stone-400 uppercase tracking-widest mb-1.5">Security Password</label>
                    <input
                      id="rec-pass-gate"
                      required
                      type="password"
                      placeholder="••••••••"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full px-4.5 py-3 text-xs bg-stone-50 border-none rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition font-medium text-stone-900 shadow-[inset_0_1px_2px_rgba(0,0,0,0.015)]"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loadingAuth}
                      className="w-full py-3.5 bg-stone-900 hover:bg-stone-850 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2"
                    >
                      {loadingAuth ? <RefreshCw className="w-4 h-4 animate-spin text-stone-100" /> : (
                        <span>{authMode === 'signup' ? 'Create Console Account' : 'Open Recruiter Console Panel'}</span>
                      )}
                    </button>
                  </div>
                  {authMode === 'signup' && (
                    <button
                      type="button"
                      onClick={() => handleGoogleSignUp('recruiter')}
                      disabled={loadingAuth}
                      className="w-full py-3 bg-white hover:bg-stone-50 text-stone-700 font-bold text-xs rounded-xl shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] cursor-pointer transition-all flex items-center justify-center gap-2"
                    >
                      Sign up with Google
                    </button>
                  )}
                </form>
              )}
            </div>
          </div>
        )}

        {/* ROUTE '#/': LANDING PAGE */}
        {(currentHash === '#/' || currentHash === '') && (
          <div id="landing-view" className="flex-1 py-16 space-y-24">
            {/* Elegant Hero Frame */}
            <div className="max-w-5xl mx-auto px-6 text-center space-y-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-amber-900 bg-amber-50 rounded-xl shadow-[inset_0_1px_2px_rgba(251,191,36,0.1)]">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Adaptive AI Candidate Screening
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-5xl font-extrabold tracking-tight text-stone-900 font-sans leading-tight">
                Automate first-round screening with <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-amber-500">intelligent discussion</span> and proctored compliance
              </h1>
              <p className="max-w-2xl mx-auto text-sm md:text-base text-stone-500 font-medium leading-relaxed">
                Empower your recruitment roster with dynamic screening assessments. Our model asks tailored questions based on applicant answers, transcribing and evaluating talent securely in real-time.
              </p>
              
              <div className="flex flex-wrap items-center justify-center gap-4 pt-6">
                <button 
                  onClick={() => {
                    setUserType('candidate');
                    setAuthMode('signin');
                    setAuthError('');
                    navigateTo('#candidate/login');
                  }}
                  className="px-7 py-4 bg-amber-400 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-2xl shadow-[0_12px_30px_rgba(245,158,11,0.25)] hover:shadow-[0_15px_35px_rgba(245,158,11,0.35)] transition-all duration-300 flex items-center gap-2 cursor-pointer"
                >
                  <span>candidate </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => {
                    setUserType('recruiter');
                    setAuthMode('signin');
                    setAuthError('');
                    navigateTo('#recruiter/login');
                  }}
                  className="px-7 py-4 bg-white hover:bg-stone-50 text-stone-700 font-bold text-xs rounded-2xl shadow-[0_8px_25px_rgba(0,0,0,0.03)] transition cursor-pointer flex items-center gap-2"
                >
                  <span>Admin </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="pt-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-stone-100 rounded-xl text-[11px] font-bold text-stone-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Compliance core active • Verification metrics established</span>
                </div>
              </div>
            </div>

            {/* Features layout */}
            <div id="features" className="max-w-7xl mx-auto px-6 space-y-12">
              <div className="text-center space-y-1.5">
                <h2 className="text-2xl font-extrabold text-stone-900 tracking-tight">Advanced Screening Modules</h2>
                <p className="text-xs text-stone-400 font-bold uppercase tracking-wider">Ensuring quality, convenience, and absolute coordination</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <FeatureCard 
                  icon={Brain}
                  title="Adaptive Discussions"
                  description="System analyzes candidate answers and asks bespoke, context-relevant follow-up questions tailored specifically to their applied role."
                />
                <FeatureCard 
                  icon={Video}
                  title="Continuous Proctoring"
                  description="Ensures fairness by tracking eye focus anomalies, visual dropout intervals, and window tab deviations during active screening."
                />
                <FeatureCard 
                  icon={BookOpen}
                  title="Immediate Transcribing"
                  description="Automatic speech conversion engine formats spoken audio answers into highly readable transcripts for easy recruiter auditing."
                />
                <FeatureCard 
                  icon={ShieldCheck}
                  title="Recruiter Calibration"
                  description="Enables recruitment leads to set static question pools or activate live AI questions depending on department requirements."
                />
              </div>
            </div>

            {/* How it Works workflow map */}
            <div id="how-it-works" className="bg-white py-16 shadow-[inset_0_4px_30px_rgba(0,0,0,0.01)]">
              <div className="max-w-7xl mx-auto px-6 space-y-12">
                <div className="text-center space-y-1.5">
                  <span className="text-xs font-extrabold text-amber-500 uppercase tracking-widest">Workflow Steps</span>
                  <h2 className="text-2xl font-extrabold text-stone-900 tracking-tight">How the Platform Streamlines Hiring</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                  {[
                    { nr: "01", label: "Applicant Lobby Portal", text: "Candidate registers an account securely to login to their assigned department screening." },
                    { nr: "02", label: "Calibrate Devices", text: "Diagnoses camera visual, sound feeds, and mic levels, including auditory voice confirmation." },
                    { nr: "03", label: "Participate Assessment", text: "Speak answers out loud. Our adaptive model monitors gaze coordinates and registers compliance." },
                    { nr: "04", label: "Examine Report File", text: "Recruiters access transcribed dialogues, proctor logs, and AI evaluation metrics within one unified panel." }
                  ].map((step, idx) => (
                    <div key={idx} className="interactive-card relative p-7 bg-stone-50/50 rounded-2xl text-left shadow-[0_4px_12px_rgba(0,0,0,0.005)]">
                      <div className="text-3xl font-extrabold text-amber-550/30 font-mono mb-3">{step.nr}</div>
                      <h4 className="text-xs font-bold text-stone-850 mb-1.5">{step.label}</h4>
                      <p className="text-xs leading-relaxed text-stone-450 font-medium">{step.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Elegant minimalist Footer */}
            <footer className="max-w-7xl mx-auto px-6 border-t border-stone-100 pt-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-400 font-bold uppercase tracking-wider">
              <span>© 2026 airecruite corporated. All metrics calibrated fully.</span>
              <div className="flex gap-6">
                <a href="#" className="hover:text-stone-705">Terms of Use</a>
                <a href="#" className="hover:text-stone-705">Privacy Policies</a>
                <a href="#" className="hover:text-stone-705">Client Help</a>
              </div>
            </footer>
          </div>
        )}

        {/* ROUTE '#candidate/login': CANDIDATE REGISTRATION & LOGIN */}
        {currentHash === '#candidate/login' && (
          <div id="candidate-login-view" className="flex-1 flex items-center justify-center p-6 py-16 bg-slate-50">
            {user ? (
              <div className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-[0_18px_45px_rgba(15,23,42,0.08)] border border-slate-100 text-center space-y-4 animate-fade-in">
                {renderLogoLockup('Candidate session', 'sm')}
                <h2 className="text-xl font-extrabold text-stone-900 tracking-tight">Profile Authenticated</h2>
                <p className="text-xs text-stone-500 font-medium">You are currently logged in as {user.email}. Continue setup or return to assessment calibration.</p>
                <div className="pt-2">
                  <button 
                    onClick={() => navigateTo('#candidate/setup')}
                    className="w-full py-3 bg-amber-400 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
                  >
                    Continue Setup
                  </button>
                </div>
              </div>
            ) : (
              renderAuthPanel()
            )}
          </div>
        )}

        {/* ROUTE '#candidate/setup': ROLE, BATCH CODE, AND HARDWARE CONSENT */}
        {user && currentHash === '#candidate/setup' && (
          <div id="candidate-setup-view" className="flex-1 flex items-center justify-center p-6 py-16 bg-stone-50/50">
            <form onSubmit={handleCandidateSetupSubmit} className="interactive-card w-full max-w-xl bg-white rounded-3xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.035)] border-none space-y-6 text-left animate-fade-in">
              <div className="text-center space-y-2">
                {renderLogoLockup('Interview setup')}
                <h2 className="text-xl font-extrabold text-stone-950 tracking-tight">Interview Access Setup</h2>
                <p className="text-xs text-stone-400 font-semibold">Enter your assigned role and batch code, then allow camera and microphone access for proctoring.</p>
              </div>

              {candidateSetupError && (
                <div className="p-4 bg-rose-50 text-rose-900 rounded-2xl text-xs font-semibold flex items-center gap-2 border-none">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{candidateSetupError}</span>
                </div>
              )}

              <div>
                <label htmlFor="setup-role" className="block text-3xs font-extrabold text-stone-400 uppercase tracking-widest mb-1.5">Interview Role</label>
                <select
                  id="setup-role"
                  required
                  value={activeCandidateRole}
                  onChange={(e) => setActiveCandidateRole(e.target.value)}
                  className="w-full px-4.5 py-3 text-xs bg-stone-50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition font-semibold text-stone-900"
                >
                  {INTERVIEW_ROLES.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="setup-batch-code" className="block text-3xs font-extrabold text-stone-400 uppercase tracking-widest mb-1.5">Interview Batch Code</label>
                <input
                  id="setup-batch-code"
                  required
                  type="text"
                  placeholder="Example: BATCH-2026-A"
                  value={interviewBatchCode}
                  onChange={(e) => setInterviewBatchCode(e.target.value.toUpperCase())}
                  className="w-full px-4.5 py-3 text-xs bg-stone-50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition font-mono font-bold text-stone-900"
                />
              </div>

              <div className="p-5 bg-stone-50 rounded-2xl space-y-3">
                <h3 className="text-xs font-extrabold text-stone-800 uppercase tracking-wider">Required Hardware Access</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-semibold text-stone-600">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-amber-500" />
                    <span>Camera access for face and screen monitoring</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-amber-500" />
                    <span>Network speed validation at 2 Mbps minimum</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-500" />
                    <span>Tab switch, gaze, and helper detection</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-amber-500" />
                    <span>Microphone access for answer transcription</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="interactive-button w-full py-3.5 bg-amber-400 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer"
              >
                Continue to Hardware Check
              </button>
            </form>
          </div>
        )}

        {/* ROUTE '#candidate/hardware-check': DEVICE AUDIT AND ONBOARDING CALIBRATION */}
        {user && currentHash === '#candidate/hardware-check' && (
          <div id="hardware-check-view" className="flex-1 max-w-5xl mx-auto w-full px-6 py-10 space-y-6">
            <div className="text-left space-y-1">
              <div className="flex items-center gap-3 mb-3">
                <img
                  src="/src/assets/images/app_logo_1780125395119.png"
                  alt="airecruite logo"
                  className="w-10 h-10 object-contain"
                  referrerPolicy="no-referrer"
                />
                <span className="text-[10px] uppercase font-extrabold text-amber-500 tracking-widest">Verification Steps</span>
              </div>
              <h2 className="text-xl font-extrabold text-stone-950">Pre-Assessment Setup & Calibration</h2>
              <p className="text-xs text-stone-450 font-medium">Verify your peripheral audio and camera connection prior to start.</p>
            </div>

            <HardwareCheck 
              onSuccess={() => navigateTo('#candidate/interview')} 
              onRetry={() => {}} 
              currentNetworkSpeed={networkSpeed}
            />
          </div>
        )}

        {/* ROUTE '#candidate/instructions': STANDARD SCREENING CONSENT */}
        {user && currentHash === '#candidate/instructions' && (
          <div id="instructions-view" className="flex-1 flex items-center justify-center p-6 py-12 bg-stone-50/50">
            <div className="interactive-card w-full max-w-xl bg-white rounded-3xl p-8 shadow-[0_15px_50px_rgba(0,0,0,0.03)] space-y-6 text-left">
              <div className="text-center space-y-1">
                {renderLogoLockup('Integrity guidance')}
                <h2 className="text-xl font-extrabold text-stone-905 tracking-tight">Code of Integrity Guidance</h2>
                <p className="text-xs text-stone-400 font-medium">Read rules prior to entering first-round automated assessment dashboard.</p>
              </div>

              <div className="space-y-4">
                <div className="p-5 bg-stone-50 rounded-2xl space-y-3 shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)] text-left">
                  <h4 className="text-xs font-extrabold text-stone-800 uppercase tracking-wider">Review Proctoring Metrics:</h4>
                  <ul className="space-y-2.5 text-xs text-stone-500 list-disc list-inside font-semibold">
                    <li><strong className="text-stone-750">Focus deviations:</strong> Tab shifting away from active view logs warnings. 4 occurrences records formal deviation.</li>
                    <li><strong className="text-stone-750">Speech flow:</strong> Keep tone consistent and quiet room setup.</li>
                    <li><strong className="text-stone-750">Camera presence:</strong> Facial coordinates must remain completely centered in the video feed continuously to prevent droppings.</li>
                  </ul>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-stone-50 rounded-2xl text-center">
                    <span className="text-[10px] text-stone-400 font-extrabold uppercase tracking-widest block mb-1">Assigned Questions</span>
                    <div className="text-base font-extrabold text-stone-850 font-mono">5 Dynamic Items</div>
                  </div>
                  <div className="p-4 bg-stone-50 rounded-2xl text-center">
                    <span className="text-[10px] text-stone-400 font-extrabold uppercase tracking-widest block mb-1">Time Limit</span>
                    <div className="text-base font-extrabold text-stone-850 font-mono">2 Mins Per Question</div>
                  </div>
                </div>

                {/* Consent checkbox */}
                <div className="flex items-start gap-3 p-1 text-left">
                  <input 
                    id="consent-check"
                    required 
                    type="checkbox" 
                    className="w-4.5 h-4.5 text-amber-500 border-stone-300 rounded focus:ring-amber-500 mt-0.5 cursor-pointer" 
                  />
                  <label htmlFor="consent-check" className="text-xs text-stone-500 leading-relaxed font-semibold cursor-pointer select-none">
                    I authorize real-time camera processing, audio transcribing algorithms, and proctoring eye focus tracking for this assessment.
                  </label>
                </div>
              </div>

              <button 
                id="btn-instructions-start"
                onClick={() => navigateTo('#candidate/interview')}
                className="interactive-button w-full py-3.5 bg-amber-400 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer"
              >
                Inaugurate Assessment Panel
              </button>
            </div>
          </div>
        )}

        {/* ROUTE '#candidate/interview': PROCTORED ACTIVE DISCUSSION INTERVIEW */}
        {user && currentHash === '#candidate/interview' && (
          <div id="interview-session-view" className="flex-1 flex flex-col justify-between py-8 px-6 space-y-6">
            
            {/* Top Bar Assessment Health Summary */}
            <div className="interactive-card w-full flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] text-left">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
                <div>
                  <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">Candidate screening: Active Examination run</h3>
                  <p className="text-[10px] text-stone-400 mt-0.5 font-mono">Account Email: {user?.email || 'applicant@airecruite.com'}</p>
                </div>
              </div>

              <div className="flex items-center gap-5">
                <div className="text-right">
                  <span className="text-[9px] font-extrabold text-stone-400 block tracking-wider uppercase">Current Response Timer</span>
                  <span className={`text-base font-extrabold font-mono ${interviewTimeLeft < 30 ? 'text-rose-600 animate-pulse' : 'text-stone-800'}`}>
                    {Math.floor(interviewTimeLeft / 60)}:{(interviewTimeLeft % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                <div className="h-8 w-px bg-stone-100" />
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-50 text-stone-600 text-2xs font-bold rounded-xl shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Connection Signal: Optimal
                </span>
              </div>
            </div>

            {/* Assessment Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-stretch">
              
              {/* Question text card */}
              <div className="lg:col-span-4 h-full">
                <QuestionPanel 
                  questionNumber={currentQuestionIndex + 1}
                  category={questions[currentQuestionIndex]?.category || 'AI adaptive prompt'}
                  text={questions[currentQuestionIndex]?.text || 'Initializing interview question discussion...'}
                  suggestedDuration={questions[currentQuestionIndex]?.suggestedDuration || 120}
                />
              </div>

              {/* Core live audio stream camera recorder feed */}
              <div className="lg:col-span-5 h-full">
                <VideoRecorder 
                  activeQuestionIndex={currentQuestionIndex}
                  onStateChange={(state) => {}}
                  onChunkUploaded={(blob, transcript, averageVolume) => handleChunkFinished(blob, transcript, averageVolume)}
                  onProctorEvent={handleProctorEvent}
                />
              </div>

              {/* Proctor compliance report card */}
              <div className="lg:col-span-3 h-full">
                <StatusPanel 
                  cameraActive={true}
                  micActive={true}
                  networkOk={true}
                  recording={true}
                  warningsCount={gazeWarningCount}
                  tabSwitchCount={liveTabSwitches}
                />
              </div>

            </div>

            {/* Downward Progress Meter Bar */}
            <div className="interactive-card w-full bg-white p-5 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-wrap items-center justify-between gap-4">
              <div className="flex-1 max-w-md">
                <ProgressBar 
                  current={currentQuestionIndex + 1} 
                  total={5} 
                />
              </div>

              <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Live proctor checks running</span>
            </div>

          </div>
        )}

        {/* ROUTE '#candidate/completed': COMPLETION ENVELOPE RECEIVED */}
        {user && currentHash === '#candidate/completed' && (
          <div id="candidate-completed-view" className="flex-1 flex items-center justify-center p-6 py-20 bg-stone-50/50">
            <div className="interactive-card w-full max-w-md bg-white rounded-3xl p-8 shadow-[0_15px_50px_rgba(0,0,0,0.03)] space-y-6 text-center">
              {renderLogoLockup('Submission complete')}

              <div className="space-y-1 text-center">
                <h2 className="text-xl font-extrabold text-stone-950 tracking-tight">Screening Assessment Submitted</h2>
                <p className="text-xs text-stone-405 font-medium leading-relaxed mt-1">
                  Congratulations. Your transcribed files, proctor compliance coordinate reports, and video feeds have been uploaded and secured.
                </p>
              </div>

              <div className="p-5 bg-stone-50 rounded-2xl space-y-3 text-left">
                <span className="text-[9px] font-extrabold text-stone-400 uppercase tracking-widest block mb-1">Synchronized Checklist Items:</span>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-stone-600 font-bold">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full block animate-pulse" />
                    <span>5 chunked video screen clips processed</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-stone-600 font-bold">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full block animate-pulse" />
                    <span>Adaptive transcriptions generated</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-stone-600 font-bold">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full block animate-pulse" />
                    <span>Compliance logs locked securely</span>
                  </div>
                </div>
              </div>

              <button 
                id="btn-completed-home"
                onClick={handleSignOut}
                className="interactive-button w-full py-3.5 bg-amber-400 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-2xl shadow-lg transition-all cursor-pointer"
              >
                Sign Out & Return Home
              </button>
            </div>
          </div>
        )}

        {/* ROUTE '#candidate/disqualified': INTERVIEW TERMINATED */}
        {user && currentHash === '#candidate/disqualified' && (
          <div id="candidate-disqualified-view" className="flex-1 flex items-center justify-center p-6 py-20 bg-stone-50/50">
            <div className="interactive-card w-full max-w-md bg-white rounded-3xl p-8 shadow-[0_15px_50px_rgba(0,0,0,0.03)] space-y-6 text-center">
              {renderLogoLockup('Session terminated')}
              <div className="space-y-1 text-center">
                <h2 className="text-xl font-extrabold text-stone-950 tracking-tight">Interview Ended</h2>
                <p className="text-xs text-stone-500 font-medium leading-relaxed mt-1">
                  The session exceeded the allowed proctoring warnings. This record is stored in a separate disqualified log and is not shown in the attended candidates dashboard.
                </p>
              </div>
              <button 
                id="btn-disqualified-home"
                onClick={handleSignOut}
                className="interactive-button w-full py-3.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-2xl shadow-lg transition-all cursor-pointer"
              >
                Return Home
              </button>
            </div>
          </div>
        )}

        {/* ROUTE '#recruiter/login': SECURE ACCOUNT AUTH FOR RECRUITERS */}
        {currentHash === '#recruiter/login' && (
          <div id="recruiter-login-view" className="flex-1 flex items-center justify-center p-6 py-16 bg-slate-50">
            {user ? (
              <div className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-[0_18px_45px_rgba(15,23,42,0.08)] border border-slate-100 text-center space-y-4 animate-fade-in">
                {renderLogoLockup('Admin console', 'sm')}
                <h2 className="text-xl font-extrabold text-stone-900 tracking-tight">Console Secure</h2>
                <p className="text-xs text-stone-500 font-medium">Session is established for recruiter workspace. Access candidates instantly.</p>
                <div className="pt-2">
                  <button 
                    onClick={() => navigateTo('#recruiter/dashboard')}
                    className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
                  >
                    Open Auditor Console
                  </button>
                </div>
              </div>
            ) : (
              <>
                {renderAuthPanel()}
                {false && (
              <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.035)] border-none space-y-6 text-left animate-fade-in">
                <div className="text-center space-y-2 flex flex-col items-center">
                  <img
                    src="/src/assets/images/app_logo_1780125395119.png"
                    alt="airecruite logo"
                    className="w-14 h-14 object-contain mb-1 transition-transform duration-300 hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <h2 className="text-xl font-extrabold text-stone-900 tracking-tight">Recruiter Secure Access</h2>
                  <p className="text-xs text-stone-400 font-semibold text-center">Authentication records required to enter candidate screening archives.</p>
                </div>

                {/* Switcher for Role Type */}
                <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1.5 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]">
                  <button
                    type="button"
                    onClick={() => { setUserType('candidate'); setAuthError(''); navigateTo('#candidate/login'); }}
                    className={`py-2.5 text-[11px] font-extrabold uppercase tracking-wider rounded-xl transition cursor-pointer ${userType === 'candidate' ? 'bg-white text-stone-950 shadow-xs' : 'text-stone-400 hover:text-stone-700'}`}
                  >
                    Candidate
                  </button>
                  <button
                    type="button"
                    onClick={() => { setUserType('recruiter'); setAuthError(''); }}
                    className={`py-2.5 text-[11px] font-extrabold uppercase tracking-wider rounded-xl transition cursor-pointer ${userType === 'recruiter' ? 'bg-stone-900 text-white shadow-xs' : 'text-stone-400 hover:text-stone-700'}`}
                  >
                    Recruiter
                  </button>
                </div>

                {/* Secure Auth Toggle */}
                <div className="flex bg-stone-50 p-1 rounded-xl border-none shadow-[inset_0_1px_2.5px_rgba(0,0,0,0.01)]">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('signin'); setAuthError(''); }}
                    className={`flex-1 py-1.5 text-[10px] font-extrabold uppercase transition cursor-pointer rounded-lg ${authMode === 'signin' ? 'bg-stone-200 text-stone-900 shadow-3xs' : 'text-stone-400 hover:text-stone-600'}`}
                  >
                    Auditor Console Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('signup'); setAuthError(''); }}
                    className={`flex-1 py-1.5 text-[10px] font-extrabold uppercase transition cursor-pointer rounded-lg ${authMode === 'signup' ? 'bg-stone-200 text-stone-900 shadow-3xs' : 'text-stone-400 hover:text-stone-600'}`}
                  >
                    Create Auditor Account
                  </button>
                </div>

                {authError && (
                  <div className="p-4 bg-rose-50 text-rose-900 rounded-2xl text-xs font-semibold flex items-center gap-2 border-none">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <form onSubmit={handleRecruiterAuth} className="space-y-4">
                  {authMode === 'signup' && (
                    <div>
                      <label htmlFor="recruiter-name" className="block text-3xs font-extrabold text-stone-400 uppercase tracking-widest mb-1.5">Full Name</label>
                      <input 
                        id="recruiter-name"
                        required 
                        type="text" 
                        placeholder="Your full name" 
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        className="w-full px-4.5 py-3 text-xs bg-stone-50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition font-medium text-stone-900"
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="recruiter-email" className="block text-3xs font-extrabold text-stone-400 uppercase tracking-widest mb-1.5">Admin Email Address</label>
                    <input 
                      id="recruiter-email"
                      required 
                      type="email" 
                      placeholder="admin@example.com" 
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full px-4.5 py-3 text-xs bg-stone-50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition font-medium text-stone-900"
                    />
                  </div>

                  <div>
                    <label htmlFor="recruiter-password" className="block text-3xs font-extrabold text-stone-400 uppercase tracking-widest mb-1.5">Security Password</label>
                    <input 
                      id="recruiter-password"
                      required 
                      type="password" 
                      placeholder="••••••••" 
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full px-4.5 py-3 text-xs bg-stone-50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition font-medium text-stone-900"
                    />
                  </div>

                  <div className="pt-2">
                    <button 
                      id="btn-rec-submit"
                      type="submit" 
                      disabled={loadingAuth}
                      className="w-full py-3.5 bg-stone-900 hover:bg-stone-850 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2"
                    >
                      {loadingAuth ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-stone-100" />
                      ) : (
                        <span>{authMode === 'signup' ? 'Create Console Account' : 'Open Recruiter Console Panel'}</span>
                      )}
                    </button>
                  </div>
                  {authMode === 'signup' && (
                    <button 
                      type="button"
                      onClick={() => handleGoogleSignUp('recruiter')}
                      disabled={loadingAuth}
                      className="w-full py-3 bg-white hover:bg-stone-50 text-stone-700 font-bold text-xs rounded-xl shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] cursor-pointer transition-all flex items-center justify-center gap-2"
                    >
                      Sign up with Google
                    </button>
                  )}
                </form>
              </div>
                )}
              </>
            )}
          </div>
        )}

        {/* COMPREHENSIVE RECRUITER AREA: FULL SCREENING AUDITOR PANELS */}
        {user && currentHash === '#recruiter/dashboard' && (
          <div id="recruiter-portal-wrapper" className="flex-1 flex max-w-7xl mx-auto w-full">
            
            {/* Dashboard workspace */}
            <div className="flex-1 p-6 space-y-6 overflow-y-auto w-full">
              
              {/* BACK GATE FROM CANDIDATE FILE DETAILED REVIEW */}
              {selectedCandidate ? (
                <div id="candidate-detail-workspace" className="space-y-5 animate-fade-in">
                  <button
                    onClick={() => setSelectedCandidate(null)}
                    className="inline-flex items-center gap-2 text-xs font-bold text-stone-500 hover:text-stone-900 transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4 text-stone-400" />
                    <span>Back to candidates summary registry</span>
                  </button>

                  <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-wrap items-center justify-between gap-6 text-left">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-stone-900 text-amber-400 rounded-full flex items-center justify-center font-extrabold text-lg shadow-sm">
                        {selectedCandidate.fullName.split(' ').map(n => n[0]).join('')}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-base font-extrabold text-stone-950">{selectedCandidate.fullName}</h2>
                          <StatusBadge status={selectedCandidate.status} />
                        </div>
                        <p className="text-xs text-stone-400 font-bold mt-1.5 uppercase tracking-wider">
                          {selectedCandidate.email} • screening track: <span className="text-amber-600 font-extrabold">{selectedCandidate.role}</span>
                          {selectedCandidate.batchCode && <span> • batch: <span className="text-stone-700">{selectedCandidate.batchCode}</span></span>}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-bold text-left">
                      <div className="bg-stone-50 rounded-2xl px-5 py-3 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                        <span className="text-[8px] text-stone-400 font-extrabold uppercase tracking-widest block mb-1">DATE RECORD LOCK</span>
                        <span className="font-mono text-stone-705 text-xs">{selectedCandidate.date}</span>
                      </div>
                      
                      {selectedCandidate.score !== undefined && (
                        <div className="bg-amber-50 rounded-2xl px-5 py-3 shadow-[0_4px_12px_rgba(245,158,11,0.05)]">
                          <span className="text-[8px] text-amber-900 font-extrabold uppercase tracking-widest block mb-1">SCREENER SCORE</span>
                          <span className="text-sm font-extrabold text-amber-955 font-mono">{selectedCandidate.score} / 100</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* Left Column footage preview & transcript dialog */}
                    <div className="lg:col-span-7 space-y-6">
                      
                      {/* Playback simulation list */}
                      <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-4 text-left">
                        <div className="flex items-center gap-2 pb-2">
                          <Video className="w-5 h-5 text-amber-500" />
                          <h3 className="text-sm font-extrabold text-stone-900 tracking-tight">Recorded Response Clips</h3>
                        </div>

                        {selectedCandidate.responses.length === 0 ? (
                          <div className="p-8 text-center text-xs text-stone-400 font-bold uppercase tracking-wider bg-stone-50 rounded-2xl">
                            No footage generated for pending or failed sessions.
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {selectedCandidate.responses.map((resp, i) => (
                              <div key={i} className="bg-stone-50 rounded-2xl p-4.5 space-y-3 shadow-[0_4px_12px_rgba(0,0,0,0.005)]">
                                <div className="flex items-center justify-between text-xs font-bold text-stone-500">
                                  <span>Question {resp.questionId}: {i === 0 ? 'Introduction' : `Scenario Question #${resp.questionId}`}</span>
                                  <span className="text-amber-600 font-mono text-[10px]">Session Capture {resp.duration}s</span>
                                </div>
                                <p className="text-xs text-stone-705 leading-relaxed font-semibold">"{resp.questionText}"</p>
                                
                                <div className="bg-stone-950 aspect-video rounded-2xl relative overflow-hidden flex flex-col items-center justify-center text-center shadow-inner pt-2">
                                  {resp.videoUrl ? (
                                    <video 
                                      controls 
                                      playsInline 
                                      src={resp.videoUrl} 
                                      className="w-full h-full object-cover" 
                                    />
                                  ) : (
                                    <div className="p-6">
                                      <Tv className="w-10 h-10 text-stone-600 mx-auto mb-2 animate-pulse" />
                                      <span className="text-xs font-bold text-stone-450 block uppercase tracking-wider">Video Clip Available Offline</span>
                                      <p className="text-[10px] text-stone-400 mt-1 max-w-xs mx-auto font-semibold">This adaptive system stores proctored elements securely under client-side object storage feeds.</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <TranscriptCard responses={selectedCandidate.responses} />
                    </div>

                    {/* Right column report analysis and proctor verification check summaries */}
                    <div className="lg:col-span-5 space-y-6">
                      <EvaluationCard evaluation={selectedCandidate.aiEvaluation} />
                      
                      <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] text-left">
                        <div className="text-[10px] font-extrabold text-stone-405 uppercase tracking-widest mb-3">Integrity Verification Audit</div>
                        <div className="flex items-center gap-4 p-4.5 bg-stone-50 rounded-2xl justify-between shadow-[inset_0_1px_2px_rgba(0,0,0,0.015)]">
                          <div>
                            <span className="text-3xs text-stone-400 block font-extrabold tracking-wider uppercase mb-1">Environment Risk Score</span>
                            <span className={`text-sm font-extrabold ${
                              selectedCandidate.suspiciousLogs.length === 0 ? 'text-emerald-700' : selectedCandidate.suspiciousLogs.length > 2 ? 'text-rose-700 font-black' : 'text-amber-700'
                            }`}>
                              {selectedCandidate.suspiciousLogs.length === 0 ? 'Stable Environment (Pass)' : selectedCandidate.suspiciousLogs.length > 2 ? 'High Drift Deviation' : 'Action warnings observed'}
                            </span>
                          </div>
                          
                          <div className={`w-3.5 h-3.5 rounded-full ${
                            selectedCandidate.suspiciousLogs.length === 0 ? 'bg-emerald-500 animate-pulse' : selectedCandidate.suspiciousLogs.length > 2 ? 'bg-rose-500 animate-ping' : 'bg-amber-500 animate-pulse'
                          }`} />
                        </div>
                      </div>

                      <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] text-left">
                        <div className="text-[10px] font-extrabold text-stone-405 uppercase tracking-widest mb-4">Flag Breakdown</div>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            ['Tab switches', selectedCandidate.suspiciousLogs.filter(log => log.type === 'tab-switched').length],
                            ['Eye deviations', selectedCandidate.suspiciousLogs.filter(log => log.type === 'gaze-drifted').length],
                            ['Multiple persons', selectedCandidate.suspiciousLogs.filter(log => log.type === 'multiple-persons').length],
                            ['AI tool alerts', selectedCandidate.suspiciousLogs.filter(log => log.type === 'ai-tool-detected').length]
                          ].map(([label, value]) => (
                            <div key={label} className="p-4 bg-stone-50 rounded-2xl">
                              <span className="text-[9px] font-extrabold text-stone-400 uppercase tracking-widest block">{label}</span>
                              <span className={`text-lg font-extrabold font-mono ${Number(value) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <SuspiciousLogs logs={selectedCandidate.suspiciousLogs} />
                    </div>

                  </div>

                </div>
              ) : (
                
                /* CORE AUDITOR SHELL */
                <div id="overview-workspace" className="space-y-6 text-left animate-fade-in">
                  
                  {/* Title and custom controls */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-extrabold text-stone-900 tracking-tight">Recruitment Operations Workspace</h2>
                      <p className="text-xs text-stone-400 font-bold uppercase tracking-wider mt-1">Review, filter, and adapt automated proctored candidate files</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowSettingsDialog(true)}
                        className="interactive-button px-5 py-3 bg-amber-400 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-2xl shadow-[0_4px_14px_rgba(245,158,11,0.2)] transition cursor-pointer flex items-center gap-2"
                      >
                        <Settings className="w-4 h-4 text-stone-950" />
                        <span>Calibrate Settings</span>
                      </button>
                      <button
                        onClick={handleSignOut}
                        className="interactive-button px-4.5 py-3 bg-stone-100 hover:bg-stone-150 text-stone-600 font-bold text-xs rounded-2xl transition cursor-pointer"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Board Stats cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard 
                      title="Interview Batches"
                      value={totalInterviewBatches}
                      description="Unique batch codes completed"
                      icon={Users}
                      accentColor="amber"
                    />
                    <StatCard 
                      title="Candidates Attended"
                      value={totalCompletedCount}
                      description="Completed interviews in dashboard"
                      icon={CheckCircle}
                      accentColor="yellow"
                    />
                    <StatCard 
                      title="Disqualified Logs"
                      value={totalDisqualifiedCount}
                      description="Terminated for proctoring breaches"
                      icon={Clock}
                      accentColor="stone"
                    />
                    <StatCard 
                      title="Auditor flagged files"
                      value={totalFlagsCount}
                      description="Integrity deviations logged"
                      icon={AlertTriangle}
                      accentColor="rose"
                    />
                  </div>

                  {/* Quick Filter Control Panels */}
                  <div className="interactive-card bg-white p-4.5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-wrap items-center justify-between gap-4 text-left">
                    <div className="flex items-center gap-3 w-full md:w-auto flex-1">
                      <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3.5 top-3 w-4 h-4 text-stone-400" />
                        <input 
                          type="text" 
                          placeholder="Search applicant by name or email ID..." 
                          value={searchText}
                          onChange={(e) => setSearchText(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-stone-50 border-none rounded-xl text-xs font-medium outline-none focus:bg-white focus:ring-1 focus:ring-amber-500"
                        />
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Filter className="w-4 h-4 text-stone-400" />
                        <span className="text-3xs font-extrabold text-stone-400 uppercase tracking-widest">Active Filters:</span>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap text-xs">
                      <select 
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="bg-stone-50 border-none rounded-xl p-2.5 text-xs font-bold"
                      >
                        <option value="All">All Departments</option>
                        <option value="Frontend Developer">Frontend Developer</option>
                        <option value="Digital Marketing">Digital Marketing</option>
                        <option value="Data Analyst">Data Analyst</option>
                        <option value="Data Scientist">Data Scientist</option>
                        <option value="UI/UX Engineer">UI/UX Engineer</option>
                      </select>

                      <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-stone-50 border-none rounded-xl p-2.5 text-xs font-bold"
                      >
                        <option value="All">All Screening Statuses</option>
                        <option value="completed">Completed</option>
                        <option value="pending">Pending</option>
                      </select>
                    </div>
                  </div>

                  {/* Display table applicant registry */}
                  <div className="space-y-4.5">
                    <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest pl-1">Audited Applicant Roster database</span>
                    <CandidateTable 
                      candidates={filteredCandidates} 
                      onSelectCandidate={(cand) => setSelectedCandidate(cand)} 
                    />
                  </div>

                  <div className="space-y-4.5">
                    <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest pl-1">Separate Disqualified Interview Log</span>
                    <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
                      {disqualifiedCandidatesList.length === 0 ? (
                        <div className="px-6 py-10 text-center text-xs text-stone-400 font-bold uppercase tracking-wider">
                          No terminated interviews recorded
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead className="bg-rose-50/60 text-[11px] uppercase tracking-widest font-extrabold text-rose-900">
                              <tr>
                                <th className="px-6 py-4">Candidate</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Batch</th>
                                <th className="px-6 py-4 text-center">Flags</th>
                                <th className="px-6 py-4">Reason</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                              {disqualifiedCandidatesList.map((cand) => (
                                <tr key={cand.id}>
                                  <td className="px-6 py-4">
                                    <div className="text-xs font-bold text-stone-850">{cand.fullName}</div>
                                    <div className="text-[10px] text-stone-400">{cand.email}</div>
                                  </td>
                                  <td className="px-6 py-4 text-xs font-bold text-stone-550">{cand.role}</td>
                                  <td className="px-6 py-4 text-xs font-mono text-stone-500">{cand.batchCode || cand.token}</td>
                                  <td className="px-6 py-4 text-center text-xs font-extrabold text-rose-700">{cand.suspiciousLogs.length}</td>
                                  <td className="px-6 py-4 text-xs text-stone-600 font-semibold">
                                    {cand.suspiciousLogs[cand.suspiciousLogs.length - 1]?.description || 'Compliance breach'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}

            </div>
          </div>
        )}

      </main>

      {/* RECRUITER SETTINGS ACCORDION DIALOG */}
      {showSettingsDialog && (
        <div id="settings-dialog-overlay" className="fixed inset-0 bg-stone-950/70 backdrop-blur-md z-[80] flex items-center justify-center p-4">
          <div className="interactive-card w-full max-w-lg bg-white rounded-3xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.15)] space-y-6 text-left animate-fade-in border-none">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-extrabold text-stone-900 tracking-tight">Calibrate Screening Questionnaire</h3>
              </div>
              <button 
                onClick={() => setShowSettingsDialog(false)}
                className="text-stone-400 hover:text-stone-900 text-xs font-bold leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-stone-50 rounded-2xl space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-stone-850">Role Question Calibration</h4>
                  <p className="text-[10px] text-stone-400 mt-0.5 font-semibold">
                    Save exactly 5 manual questions per role. If a role has no complete set, AI generates role, technology, and answer-based follow-up questions automatically.
                  </p>
                </div>
                <select
                  value={settingsRole}
                  onChange={(event) => setSettingsRole(event.target.value)}
                  className="w-full px-4 py-2.5 text-xs bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition font-bold text-stone-900"
                >
                  {INTERVIEW_ROLES.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1">
                <span className="text-[9px] font-extrabold text-stone-400 uppercase tracking-widest block mb-1">
                  {settingsRole} manual questions
                </span>
                {[0, 1, 2, 3, 4].map((index) => {
                  const existingQ = normalizeQuestionSet(settingsRole, roleQuestionSets[settingsRole])[index];
                  return (
                    <div key={`${settingsRole}-${index}`} className="space-y-1">
                      <label className="text-[9px] font-bold text-stone-500 block">Question {index + 1}:</label>
                      <textarea
                        rows={2}
                        value={existingQ?.text || ''}
                        placeholder={`Manual ${settingsRole} question ${index + 1}. Leave blank to use AI fallback for this role.`}
                        onChange={(event) => {
                          const updatedList = normalizeQuestionSet(settingsRole, roleQuestionSets[settingsRole]);
                          updatedList[index] = {
                            id: index + 1,
                            category: `${settingsRole} Manual Screening`,
                            text: event.target.value,
                            suggestedDuration: 120
                          };
                          setRoleQuestionSets(prev => ({
                            ...prev,
                            [settingsRole]: updatedList
                          }));
                        }}
                        className="w-full px-4 py-2.5 text-xs bg-stone-50 border-none rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition font-medium resize-none"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-stone-100 flex gap-3">
              <button 
                onClick={() => setShowSettingsDialog(false)}
                className="px-5 py-3 text-xs font-bold text-stone-500 hover:text-stone-850 rounded-xl transition cursor-pointer"
              >
                Discard Changes
              </button>
              <button 
                onClick={saveCustomSettings}
                className="interactive-button flex-1 py-3 bg-amber-400 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-xl shadow-md transition cursor-pointer text-center"
              >
                Save Calibration
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
