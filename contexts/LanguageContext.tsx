import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

type Language = 'en' | 'hi' | 'ta' | 'te' | 'kn' | 'bn' | 'ml';
type Translations = { [key: string]: string };

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const SUPPORTED_LANGUAGES: Language[] = ['en', 'hi', 'ta', 'te', 'kn', 'bn', 'ml'];
const initialTranslations: { [key in Language]?: Translations } = {};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const savedLang = localStorage.getItem('language');
    if (savedLang && SUPPORTED_LANGUAGES.includes(savedLang as Language)) {
        return savedLang as Language;
    }
    return 'en';
  });

  const [translations, setTranslations] = useState(initialTranslations);

  useEffect(() => {
    const fetchTranslations = async () => {
        try {
            const responses = await Promise.all(
                SUPPORTED_LANGUAGES.map(lang => fetch(`/locales/${lang}.json`))
            );
            
            if (responses.some(res => !res.ok)) {
                console.error('Failed to fetch one or more translation files.');
                return;
            }

            const jsons = await Promise.all(responses.map(res => res.json()));
            
            const newTranslations = SUPPORTED_LANGUAGES.reduce((acc, lang, index) => {
                acc[lang as keyof typeof acc] = jsons[index];
                return acc;
            }, {} as { [key in Language]?: Translations });

            setTranslations(newTranslations);
        } catch (error) {
            console.error('Failed to load translations:', error);
        }
    };
    fetchTranslations();
  }, []);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const t = (key: string): string => {
    const langTranslations = translations[language];
    if (langTranslations) {
        return langTranslations[key] || key;
    }
    // Fallback to English if current language translations are not loaded yet
    const fallbackTranslations = translations['en'];
    if (fallbackTranslations) {
        return fallbackTranslations[key] || key;
    }
    return key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};