import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, ChatMessage, InterviewConfig, InterviewType, TechnicalQuestion, TechnicalFeedback, SavedTranscript, User } from '../types';
// FIX: Removed non-existent `LiveSession` import and added `Blob` type for audio helper functions as per guidelines.
import { Chat, GoogleGenAI, Modality, LiveServerMessage, Blob } from '@google/genai';
import { createTargetedInterviewChatSession, generateTechnicalInterviewQuestions, generateTechnicalInterviewFeedback, getInterviewSystemInstruction } from '../services/geminiService';
import { ArrowLeftIcon, ArrowRightIcon, AudioIcon, SpeakerWaveIcon, StopIcon } from './icons';
import Loader from './Loader';
import { marked } from 'marked';
import ElevatorPitch from './ElevatorPitch';
import { useLanguage } from '../contexts/LanguageContext';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });


// --- Audio Helper Functions ---
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// FIX: Updated `createBlob` function to use the imported `Blob` type for its return value, aligning with best practices.
function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const getSpeechLangCode = (language: string): string => {
    switch (language) {
        case 'hi': return 'hi-IN';
        case 'ta': return 'ta-IN';
        case 'te': return 'te-IN';
        case 'kn': return 'kn-IN';
        case 'bn': return 'bn-IN';
        case 'ml': return 'ml-IN';
        default: return 'en-US';
    }
};
// --- End Audio Helper Functions ---


interface InterviewPrepProps {
  userProfile: UserProfile;
  currentUser: User;
}



type SessionState = 'idle' | 'configuring' | 'chat_active' | 'technical_active' | 'feedback' | 'session_completed' | 'elevator_pitch';
type AudioSessionStatus = 'idle' | 'connecting' | 'waiting_for_ai' | 'ai_speaking' | 'listening';

