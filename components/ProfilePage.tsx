import React, { useState, useEffect, useRef } from 'react';
import { User, SavedTranscript, UserProfile, Skill, SkillLevel } from '../types';
import { ArrowLeftIcon, DownloadIcon, SpeakerWaveIcon, StopIcon } from './icons';
import { marked } from 'marked';
import { useLanguage } from '../contexts/LanguageContext';
import { generateProfileFromResumeText } from '../services/geminiService';
import Loader from './Loader';

interface ProfilePageProps {
    currentUser: User;
    userProfile: UserProfile;
    onBack: () => void;
    onProfileUpdate: (newProfile: UserProfile) => Promise<void>;
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

const getProficiencyBadgeStyle = (level: string) => {
    switch (level?.toLowerCase()) {
        case 'beginner': return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
        case 'intermediate': return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
        case 'advanced': return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
        case 'expert': return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
        default: return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
};

const ProfilePage = ({ currentUser, userProfile, onBack, onProfileUpdate }: ProfilePageProps) => {
    const [history, setHistory] = useState<SavedTranscript[]>([]);
    const [selectedTranscript, setSelectedTranscript] = useState<SavedTranscript | null>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const synthRef = useRef(window.speechSynthesis);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    
    // Edit mode state
    const [isEditing, setIsEditing] = useState(false);
    const [updatedProfile, setUpdatedProfile] = useState<UserProfile>(userProfile);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [parseError, setParseError] = useState<string | null>(null);
    
    const { language, t } = useLanguage();

    useEffect(() => {
        try {
            const savedHistory = localStorage.getItem(`interviewHistory_${currentUser.email}`);
            if (savedHistory) {
                setHistory(JSON.parse(savedHistory));
            }
        } catch (error) {
            console.error("Failed to load interview history:", error);
            localStorage.removeItem(`interviewHistory_${currentUser.email}`);
        }
        
        const synth = synthRef.current;
        return () => {
            if (synth.speaking) {
                synth.cancel();
            }
        }
    }, [currentUser.email]);
    
    useEffect(() => {
        // When userProfile prop changes (e.g., after an update), reset the form state
        setUpdatedProfile(userProfile);
    }, [userProfile]);

    useEffect(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [selectedTranscript]);


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
          utterance.onerror = () => setIsSpeaking(false);
          synth.speak(utterance);
          setIsSpeaking(true);
        }
    };

    const handleExportTranscript = (transcript: SavedTranscript) => {
        const { date, type, messages, isAudio } = transcript;
        let textContent = `Interview Transcript\n\n`;
        textContent += `User: ${currentUser.name} (${currentUser.email})\n`;
        textContent += `Date: ${date}\n`;
        textContent += `Type: ${type}${isAudio ? ' (Audio)' : ''}\n`;
        textContent += `=====================================\n\n`;
    
        messages.forEach(msg => {
            const prefix = msg.role === 'user' ? 'You' : 'AI Coach';
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = marked.parse(msg.content) as string;
            const cleanContent = tempDiv.textContent || tempDiv.innerText || '';
            textContent += `${prefix}:\n${cleanContent}\n\n---\n\n`;
        });
        
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const filename = `transcript-${transcript.id}.txt`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // --- Edit Profile Handlers ---

    const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setUpdatedProfile({ ...updatedProfile, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setResumeFile(e.target.files[0]);
            setParseError(null);
        }
    };

    const handleParseResume = async () => {
        if (!resumeFile) return;
        setIsParsing(true);
        setParseError(null);
        try {
            const pdf = await (window as any).pdfjsLib.getDocument(URL.createObjectURL(resumeFile)).promise;
            let text = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                text += content.items.map((item: any) => item.str).join(' ');
            }
            const parsedProfile = await generateProfileFromResumeText(text, language);
            setUpdatedProfile(prevProfile => ({ ...prevProfile, ...parsedProfile }));
        } catch (err) {
            setParseError(err instanceof Error ? err.message : 'An unexpected error occurred while parsing.');
        } finally {
            setIsParsing(false);
            setResumeFile(null);
        }
    };

