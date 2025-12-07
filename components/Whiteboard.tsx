import React, { useState, useEffect } from 'react';
import { JamboardStep } from '../types';
import { generateJamboardExplanation, generateImageFromPrompt } from '../services/geminiService';
import Loader from './Loader';
import { ArrowLeftIcon, ArrowRightIcon, SpeakerWaveIcon, StopIcon } from './icons';
import { useLanguage } from '../contexts/LanguageContext';

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

const Jamboard = () => {
  const [topic, setTopic] = useState('');
  const [steps, setSteps] = useState<JamboardStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const synth = window.speechSynthesis;
  const { language, t } = useLanguage();

  useEffect(() => {
    // Cleanup speechSynthesis on component unmount
    return () => {
      if (synth.speaking) {
        synth.cancel();
      }
    };
  }, [synth]);


  const handleGenerate = async () => {
    if (!topic) return;
    
    // Reset all states
    setIsLoading(true);
    setError(null);
    setSteps([]);
    setCurrentStepIndex(0);
    if (synth.speaking) synth.cancel();


    try {
      const initialSteps = await generateJamboardExplanation(topic, language);
      setSteps(initialSteps);
      setIsLoading(false);

      // Kick off image generation for each step and update state as they complete
      initialSteps.forEach((step, index) => {
        generateImageFromPrompt(step.visual_prompt)
          .then(imageUrl => {
            setSteps(prevSteps => {
              const newSteps = [...prevSteps];
              if (newSteps[index]) {
                newSteps[index] = { ...newSteps[index], imageUrl };
              }
              return newSteps;
            });
          })
          .catch(err => {
            console.error(`Image generation failed for step ${index + 1}:`, err);
          });
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setIsLoading(false);
    }
  };
  
  const handleToggleAudio = (text: string) => {
    if (synth.speaking) {
        synth.cancel();
        setIsSpeaking(false);
    } else {
        const utterance = new SpeechSynthesisUtterance(text);
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

  const currentStep = steps[currentStepIndex];

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h2 className="text-3xl font-bold text-text-light-mode dark:text-text-dark-mode mb-2">{t('jamboardTitle')}</h2>
      <p className="text-gray-600 dark:text-gray-300 mb-6">{t('jamboardSubtitle')}</p>
      
      <div className="flex gap-2 mb-8">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={t('jamboardPlaceholder')}
          className="flex-grow px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-700 dark:border-gray-600 dark:text-white"
        />
        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className="px-6 py-2 bg-secondary text-white font-bold rounded-lg hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary disabled:bg-gray-400 transition-colors"
        >
          {isLoading ? t('generating') : t('explain')}
        </button>
      </div>

      {isLoading && <Loader text={t('generatingExplanation')} />}
      {error && <p className="text-red-500 text-center">{error}</p>}
      
      {steps.length > 0 && currentStep && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2">
                <div className="p-6 md:p-8 flex flex-col">
                    <div>
                      <h3 className="text-xl font-bold text-primary mb-4">{t('step')} {currentStep.step}: {topic}</h3>
                      <p className="text-gray-700 dark:text-gray-200 text-lg leading-relaxed mb-4">{currentStep.explanation}</p>
                      
                      {currentStep.example && (
                        <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg">
                            <p className="font-semibold text-slate-800 dark:text-slate-300">{t('example')}</p>
                            <p className="text-gray-600 dark:text-gray-300 italic mt-1">{currentStep.example}</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-auto pt-6">
                        <button 
                            onClick={() => handleToggleAudio(currentStep.explanation)}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 font-medium rounded-lg hover:bg-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20 transition-colors w-full sm:w-auto"
                        >
                            {isSpeaking ? <StopIcon className="w-5 h-5" /> : <SpeakerWaveIcon className="w-5 h-5" />}
                            {isSpeaking ? t('stopAudio') : t('listenToExplanation')}
                        </button>
                    </div>
                </div>
                <div className="bg-slate-100 dark:bg-slate-700 flex items-center justify-center p-4 min-h-[250px]">
                    {currentStep.imageUrl ? (
                        <img src={currentStep.imageUrl} alt={currentStep.visual_prompt} className="max-w-full max-h-full object-contain rounded-lg" />
                    ) : (
                        <div className="flex flex-col items-center text-gray-500 dark:text-gray-400">
                             <div className="w-8 h-8 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
                             <span className="mt-2 text-sm">{t('generatingVisual')}</span>
                        </div>
                    )}
                </div>
            </div>
            <div className="bg-light dark:bg-slate-900 p-4 flex justify-between items-center border-t dark:border-gray-700">
                <button 
                onClick={() => { synth.cancel(); setIsSpeaking(false); setCurrentStepIndex(i => i - 1); }}
                disabled={currentStepIndex === 0}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 dark:hover:bg-slate-700 border dark:border-gray-600 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                    <ArrowLeftIcon className="w-4 h-4" /> {t('previous')}
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-300">{t('step')} {currentStepIndex + 1} / {steps.length}</span>
                <button 
                onClick={() => { synth.cancel(); setIsSpeaking(false); setCurrentStepIndex(i => i + 1); }}
                disabled={currentStepIndex === steps.length - 1}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 dark:hover:bg-slate-700 border dark:border-gray-600 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                    {t('next')} <ArrowRightIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default Jamboard;