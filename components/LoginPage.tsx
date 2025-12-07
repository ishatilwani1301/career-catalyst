import React, { useState } from 'react';
import { LogoIcon } from './icons';
import { User } from '../types';
import LoginBackground from './LoginBackground';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSelector from './LanguageSelector';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

const LoginPage = ({ onLogin }: LoginPageProps) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    try {
      const users = JSON.parse(localStorage.getItem('users') || '{}');
      
      if (isSignUp) {
        if (!name.trim()) {
            setError(t('nameRequiredError'));
            return;
        }
        if (users[email]) {
          setError(t('emailExistsError'));
          return;
        }
        users[email] = { name, password };
        localStorage.setItem('users', JSON.stringify(users));
        onLogin({ name, email });

      } else { // Sign In
        const user = users[email];
        if (!user || user.password !== password) {
          setError(t('invalidCredentialsError'));
          return;
        }
        onLogin({ name: user.name, email });
      }
    } catch (err) {
      setError(t('unexpectedError'));
      console.error("Auth error:", err);
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen w-full bg-light dark:bg-dark p-4 overflow-hidden">
      <LoginBackground />
      
      <div className="relative z-10 flex flex-col items-center justify-center w-full">
        <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-3">
                <LogoIcon className="w-12 h-12 text-primary" />
                <h1 className="text-4xl font-bold text-primary">{t('appName')}</h1>
            </div>
            <p className="text-lg text-gray-600 dark:text-gray-300 mt-1">
                {t('tagline')}
            </p>
        </div>

        <div className="max-w-sm w-full bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/50 dark:border-slate-700">
            <div className="mb-6">
              <LanguageSelector />
            </div>
            <h2 className="text-center text-2xl font-bold text-text-light-mode dark:text-text-dark-mode mb-6">{isSignUp ? t('createAccount') : t('signIn')}</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div>
                  <label htmlFor="name" className="sr-only">{t('yourName')}</label>
                  <input id="name" name="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-700 dark:border-gray-600 dark:text-white" placeholder={t('yourName')} />
                </div>
              )}
              <div>
                <label htmlFor="email" className="sr-only">{t('emailAddress')}</label>
                <input id="email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-700 dark:border-gray-600 dark:text-white" placeholder={t('emailAddress')} />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">{t('password')}</label>
                <input id="password" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-700 dark:border-gray-600 dark:text-white" placeholder={t('password')} />
              </div>

              {error && <p className="text-red-500 text-sm text-center pt-2">{error}</p>}

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-secondary hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary transition-colors"
                >
                  {isSignUp ? t('signUp') : t('signIn')}
                </button>
              </div>
            </form>
        </div>

        <div className="mt-8">
            <button onClick={() => { setIsSignUp(!isSignUp); setError(null); }} className="text-base text-primary dark:text-blue-400 hover:underline font-medium">
                {isSignUp ? t('alreadyHaveAccount') : t('dontHaveAccount')}
            </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;