    const handleSaveChanges = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            await onProfileUpdate(updatedProfile);
            setIsEditing(false); // Close edit mode on success
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update profile.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSkillChange = (index: number, field: keyof Skill, value: string) => {
        const newSkills = [...(updatedProfile.skills || [])];
        newSkills[index] = { ...newSkills[index], [field]: value as SkillLevel };
        setUpdatedProfile({ ...updatedProfile, skills: newSkills });
    };

    const handleAddSkill = () => {
        const newSkills = [...(updatedProfile.skills || []), { name: '', level: 'Beginner' as SkillLevel }];
        setUpdatedProfile({ ...updatedProfile, skills: newSkills });
    };

    const handleRemoveSkill = (indexToRemove: number) => {
        setUpdatedProfile({
            ...updatedProfile,
            skills: (updatedProfile.skills || []).filter((_, index) => index !== indexToRemove)
        });
    };

    const isFormValid =
        updatedProfile.academicBackground &&
        updatedProfile.professionalProfile &&
        updatedProfile.aspirations &&
        updatedProfile.careerCategory &&
        updatedProfile.targetCareer &&
        (updatedProfile.careerCategory !== 'career_returner' || updatedProfile.careerGap);


    if (selectedTranscript) {
        return (
             <div className="p-4 sm:p-6 md:p-8">
                <div className="flex justify-between items-center mb-4 gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-text-light-mode dark:text-text-dark-mode">
                            {t('transcript')} {selectedTranscript.type} {selectedTranscript.isAudio && '(Audio)'}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{selectedTranscript.date}</p>
                    </div>
                    <div className="flex items-center gap-2">
                         <button onClick={() => handleExportTranscript(selectedTranscript)} className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-600 font-semibold rounded-lg hover:bg-green-500/20 transition-colors">
                            <DownloadIcon className="w-4 h-4" /> {t('export')}
                        </button>
                        <button onClick={() => setSelectedTranscript(null)} className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-text-light-mode dark:text-text-dark-mode font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                            <ArrowLeftIcon className="w-4 h-4" /> {t('back')}
                        </button>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col h-[70vh]">
                    <div ref={chatContainerRef} className="flex-1 p-6 overflow-y-auto space-y-4">
                        {selectedTranscript.messages.map((msg, index) => (
                             <div key={index} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'model' && !selectedTranscript.isAudio && (
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
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 md:p-8">
            <div className="flex items-center mb-8">
                <button onClick={onBack} className="p-2 mr-4 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                    <ArrowLeftIcon className="w-6 h-6 text-text-light-mode dark:text-text-dark-mode" />
                </button>
                <h1 className="text-3xl font-bold text-text-light-mode dark:text-text-dark-mode">{t('profileTitle')}</h1>
            </div>

            <div className="max-w-4xl mx-auto space-y-8">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-semibold text-text-light-mode dark:text-text-dark-mode">
                            {isEditing ? t('editingProfile') : t('yourProfile')}
                        </h2>
                        {!isEditing && (
                             <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-primary/10 text-primary font-semibold rounded-lg hover:bg-primary/20 transition-colors">
                                {t('editProfile')}
                            </button>
                        )}
                    </div>

                    {isEditing ? (
                         <form onSubmit={handleSaveChanges} className="space-y-6">
                            {isLoading ? <Loader text={t('buildingRoadmap')} /> : (
                            <>
                            {/* Resume Parser */}
                            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-center">
                                <p className="text-gray-500 dark:text-gray-400">{t('autofillWithResume')}</p>
                                <div className="mt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
                                    <label htmlFor="resume-upload" className="cursor-pointer px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
                                        {resumeFile ? t('changeFile') : t('uploadPdf')}
                                        <input id="resume-upload" type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
                                    </label>
                                    {resumeFile && <span className="text-sm text-gray-700 dark:text-gray-300">{resumeFile.name}</span>}
                                </div>
                                {resumeFile && !isParsing && (
                                    <button type="button" onClick={handleParseResume} className="mt-3 px-5 py-1.5 bg-secondary text-white font-bold rounded-lg hover:bg-sky-600">{t('autofillForm')}</button>
                                )}
                                {isParsing && <div className="mt-2"><Loader text={t('analyzingResume')} /></div>}
                                {parseError && <p className="text-red-500 mt-2 text-sm">{parseError}</p>}
                            </div>

                            {/* Form Fields */}
                             <div>
                                <label className="block text-lg font-semibold text-text-light-mode dark:text-text-dark-mode mb-2">{t('categoryQuestion')}</label>
                                <select name="careerCategory" value={updatedProfile.careerCategory} onChange={handleEditChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-700 dark:border-gray-600 dark:text-white" required>
                                    <option value="" disabled>{t('selectCategory')}</option>
                                    <option value="career_changer">{t('careerChanger')}</option>
                                    <option value="career_returner">{t('careerReturner')}</option>
                                    <option value="new_entrant">{t('newEntrant')}</option>
                                </select>
                            </div>
                            
                            <div>
                                <label htmlFor="targetCareer" className="block text-lg font-semibold text-text-light-mode dark:text-text-dark-mode mb-1">{t('targetCareerQuestion')}</label>
                                <input type="text" name="targetCareer" id="targetCareer" value={updatedProfile.targetCareer} onChange={handleEditChange} placeholder={t('targetCareerPlaceholder')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-700 dark:border-gray-600 dark:text-white" required />
                            </div>

                            {updatedProfile.careerCategory === 'career_returner' && (
                                <div>
                                    <label htmlFor="careerGap" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('careerGap')}</label>
                                    <input type="text" name="careerGap" id="careerGap" value={updatedProfile.careerGap} onChange={handleEditChange} placeholder={t('careerGapPlaceholder')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-700 dark:border-gray-600 dark:text-white" required />
                                </div>
                            )}

                            <div>
                                <label htmlFor="academicBackground" className="block text-lg font-semibold text-text-light-mode dark:text-text-dark-mode mb-1">{t('academicBackground')}</label>
                                <textarea name="academicBackground" id="academicBackground" rows={2} value={updatedProfile.academicBackground} onChange={handleEditChange} placeholder={t('academicBackgroundPlaceholder')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-700 dark:border-gray-600 dark:text-white" required />
                            </div>
                            <div>
                                <label htmlFor="professionalProfile" className="block text-lg font-semibold text-text-light-mode dark:text-text-dark-mode mb-1">{t('professionalProfile')}</label>
                                <textarea name="professionalProfile" id="professionalProfile" rows={3} value={updatedProfile.professionalProfile} onChange={handleEditChange} placeholder={t('professionalProfilePlaceholder')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-700 dark:border-gray-600 dark:text-white" required />
                            </div>
                            <div>
                                <label htmlFor="aspirations" className="block text-lg font-semibold text-text-light-mode dark:text-text-dark-mode mb-1">{t('aspirationsQuestion')}</label>
                                <textarea name="aspirations" id="aspirations" rows={3} value={updatedProfile.aspirations} onChange={handleEditChange} placeholder={t('aspirationsPlaceholder')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-700 dark:border-gray-600 dark:text-white" required />
                            </div>

                             {/* Skills Section */}
                            <div className="border-t dark:border-gray-700 pt-6">
                                <h3 className="block text-lg font-semibold text-text-light-mode dark:text-text-dark-mode mb-4">{t('skillsAndProficiencies')}</h3>
                                <div className="space-y-3">
                                    {(updatedProfile.skills || []).map((skill, index) => (
                                        <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-700/50 rounded-md">
                                            <input
                                                type="text"
                                                placeholder={t('skillName')}
                                                value={skill.name}
                                                onChange={(e) => handleSkillChange(index, 'name', e.target.value)}
                                                className="flex-grow px-3 py-2 border border-gray-300 rounded-lg dark:bg-slate-600 dark:border-gray-500"
                                            />
                                            <select
                                                value={skill.level}
                                                onChange={(e) => handleSkillChange(index, 'level', e.target.value)}
                                                className="px-3 py-2 border border-gray-300 rounded-lg dark:bg-slate-600 dark:border-gray-500"
                                            >
                                                <option value="Beginner">{t('beginner')}</option>
                                                <option value="Intermediate">{t('intermediate')}</option>
                                                <option value="Advanced">{t('advanced')}</option>
                                                <option value="Expert">{t('expert')}</option>
                                            </select>
                                            <button type="button" onClick={() => handleRemoveSkill(index)} className="p-2 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddSkill}
                                    className="mt-4 px-4 py-2 text-sm bg-blue-100 text-primary font-semibold rounded-lg hover:bg-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
                                >
                                    + {t('addSkill')}
                                </button>
                            </div>

                            {error && <p className="text-red-500 text-center">{error}</p>}

                            <div className="flex justify-end gap-4 pt-4">
                                <button type="button" onClick={() => { setIsEditing(false); setUpdatedProfile(userProfile); setError(null); }} className="px-6 py-2 bg-gray-200 dark:bg-gray-600 text-text-light-mode dark:text-text-dark-mode font-bold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">{t('cancelEdit')}</button>
                                <button type="submit" disabled={!isFormValid || isLoading || isParsing} className="px-6 py-2 bg-secondary text-white font-bold rounded-lg hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">{t('saveChanges')}</button>
                            </div>
                            </>
                            )}
                        </form>
                    ) : (
                        <div className="space-y-2">
                            <div>
                                <span className="font-semibold text-gray-600 dark:text-gray-400">{t('name')}: </span>
                                <span className="text-text-light-mode dark:text-text-dark-mode">{currentUser.name}</span>
                            </div>
                            <div>
                                <span className="font-semibold text-gray-600 dark:text-gray-400">{t('email')}: </span>
                                <span className="text-text-light-mode dark:text-text-dark-mode">{currentUser.email}</span>
                            </div>
                            <div className="border-t dark:border-gray-600 pt-4 mt-4 !space-y-4">
                                <div>
                                    <h3 className="font-semibold text-gray-600 dark:text-gray-400">{t('targetCareerQuestion')}</h3>
                                    <p className="text-text-light-mode dark:text-text-dark-mode">{userProfile.targetCareer}</p>
                                </div>
                                 <div>
                                    <h3 className="font-semibold text-gray-600 dark:text-gray-400">{t('professionalProfile')}</h3>
                                    <p className="text-text-light-mode dark:text-text-dark-mode whitespace-pre-wrap">{userProfile.professionalProfile}</p>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-600 dark:text-gray-400">{t('skillsAndProficiencies')}</h3>
                                     {userProfile.skills && userProfile.skills.length > 0 ? (
                                        <div className="flex flex-wrap gap-3 mt-2">
                                            {userProfile.skills.map((skill, index) => (
                                                <div key={index} className={`px-3 py-1.5 rounded-full text-sm font-medium ${getProficiencyBadgeStyle(skill.level)}`}>
                                                    {skill.name} - <span className="font-semibold">{t(skill.level.toLowerCase())}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-500 dark:text-gray-400 mt-2">{t('noSkillsListed')}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                    <h2 className="text-2xl font-semibold text-text-light-mode dark:text-text-dark-mode mb-4">{t('interviewHistory')}</h2>
                    {history.length > 0 ? (
                        <div className="space-y-4">
                            {[...history].reverse().map(transcript => (
                                <button
                                    key={transcript.id}
                                    onClick={() => setSelectedTranscript(transcript)}
                                    className="w-full text-left p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-gray-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-lg text-primary">
                                            {transcript.type} {transcript.isAudio && '(Audio)'}
                                        </span>
                                        <span className="text-sm text-gray-500 dark:text-gray-400">{transcript.date}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-gray-500 dark:text-gray-400 py-8">{t('noHistory')}</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;