const InterviewPrep = ({ userProfile, currentUser }: InterviewPrepProps) => {
  const { language, t } = useLanguage();

  const interviewTypes: { type: InterviewType, title: string; description: string; }[] = [
    { type: 'Behavioral', title: 'Behavioral Interview', description: 'Practice answering questions about your past experiences and soft skills.'},
    { type: 'Skill-Based', title: 'Skill-Based Interview', description: 'Sharpen your knowledge based on your skills and target career.'},
    { type: 'Situational', title: 'Situational Interview', description: 'Tackle "what would you do if..." scenarios to show your judgment.'},
    { type: 'Specific Job', title: 'Prepare for a Specific Job', description: 'Paste a job description for questions tailored to a specific role.'},
    { type: 'Elevator Pitch', title: 'Elevator Pitch Practice', description: 'Refine your "Tell me about yourself" answer with targeted AI feedback.'},
  ];

  // General State
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modal and Config State
  const [modalConfig, setModalConfig] = useState<(typeof interviewTypes)[0] | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [sessionDuration, setSessionDuration] = useState('No time limit');
  const [numQuestions, setNumQuestions] = useState('3-5 Questions');
  const [jobDescription, setJobDescription] = useState('');
  const [isAudioSessionActive, setIsAudioSessionActive] = useState(false);

  // Chat Session State
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Speech Synthesis State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const synthRef = useRef(window.speechSynthesis);

  // Technical Session State
  const [questions, setQuestions] = useState<TechnicalQuestion[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<TechnicalFeedback | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  // Audio Session State
  const [audioSessionStatus, setAudioSessionStatus] = useState<AudioSessionStatus>('idle');
  const audioSessionStatusRef = useRef(audioSessionStatus);
  useEffect(() => {
    audioSessionStatusRef.current = audioSessionStatus;
  }, [audioSessionStatus]);
  // FIX: Replaced the problematic `LiveSession` type with `ReturnType<typeof ai.live.connect>` to correctly and safely infer the session promise type.
  const sessionPromiseRef = useRef<ReturnType<typeof ai.live.connect> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextAudioStartTimeRef = useRef(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');
  const lastMessageRoleRef = useRef<'user' | 'model' | null>(null);

  // Completed Session State
  const [completedSession, setCompletedSession] = useState<{messages: ChatMessage[], type: InterviewType, isAudio: boolean} | null>(null);

  // FIX: Centralized audio session cleanup logic into a single, idempotent function to prevent errors from closing resources multiple times.
  const cleanupAudio = () => {
    sessionPromiseRef.current?.then(session => session.close()).catch(console.error);
    sessionPromiseRef.current = null;
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    scriptProcessorRef.current?.disconnect();
    scriptProcessorRef.current = null;
    mediaStreamSourceRef.current?.disconnect();
    mediaStreamSourceRef.current = null;

    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
        inputAudioContextRef.current.close().catch(console.error);
    }
    inputAudioContextRef.current = null;

    audioSourcesRef.current.forEach(source => source.stop());
    audioSourcesRef.current.clear();
    
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
        outputAudioContextRef.current.close().catch(console.error);
    }
    outputAudioContextRef.current = null;
    
    synthRef.current?.cancel();
    setIsSpeaking(false);
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const synth = synthRef.current;
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      resetToIdle();
      if (synth?.speaking) {
          synth.cancel();
      }
    };
  }, []);

  const resetToIdle = () => {
    setSessionState('idle');
    setChatSession(null);
    setMessages([]);
    setQuestions([]);
    setAnswers([]);
    setFeedback(null);
    setError(null);
    
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setTimeLeft(null);
    setCompletedSession(null);

    // Audio session cleanup
    setAudioSessionStatus('idle');
    cleanupAudio();
    setIsAudioSessionActive(false);

    synthRef.current?.cancel();
    setIsSpeaking(false);
  };


  const handleStartTimer = (durationString: string) => {
    if (durationString === 'No time limit') {
      setTimeLeft(null);
      return;
    }
    const minutes = parseInt(durationString.split(' ')[0]);
    setTimeLeft(minutes * 60);

    timerIntervalRef.current = window.setInterval(() => {
      setTimeLeft(prevTime => {
        if (prevTime !== null && prevTime > 1) {
          return prevTime - 1;
        } else {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          handleFinishTechnicalSession();
          return 0;
        }
      });
    }, 1000);
  };

  const handleCardClick = (typeInfo: (typeof interviewTypes)[0]) => {
    if (typeInfo.type === 'Elevator Pitch') {
        setSessionState('elevator_pitch');
        return;
    }
    setModalConfig(typeInfo);
    setCompanyName('');
    setJobDescription('');
    setNumQuestions('3-5 Questions');
    setSessionDuration('No time limit');
    setIsAudioSessionActive(false);
    setError(null);
    setSessionState('configuring');
  };

  const startLiveAudioSession = async (config: InterviewConfig) => {
    try {
        setIsAudioSessionActive(true);
        setSessionState('chat_active');
        setIsLoading(true);
        setAudioSessionStatus('connecting');

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

        const instruction = getInterviewSystemInstruction(config, language, true);
        
        sessionPromiseRef.current = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                systemInstruction: instruction,
                responseModalities: [Modality.AUDIO],
                inputAudioTranscription: {},
                outputAudioTranscription: {},
            },
            callbacks: {
                onopen: () => {
                    setIsLoading(false);
                    setAudioSessionStatus('waiting_for_ai');
                    if (!inputAudioContextRef.current || !mediaStreamRef.current) return;
                    
                    const source = inputAudioContextRef.current.createMediaStreamSource(stream);
                    mediaStreamSourceRef.current = source;
                    const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current = processor;

                    processor.onaudioprocess = (audioProcessingEvent) => {
                        if (audioSessionStatusRef.current !== 'listening') {
                            return;
                        }
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        sessionPromiseRef.current?.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    source.connect(processor);
                    processor.connect(inputAudioContextRef.current.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    if (message.serverContent?.inputTranscription) {
                        const text = message.serverContent.inputTranscription.text;
                        currentInputTranscriptionRef.current += text;
                        setMessages(prev => {
                            const newMessages = [...prev];
                            if (lastMessageRoleRef.current !== 'user') {
                                newMessages.push({ role: 'user', content: currentInputTranscriptionRef.current });
                            } else {
                                newMessages[newMessages.length - 1].content = currentInputTranscriptionRef.current;
                            }
                            return newMessages;
                        });
                        lastMessageRoleRef.current = 'user';
                    }
                    if (message.serverContent?.outputTranscription) {
                        const text = message.serverContent.outputTranscription.text;
                        currentOutputTranscriptionRef.current += text;
                         setMessages(prev => {
                            const newMessages = [...prev];
                            if (lastMessageRoleRef.current !== 'model') {
                                newMessages.push({ role: 'model', content: currentOutputTranscriptionRef.current });
                            } else {
                                newMessages[newMessages.length - 1].content = currentOutputTranscriptionRef.current;
                            }
                            return newMessages;
                        });
                        lastMessageRoleRef.current = 'model';
                    }
                    if (message.serverContent?.turnComplete) {
                        currentInputTranscriptionRef.current = '';
                        currentOutputTranscriptionRef.current = '';
                    }

                    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (base64Audio && outputAudioContextRef.current) {
                        setAudioSessionStatus('ai_speaking');
                        const outputCtx = outputAudioContextRef.current;
                        nextAudioStartTimeRef.current = Math.max(nextAudioStartTimeRef.current, outputCtx.currentTime);
                        const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
                        const source = outputCtx.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputCtx.destination);
                        source.addEventListener('ended', () => audioSourcesRef.current.delete(source));

                        const scheduledStartTime = nextAudioStartTimeRef.current;
                        source.start(scheduledStartTime);
                        const scheduledEndTime = scheduledStartTime + audioBuffer.duration;
                        nextAudioStartTimeRef.current = scheduledEndTime;
                        audioSourcesRef.current.add(source);
                        
                        const timeUntilEndMs = (scheduledEndTime - outputCtx.currentTime) * 1000;

                        setTimeout(() => {
                           if (nextAudioStartTimeRef.current <= scheduledEndTime) {
                               setAudioSessionStatus('listening');
                           }
                        }, timeUntilEndMs > 0 ? timeUntilEndMs : 0);
                    }
                },
                onerror: (e) => {
                    console.error('Live session error:', e);
                    setError('An audio connection error occurred. Please try again.');
                    handleEndSession();
                },
                onclose: () => {},
            },
        });

    } catch (err) {
        console.error('Failed to start audio session:', err);
        setError('Could not access microphone. Please grant permission and try again.');
        handleEndSession();
    }
  };

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalConfig) return;

    setSessionState('idle'); 
    setIsLoading(true);
    setError(null);
    setIsAudioSessionActive(false);
    
    const config: InterviewConfig = {
      type: modalConfig.type,
      company: companyName,
      numQuestions: numQuestions,
      jobDescription: jobDescription,
      userProfile: userProfile,
      sessionDuration: sessionDuration,
    };
    
    try {
        if (modalConfig.type === 'Skill-Based') {
            const generatedQuestions = await generateTechnicalInterviewQuestions(config, language);
            setQuestions(generatedQuestions);
            setAnswers(new Array(generatedQuestions.length).fill(''));
            setCurrentQuestionIndex(0);
            setFeedback(null);
            setSessionState('technical_active');
            handleStartTimer(sessionDuration);
      } else {
            setMessages([]);
            const session = createTargetedInterviewChatSession(config, language);
            setChatSession(session);
            const response = await session.sendMessage({ message: "Let's begin the interview." });
            setMessages([{ role: 'model', content: response.text }]);
            setSessionState('chat_active');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start interview session.');
      resetToIdle();
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleEndSession = () => {
    synthRef.current?.cancel();
    setIsSpeaking(false);
    // Stop timer if it's running
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
    cleanupAudio(); // Clean up audio immediately, regardless of next step
    
    // Check if the session is a conversational one with content to save
    if (sessionState === 'chat_active' && messages.length > (isAudioSessionActive ? 0 : 1)) {
        setCompletedSession({ messages: [...messages], type: modalConfig!.type, isAudio: isAudioSessionActive });
        setSessionState('session_completed');
    } else {
        // For technical interviews or abandoned/empty chats, perform a full reset
        resetToIdle();
    }
  };

  const handleToggleAudio = (textToSpeak: string) => {
    const synth = synthRef.current;
    if (synth.speaking) {
      synth.cancel();
      setIsSpeaking(false);
    } else {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = marked.parse(textToSpeak) as string;
      const cleanText = tempDiv.textContent || tempDiv.innerText || '';

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = getSpeechLangCode(language);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
        console.error('SpeechSynthesis Error:', e.error);
        setIsSpeaking(false);
      };
      synth.speak(utterance);
      setIsSpeaking(true);
    }
  };
  
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || !chatSession || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: userInput };
    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsLoading(true);
    setError(null);

    try {
        const response = await chatSession.sendMessage({ message: userInput });
        setMessages(prev => [...prev, { role: 'model', content: response.text }]);
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get a response. Please try again.');
    } finally {
        setIsLoading(false);
    }
  };

  const handleAnswerChange = (text: string) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = text;
    setAnswers(newAnswers);
  };

  const handleFinishTechnicalSession = async () => {
     if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
     }
     setIsLoading(true);
     setError(null);
     try {
       const feedbackResult = await generateTechnicalInterviewFeedback(questions, answers, language);
       setFeedback(feedbackResult);
       setSessionState('feedback');
     } catch (err) {
       setError(err instanceof Error ? err.message : 'Failed to generate feedback.');
     } finally {
       setIsLoading(false);
     }
  };

  const handleSaveTranscript = () => {
    if (!completedSession) return;
    
    const newTranscript: SavedTranscript = {
        id: Date.now(),
        date: new Date().toLocaleString('en-IN'),
        type: completedSession.type,
        isAudio: completedSession.isAudio,
        messages: completedSession.messages,
    };

    try {
        const key = `interviewHistory_${currentUser.email}`;
        const existingHistory = JSON.parse(localStorage.getItem(key) || '[]');
        const updatedHistory = [...existingHistory, newTranscript];
        localStorage.setItem(key, JSON.stringify(updatedHistory));
    } catch (error) {
        console.error("Failed to save transcript:", error);
    }
    
    resetToIdle();
  };

  const formatTime = (seconds: number | null): string => {
    if (seconds === null) return t('noTimeLimit');
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreColorClass = (score: number): string => {
    if (score <= 5) return 'text-red-500';
    if (score <= 7) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getScoreBgClass = (score: number): string => {
      if (score <= 5) return 'bg-red-500/10';
      if (score <= 7) return 'bg-yellow-500/10';
      return 'bg-green-500/10';
  }

  if (isLoading && sessionState !== 'chat_active') {
    let loadingText = 'Starting your session...';
    if (sessionState === 'feedback') loadingText = t('generatingFeedback');
    if (sessionState === 'technical_active') loadingText = t('generateQuestions');
     return (
        <div className="flex flex-col items-center justify-center p-8 text-center h-full">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-lg font-semibold text-text-light-mode dark:text-text-dark-mode">{loadingText}</p>
        </div>
     );
  }

  if (sessionState === 'elevator_pitch') {
    return <ElevatorPitch onBack={() => setSessionState('idle')} />;
  }

  if (sessionState === 'session_completed') {
    return (
        <div className="p-4 sm:p-6 md:p-8 text-center">
            <div className="max-w-xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <h2 className="text-3xl font-bold text-text-light-mode dark:text-text-dark-mode mb-4">{t('interviewEnded')}</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-8">{t('transcriptSavedToProfile')}</p>
                <div className="flex justify-center gap-4">
                    <button onClick={resetToIdle} className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-text-light-mode dark:text-text-dark-mode font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                        {t('discard')}
                    </button>
                    <button onClick={handleSaveTranscript} className="px-6 py-3 bg-primary text-white font-bold rounded-lg hover:bg-blue-700 transition-colors">
                        {t('saveToProfile')}
                    </button>
                </div>
            </div>
        </div>
    );
  }

  if (sessionState === 'chat_active') {
    return (
        <div className="p-4 sm:p-6 md:p-8">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-text-light-mode dark:text-text-dark-mode">
                  {isAudioSessionActive ? t('audioInterviewSession') : t('interviewSession')}
                </h2>
                <button onClick={handleEndSession} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-text-light-mode dark:text-text-dark-mode font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                    {t('endSession')}
                </button>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col h-[70vh]">
                <div ref={chatContainerRef} className="flex-1 p-6 overflow-y-auto space-y-4">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'model' && !isAudioSessionActive && (
                                <button
                                    onClick={() => handleToggleAudio(msg.content)}
                                    className="p-2 mb-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                    aria-label={isSpeaking ? t('stopAudio') : t('listenToExplanation')}
                                >
                                    {isSpeaking ? <StopIcon className="w-5 h-5" /> : <SpeakerWaveIcon className="w-5 h-5" />}
                                </button>
                            )}
                            <div className={`prose dark:prose-invert max-w-xl lg:max-w-2xl px-4 py-3 rounded-2xl ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-slate-700 text-text-light-mode dark:text-text-dark-mode'}`}>
                                <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) as string }}></div>
                            </div>
                        </div>
                    ))}
                    {isLoading && !isAudioSessionActive && (
                        <div className="flex justify-start">
                            <div className="max-w-xl lg:max-w-2xl px-4 py-3 rounded-2xl bg-gray-100 dark:bg-slate-700 text-text-light-mode">
                                <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></div>
                                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                {error && <p className="text-red-500 text-center px-6 pb-2">{error}</p>}

                {isAudioSessionActive ? (
                    <div className="p-4 border-t dark:border-gray-700 flex flex-col items-center justify-center h-28">
                       {audioSessionStatus === 'connecting' && <span className="text-gray-500 dark:text-gray-400">{t('connectingAudio')}</span>}
                       {audioSessionStatus === 'waiting_for_ai' && (
                           <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                               <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></div>
                               <span>{t('aiStartingInterview')}</span>
                           </div>
                       )}
                       {audioSessionStatus === 'ai_speaking' && (
                           <div className="flex flex-col items-center">
                               <div className="flex items-center gap-2 text-primary">
                                   <SpeakerWaveIcon className="w-6 h-6" />
                                   <span className="font-semibold">{t('aiIsSpeaking')}</span>
                               </div>
                           </div>
                       )}
                       {audioSessionStatus === 'listening' && (
                           <div className="flex flex-col items-center">
                               <div className="flex items-center gap-2 text-green-500">
                                   <AudioIcon className="w-6 h-6 animate-pulse" />
                                   <span className="font-semibold">{t('listening')}</span>
                               </div>
                               <p className="text-xs text-gray-400 mt-1">{t('micActive')}</p>
                           </div>
                       )}
                    </div>
                ) : (
                    <div className="p-4 border-t dark:border-gray-700">
                        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={userInput}
                              onChange={(e) => setUserInput(e.target.value)}
                              placeholder={t('typeYourAnswer')}
                              className="flex-grow px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-600 dark:border-gray-500 dark:text-white"
                              disabled={isLoading}
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    if (!modalConfig) return;
                                    const config: InterviewConfig = {
                                        type: modalConfig.type,
                                        company: companyName,
                                        numQuestions: numQuestions,
                                        jobDescription: jobDescription,
                                        userProfile: userProfile,
                                        sessionDuration: sessionDuration,
                                    };
                                    startLiveAudioSession(config);
                                }}
                                disabled={isLoading}
                                className="p-3 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-dark disabled:opacity-50 transition-colors"
                                aria-label={t('startAudioInterview')}
                            >
                                <AudioIcon className="w-6 h-6" />
                            </button>
                            <button
                                type="submit"
                                disabled={!userInput.trim() || isLoading}
                                className="px-6 py-2 bg-secondary text-white font-bold rounded-lg hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary disabled:bg-gray-400 transition-colors"
                            >
                                {t('send')}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
  }

  if (sessionState === 'technical_active') {
    const currentQuestion = questions[currentQuestionIndex];
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col h-[80vh]">
          {/* Header */}
          <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
             <h2 className="text-xl font-bold text-text-light-mode dark:text-text-dark-mode">{t('technicalInterview')}</h2>
             <div className="text-lg font-semibold px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                {t('timeLeft')} <span className="text-primary font-mono">{formatTime(timeLeft)}</span>
             </div>
             <button onClick={resetToIdle} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-text-light-mode dark:text-text-dark-mode font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                {t('endSession')}
             </button>
          </div>
          {/* Body */}
          <div className="flex-1 p-6 overflow-y-auto">
             <div className="mb-4">
               <h3 className="font-semibold text-lg text-text-light-mode dark:text-text-dark-mode">{t('questions')} {currentQuestionIndex + 1} of {questions.length}</h3>
               <p className="mt-2 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg whitespace-pre-wrap">{currentQuestion?.question}</p>
             </div>
             <textarea 
                value={answers[currentQuestionIndex]}
                onChange={(e) => handleAnswerChange(e.target.value)}
                placeholder="Write your code or solution here..."
                className="w-full h-80 p-4 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-900 dark:border-gray-600 dark:text-gray-200 font-mono text-sm"
             />
          </div>
          {/* Footer */}
          <div className="p-4 border-t dark:border-gray-700 flex justify-between items-center">
            <button onClick={() => setCurrentQuestionIndex(i => i-1)} disabled={currentQuestionIndex === 0} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 dark:hover:bg-slate-700 border dark:border-gray-600 rounded-lg text-sm font-medium disabled:opacity-50">
              <ArrowLeftIcon className="w-4 h-4" /> {t('previous')}
            </button>
            {currentQuestionIndex < questions.length - 1 ? (
              <button onClick={() => setCurrentQuestionIndex(i => i+1)} className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-blue-700">{t('next')} {t('questions')}</button>
            ) : (
              <button onClick={handleFinishTechnicalSession} className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700">{t('finishAndGetFeedback')}</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (sessionState === 'feedback') {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <h2 className="text-3xl font-bold text-text-light-mode dark:text-text-dark-mode mb-4">{t('interviewFeedbackReport')}</h2>
        {isLoading ? <Loader text={t('generatingFeedback')} /> : error ? <p className="text-red-500 text-center">{error}</p> :
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 space-y-6">
            <div>
                <h3 className="text-xl font-bold text-primary mb-2">{t('overallSummary')}</h3>
                <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg flex items-center justify-center gap-4">
                    <span className="text-lg font-semibold text-text-light-mode dark:text-text-dark-mode">{t('overallScore')}</span>
                    <span className={`text-4xl font-bold ${getScoreColorClass(feedback?.overallScore || 0)}`}>{feedback?.overallScore} / 10</span>
                </div>
                <p className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{feedback?.overallSummary}</p>
            </div>

            <div className="space-y-4">
                <h3 className="text-xl font-bold text-primary border-t dark:border-gray-700 pt-4">{t('perQuestionBreakdown')}</h3>
                {feedback?.questionFeedback.map((item, index) => (
                    <div key={index} className="p-4 border dark:border-gray-600 rounded-lg">
                        <div className="flex justify-between items-start gap-4">
                           <p className="font-semibold text-text-light-mode dark:text-text-dark-mode flex-1">Q: {item.question}</p>
                           <span className={`font-bold text-lg px-3 py-1 rounded-full ${getScoreColorClass(item.score)} ${getScoreBgClass(item.score)}`}>{item.score}/10</span>
                        </div>
                        <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded">
                            <p className="font-mono text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{item.answer}</p>
                        </div>
                        <div className="mt-3 p-3 bg-green-50 dark:bg-green-500/10 rounded border-l-4 border-green-500">
                             <p className="font-semibold text-green-800 dark:text-green-300">{t('feedback')}</p>
                             <p className="mt-1 text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{item.feedback}</p>
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="text-center pt-4">
                 <button onClick={resetToIdle} className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-blue-700">{t('backToPracticeHub')}</button>
            </div>
        </div>
        }
      </div>
    );
  }


  return (
    <div className="p-4 sm:p-6 md:p-8">
        <h2 className="text-3xl font-bold text-text-light-mode dark:text-text-dark-mode text-center mb-2">{t('interviewPrepTitle')}</h2>
        <p className="text-gray-600 dark:text-gray-300 text-center mb-8">{t('interviewPrepSubtitle')}</p>

        <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {interviewTypes.map((item) => (
                    <div key={item.type} className={`bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col ${item.type === 'Elevator Pitch' ? 'lg:col-span-2' : ''}`}>
                        <h3 className="text-xl font-bold text-text-light-mode dark:text-text-dark-mode">{item.title}</h3>
                        <p className="text-gray-600 dark:text-gray-300 mt-2 mb-4 flex-grow">{item.description}</p>
                        <button onClick={() => handleCardClick(item)} className="flex items-center gap-2 text-secondary font-bold self-start hover:underline">
                            {item.type === 'Elevator Pitch' ? t('startPractice') : t('startSession')} <ArrowRightIcon className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>

        {sessionState === 'configuring' && modalConfig && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={() => setSessionState('idle')}>
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
                    <h2 className="text-2xl font-bold text-text-light-mode dark:text-text-dark-mode mb-6">{t('startInterviewTitle')} {modalConfig.title}</h2>
                    <form onSubmit={handleStartSession} className="space-y-6">
                        {modalConfig.type === 'Specific Job' ? (
                            <div>
                                <label htmlFor="jobDescription" className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">{t('jobDescription')}</label>
                                <textarea id="jobDescription" rows={6} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-700 dark:border-gray-600 dark:text-white" placeholder={t('jobDescriptionPlaceholder')} required></textarea>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label htmlFor="companyName" className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">{t('companyNameOptional')}</label>
                                    <input type="text" id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-700 dark:border-gray-600 dark:text-white" placeholder={t('companyNamePlaceholder')}/>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('companyNameHelp')}</p>
                                </div>
                            </>
                        )}
                        
                        {modalConfig.type !== 'Elevator Pitch' && modalConfig.type !== 'Specific Job' &&(
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="sessionDuration" className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">{t('sessionDuration')}</label>
                                    <select id="sessionDuration" value={sessionDuration} onChange={(e) => setSessionDuration(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-700 dark:border-gray-600 dark:text-white appearance-none bg-no-repeat" style={{backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.75rem center', backgroundSize: '1.5em 1.5em'}}>
                                        <option>{t('noTimeLimit')}</option>
                                        <option>5 {t('minutes')}</option>
                                        <option>10 {t('minutes')}</option>
                                        <option>15 {t('minutes')}</option>
                                    </select>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('sessionDurationHelp')}</p>
                                </div>
                                <div>
                                    <label htmlFor="numQuestions" className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">{t('numQuestions')}</label>
                                    <select id="numQuestions" value={numQuestions} onChange={(e) => setNumQuestions(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-700 dark:border-gray-600 dark:text-white appearance-none bg-no-repeat" style={{backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.75rem center', backgroundSize: '1.5em 1.5em'}}>
                                        <option>3-5 {t('questions')}</option>
                                        <option>5-7 {t('questions')}</option>
                                        <option>8-10 {t('questions')}</option>
                                    </select>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('numQuestionsHelp')}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-4 pt-4">
                            <button type="button" onClick={() => setSessionState('idle')} className="px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors">{t('cancel')}</button>
                            <button type="submit" className="px-6 py-3 bg-secondary text-white font-bold rounded-lg hover:bg-sky-600 transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-500" disabled={(modalConfig.type === 'Specific Job' && !jobDescription.trim())}>
                                {modalConfig.type === 'Elevator Pitch' ? t('startPractice') : t('generateQuestions')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};

export default InterviewPrep;