import React, { useState } from 'react';
import { UserProfile, SkillRoadmap } from '../types';
import { generateSkillRoadmap, generateProfileFromResumeText } from '../services/geminiService';
import Loader from './Loader';
import { useLanguage } from '../contexts/LanguageContext';

interface OnboardingProps {
  onComplete: (profile: UserProfile, roadmap: SkillRoadmap) => void;
}

const Onboarding = ({ onComplete }: OnboardingProps) => {
  const [profile, setProfile] = useState<UserProfile>({
    academicBackground: '',
    professionalProfile: '',
    aspirations: '',
    careerCategory: '',
    targetCareer: '',
    careerGap: '',
    skills: [],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  
  const { language, t } = useLanguage();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
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

      setProfile(prevProfile => ({
        ...prevProfile,
        ...parsedProfile,
      }));

    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'An unexpected error occurred while parsing.');
    } finally {
      setIsParsing(false);
      setResumeFile(null);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const roadmap = await generateSkillRoadmap(profile, language);
      onComplete(profile, roadmap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid =
    profile.academicBackground &&
    profile.professionalProfile &&
    profile.aspirations &&
    profile.careerCategory &&
    profile.targetCareer &&
    (profile.careerCategory !== 'career_returner' || profile.careerGap);

  return (
    <div className="max-w-4xl mx-auto my-12 p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-xl">
      <h2 className="text-3xl font-bold text-text-light-mode dark:text-text-dark-mode text-center">{t('onboardingTitle')}</h2>
      <p className="text-gray-600 dark:text-gray-300 text-center mt-2 mb-8">{t('onboardingSubtitle')}</p>
      
      {isLoading ? (
        <Loader text={t('buildingRoadmap')} />
      ) : (
        <>
          <div className="mb-8 p-6 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-center">
            <h3 className="text-xl font-semibold text-text-light-mode dark:text-text-dark-mode">{t('tiredOfTyping')}</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-1">{t('autofillWithResume')}</p>
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <label htmlFor="resume-upload" className="cursor-pointer px-5 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
                {resumeFile ? t('changeFile') : t('uploadPdf')}
                <input id="resume-upload" type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
              </label>
              {resumeFile && <span className="text-sm text-gray-700 dark:text-gray-300">{resumeFile.name}</span>}
            </div>
            {resumeFile && !isParsing && (
              <button
                onClick={handleParseResume}
                className="mt-4 px-6 py-2 bg-secondary text-white font-bold rounded-lg hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary"
              >
                {t('autofillForm')}
              </button>
            )}
            {isParsing && <div className="mt-4"><Loader text={t('analyzingResume')} /></div>}
            {parseError && <p className="text-red-500 mt-2">{parseError}</p>}
          </div>

          <div className="flex items-center my-8">
            <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
            <span className="flex-shrink mx-4 text-gray-500 dark:text-gray-400 font-semibold">{t('orFillManually')}</span>
            <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
          </div>
        
          <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-lg font-semibold text-text-light-mode dark:text-text-dark-mode mb-2">
                  {t('categoryQuestion')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label htmlFor="career_changer" className={`relative flex flex-col bg-white dark:bg-slate-700 p-5 rounded-lg shadow-md cursor-pointer border-2 transition-all ${profile.careerCategory === 'career_changer' ? 'border-primary ring-2 ring-primary' : 'border-gray-200 dark:border-gray-600'}`}>
                    <span className="font-bold text-lg text-text-light-mode dark:text-text-dark-mode">{t('careerChanger')}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('careerChangerDesc')}</span>
                    <input type="radio" name="careerCategory" id="career_changer" value="career_changer" checked={profile.careerCategory === 'career_changer'} onChange={handleChange} className="absolute h-0 w-0 appearance-none" />
                  </label>
                  <label htmlFor="career_returner" className={`relative flex flex-col bg-white dark:bg-slate-700 p-5 rounded-lg shadow-md cursor-pointer border-2 transition-all ${profile.careerCategory === 'career_returner' ? 'border-primary ring-2 ring-primary' : 'border-gray-200 dark:border-gray-600'}`}>
                    <span className="font-bold text-lg text-text-light-mode dark:text-text-dark-mode">{t('careerReturner')}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('careerReturnerDesc')}</span>
                    <input type="radio" name="careerCategory" id="career_returner" value="career_returner" checked={profile.careerCategory === 'career_returner'} onChange={handleChange} className="absolute h-0 w-0 appearance-none" />
                  </label>
                  <label htmlFor="new_entrant" className={`relative flex flex-col bg-white dark:bg-slate-700 p-5 rounded-lg shadow-md cursor-pointer border-2 transition-all ${profile.careerCategory === 'new_entrant' ? 'border-primary ring-2 ring-primary' : 'border-gray-200 dark:border-gray-600'}`}>
                    <span className="font-bold text-lg text-text-light-mode dark:text-text-dark-mode">{t('newEntrant')}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('newEntrantDesc')}</span>
                    <input type="radio" name="careerCategory" id="new_entrant" value="new_entrant" checked={profile.careerCategory === 'new_entrant'} onChange={handleChange} className="absolute h-0 w-0 appearance-none" />
                  </label>
                </div>
              </div>
              
              {profile.careerCategory && (
                <div className="space-y-6 border-t dark:border-gray-700 pt-6">
                  <div>
                    <label htmlFor="targetCareer" className="block text-lg font-semibold text-text-light-mode dark:text-text-dark-mode mb-1">
                      {t('targetCareerQuestion')}
                    </label>
                    <input
                      type="text"
                      name="targetCareer"
                      id="targetCareer"
                      value={profile.targetCareer}
                      onChange={handleChange}
                      placeholder={t('targetCareerPlaceholder')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-700 dark:border-gray-600 dark:text-white"
                      required
                    />
                  </div>

                  {profile.careerCategory === 'career_returner' && (
                    <div>
                      <label htmlFor="careerGap" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('careerGap')}
                      </label>
                      <input
                        type="text"
                        name="careerGap"
                        id="careerGap"
                        value={profile.careerGap}
                        onChange={handleChange}
                        placeholder={t('careerGapPlaceholder')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-700 dark:border-gray-600 dark:text-white"
                        required
                      />
                    </div>
                  )}
                </div>
              )}


              <div className="space-y-6 border-t dark:border-gray-700 pt-6">
                <div>
                  <label htmlFor="academicBackground" className="block text-lg font-semibold text-text-light-mode dark:text-text-dark-mode mb-1">
                    {t('academicBackground')}
                  </label>
                  <textarea
                    name="academicBackground"
                    id="academicBackground"
                    rows={2}
                    value={profile.academicBackground}
                    onChange={handleChange}
                    placeholder={t('academicBackgroundPlaceholder')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-700 dark:border-gray-600 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="professionalProfile" className="block text-lg font-semibold text-text-light-mode dark:text-text-dark-mode mb-1">
                    {t('professionalProfile')}
                  </label>
                  <textarea
                    name="professionalProfile"
                    id="professionalProfile"
                    rows={3}
                    value={profile.professionalProfile}
                    onChange={handleChange}
                    placeholder={t('professionalProfilePlaceholder')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-700 dark:border-gray-600 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="aspirations" className="block text-lg font-semibold text-text-light-mode dark:text-text-dark-mode mb-1">
                    {t('aspirationsQuestion')}
                  </label>
                  <textarea
                    name="aspirations"
                    id="aspirations"
                    rows={3}
                    value={profile.aspirations}
                    onChange={handleChange}
                    placeholder={t('aspirationsPlaceholder')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-700 dark:border-gray-600 dark:text-white"
                    required
                  />
                </div>
              </div>
              {error && <p className="text-red-500 text-center">{error}</p>}
              <div className="text-center pt-4">
                <button
                  type="submit"
                  disabled={!isFormValid || isLoading || isParsing}
                  className="px-8 py-3 bg-secondary text-white font-bold rounded-lg hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-300"
                >
                  {t('save')}
                </button>
              </div>
            </form>
        </>
      )}
    </div>
  );
};

export default Onboarding;
