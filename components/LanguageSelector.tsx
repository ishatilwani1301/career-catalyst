import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { GlobeIcon } from './icons';


const LanguageSelector = ({ isHeader = false }: { isHeader?: boolean }) => {
    const { language, setLanguage } = useLanguage();
    const [isOpen, setIsOpen] = React.useState(false);
    const selectorRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const languages: { [key: string]: string } = {
        en: 'English',
        hi: 'हिन्दी (Hindi)',
        ta: 'தமிழ் (Tamil)',
        te: 'తెలుగు (Telugu)',
        kn: 'ಕನ್ನಡ (Kannada)',
        bn: 'বাংলা (Bengali)',
        ml: 'മലയാളം (Malayalam)',
    };

    const handleLanguageChange = (lang: string) => {
        setLanguage(lang as any);
        setIsOpen(false);
    };

    if (isHeader) {
        return (
            <div className="relative" ref={selectorRef}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-gray-800"
                    aria-label="Select language"
                >
                    <GlobeIcon className="w-6 h-6" />
                </button>
                {isOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-30">
                        <ul className="py-1">
                            {Object.entries(languages).map(([code, name]) => (
                                <li key={code}>
                                    <button
                                        onClick={() => handleLanguageChange(code)}
                                        className={`block w-full text-left px-4 py-2 text-sm ${language === code ? 'font-bold text-primary' : 'text-gray-700 dark:text-gray-200'} hover:bg-gray-100 dark:hover:bg-gray-700`}
                                    >
                                        {name}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        );
    }
    
    // Dropdown for Login page
    return (
         <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-primary focus:border-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            aria-label="Select language"
        >
             {Object.entries(languages).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
            ))}
        </select>
    );
};

export default LanguageSelector;