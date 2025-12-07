import React, { useState } from 'react';
import { ArrowLeftIcon } from './icons';
import Loader from './Loader';
import { getElevatorPitchFeedback } from '../services/geminiService';
import { ElevatorPitchFeedback } from '../types';
import { marked } from 'marked';
import { useLanguage } from '../contexts/LanguageContext';


interface ElevatorPitchProps {
  onBack: () => void;
}

const ElevatorPitch = ({ onBack }: ElevatorPitchProps) => {
    const [pitch, setPitch] = useState('');
    const [feedback, setFeedback] = useState<ElevatorPitchFeedback | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { language, t } = useLanguage();

    const handleGetFeedback = async () => {
        if (!pitch.trim()) return;
        setIsLoading(true);
        setError(null);
        setFeedback(null);

        try {
            const result = await getElevatorPitchFeedback(pitch, language);
            setFeedback(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to get feedback.');
        } finally {
            setIsLoading(false);
        }
    };

    const getScoreStyles = (score: number) => {
        if (score <= 5) {
            return {
                bgColor: 'bg-red-50 dark:bg-red-900/50',
                textColor: 'text-red-500',
                labelColor: 'text-red-700 dark:text-red-300',
            };
        }
        if (score <= 7) {
            return {
                bgColor: 'bg-yellow-50 dark:bg-yellow-900/50',
                textColor: 'text-yellow-500',
                labelColor: 'text-yellow-700 dark:text-yellow-300',
            };
        }
        return {
            bgColor: 'bg-green-50 dark:bg-green-900/50',
            textColor: 'text-green-500',
            labelColor: 'text-green-700 dark:text-green-300',
        };
    };

    return (
        <div className="p-4 sm:p-6 md:p-8">
            <header className="text-center mb-10">
                <h1 className="text-4xl font-bold text-text-light-mode dark:text-text-dark-mode">{t('elevatorPitchTitle')}</h1>
                <p className="text-lg text-gray-600 dark:text-gray-400 mt-2">{t('elevatorPitchSubtitle')}</p>
            </header>

            <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-text-light-mode dark:text-text-dark-mode">{t('craftYourPitch')}</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('pitchHelp')}</p>
                    </div>
                     <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-secondary hover:underline">
                        <ArrowLeftIcon className="w-4 h-4" /> {t('backToHome')}
                    </button>
                </div>
                
                <textarea
                    value={pitch}
                    onChange={(e) => setPitch(e.target.value)}
                    placeholder={t('pitchPlaceholder')}
                    rows={8}
                    className="w-full p-4 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-700 dark:border-gray-600 dark:text-white text-base"
                />

                <div className="text-center mt-6">
                    <button
                        onClick={handleGetFeedback}
                        disabled={isLoading || !pitch.trim()}
                        className="px-8 py-3 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-lg hover:from-blue-700 hover:to-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                       {t('getAIFeedback')}
                    </button>
                </div>
            </div>

            {isLoading && <div className="mt-8"><Loader text={t('analyzingPitch')} /></div>}
            {error && <p className="text-red-500 text-center mt-8">{error}</p>}

            {feedback && (() => {
                const clarityStyles = getScoreStyles(feedback.clarityScore);
                const impactStyles = getScoreStyles(feedback.impactScore);
                const completenessStyles = getScoreStyles(feedback.completenessScore);

                return (
                    <div className="max-w-3xl mx-auto mt-8 bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
                        <h3 className="text-2xl font-bold text-text-light-mode dark:text-text-dark-mode mb-6">{t('yourFeedbackReport')}</h3>
                        <div className="space-y-6">
                            {/* Overall Score & Summary */}
                            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                <h4 className="font-bold text-lg text-primary mb-2">{t('overallAssessment')}</h4>
                                <div
                                    className="prose dark:prose-invert max-w-none"
                                    dangerouslySetInnerHTML={{ __html: marked.parse(feedback.overallAssessment) as string }}
                                />
                            </div>
                            
                            {/* Scores */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                                <div className={`p-4 ${clarityStyles.bgColor} rounded-lg`}>
                                    <div className={`text-3xl font-bold ${clarityStyles.textColor}`}>{feedback.clarityScore}/10</div>
                                    <div className={`text-sm font-semibold ${clarityStyles.labelColor} mt-1`}>{t('clarity')}</div>
                                </div>
                                <div className={`p-4 ${impactStyles.bgColor} rounded-lg`}>
                                    <div className={`text-3xl font-bold ${impactStyles.textColor}`}>{feedback.impactScore}/10</div>
                                    <div className={`text-sm font-semibold ${impactStyles.labelColor} mt-1`}>{t('impact')}</div>
                                </div>
                                <div className={`p-4 ${completenessStyles.bgColor} rounded-lg`}>
                                    <div className={`text-3xl font-bold ${completenessStyles.textColor}`}>{feedback.completenessScore}/10</div>
                                    <div className={`text-sm font-semibold ${completenessStyles.labelColor} mt-1`}>{t('completeness')}</div>
                                </div>
                            </div>

                            {/* Detailed Feedback */}
                            <div>
                                <h4 className="font-bold text-lg text-primary mb-2">{t('structureAndFlow')}</h4>
                                <div
                                    className="prose dark:prose-invert max-w-none p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                                    dangerouslySetInnerHTML={{ __html: marked.parse(feedback.structureFeedback) as string }}
                                />
                            </div>

                            <div>
                                <h4 className="font-bold text-lg text-primary mb-2">{t('suggestionsForImprovement')}</h4>
                                <div
                                    className="prose dark:prose-invert max-w-none p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                                    dangerouslySetInnerHTML={{ __html: marked.parse(feedback.suggestionForImprovement) as string }}
                                />
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default ElevatorPitch;