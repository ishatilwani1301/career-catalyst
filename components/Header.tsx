import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { SunIcon, MoonIcon, LogoIcon } from './icons';
import { User } from '../types';
import LanguageSelector from './LanguageSelector';

interface HeaderProps {
  currentUser: User | null;
  onLogout: () => void;
  onProfileClick: () => void;
}

const Header = ({ currentUser, onLogout, onProfileClick }: HeaderProps) => {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name: string) => {
    if (!name) return '?';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name[0].toUpperCase();
  };

  return (
    <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-md sticky top-0 z-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center gap-3">
            <LogoIcon className="w-10 h-10 text-primary" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-primary">{t('appName')}</h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 -mt-1">{t('appDescription')}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSelector isHeader={true} />
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-dark"
              aria-label={t('toggleTheme')}
            >
              {theme === 'light' ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
            </button>

            {currentUser && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="w-10 h-10 rounded-full bg-secondary text-white flex items-center justify-center font-bold text-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-dark"
                >
                  {getInitials(currentUser.name)}
                </button>
                {isMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-dark rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-30">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-600">
                      <p className="text-sm text-gray-500 dark:text-gray-400">{t('signedInAs')}</p>
                      <p className="text-base font-bold text-text-light-mode dark:text-white truncate mt-1">{currentUser.name}</p>
                    </div>
                    <div className="py-2">
                      <button
                        onClick={() => {
                          onProfileClick();
                          setIsMenuOpen(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-base text-text-light-mode dark:text-text-dark-mode hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {t('yourProfile')}
                      </button>
                      <button
                        onClick={() => {
                          onLogout();
                          setIsMenuOpen(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-base text-text-light-mode dark:text-text-dark-mode hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {t('logOut')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;