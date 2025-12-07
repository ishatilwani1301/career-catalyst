import React, { useState, useEffect } from 'react';
import { UserProfile, IndustryNews as IndustryNewsType, IndustryNewsItem } from '../types';
import { generateIndustryNews } from '../services/geminiService';
import Loader from './Loader';
import { ExternalLinkIcon } from './icons';
import { useLanguage } from '../contexts/LanguageContext';

interface DailyBytesProps {
  userProfile: UserProfile;
}

const NewsCard = ({ item }: { item: IndustryNewsItem }) => {
    const { t } = useLanguage();
    const getResourceUrl = (title: string): string => {
        const query = encodeURIComponent(title);
        return `https://www.google.com/search?q=${query}`;
    };

    const getBadgeStyle = (type: string) => {
        switch (type) {
            case 'report': return "text-purple-600 bg-purple-200 dark:bg-purple-500/10 dark:text-purple-300";
            case 'video': return "text-red-600 bg-red-200 dark:bg-red-500/10 dark:text-red-300";
            case 'article': return "text-blue-600 bg-blue-200 dark:bg-blue-500/10 dark:text-blue-300";
            case 'blog': return "text-green-600 bg-green-200 dark:bg-green-500/10 dark:text-green-300";
            default: return "text-gray-600 bg-gray-200 dark:bg-gray-600 dark:text-gray-300";
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 transition-transform hover:scale-[1.02] duration-300 flex flex-col h-full">
            <div className="flex-grow">
                <div className="flex items-start justify-between mb-3 gap-4">
                    <h3 className="text-xl font-bold text-text-light-mode dark:text-text-dark-mode flex-1">{item.title}</h3>
                    <span className={`text-xs font-semibold uppercase px-2 py-1 rounded-full flex-shrink-0 ${getBadgeStyle(item.source_type)}`}>
                        {item.source_type}
                    </span>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-4">{item.summary}</p>
                <div className="p-4 bg-primary/5 dark:bg-primary/10 rounded-lg border-l-4 border-primary">
                    <p className="font-semibold text-primary dark:text-blue-300 text-sm">{t('whyItMatters')}</p>
                    <p className="text-gray-700 dark:text-gray-200 text-sm mt-1">{item.relevance}</p>
                </div>
            </div>
             <a 
                href={getResourceUrl(item.title)} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-secondary hover:underline"
            >
                {t('searchOnline')} <ExternalLinkIcon className="w-4 h-4" />
            </a>
        </div>
    );
}

const DailyBytes = ({ userProfile }: DailyBytesProps) => {
  const [news, setNews] = useState<IndustryNewsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { language, t } = useLanguage();

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const industryNews = await generateIndustryNews(userProfile, language);
        setNews(industryNews);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchNews();
  }, [userProfile, language]);

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h2 className="text-3xl font-bold text-text-light-mode dark:text-text-dark-mode mb-2">{t('welcomeBack')}</h2>
      <p className="text-gray-600 dark:text-gray-300 mb-8">{t('dailyBytesSubtitle')} <span className="font-semibold text-primary">{userProfile.targetCareer}</span>.</p>
      
      {isLoading && <Loader text={t('fetchingDailyBytes')} />}
      {error && <p className="text-red-500 text-center py-4">{error}</p>}

      {news && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {news.news.map((item, index) => (
                <NewsCard key={index} item={item} />
            ))}
        </div>
      )}
    </div>
  );
};

export default DailyBytes;