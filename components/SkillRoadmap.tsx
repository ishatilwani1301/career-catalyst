import React from 'react';
import { SkillRoadmap as SkillRoadmapType, RoadmapResource } from '../types';
import { ExternalLinkIcon } from './icons';
import { useLanguage } from '../contexts/LanguageContext';

interface SkillRoadmapProps {
  roadmap: SkillRoadmapType;
}

const getProficiencyBadgeStyle = (level: string) => {
    switch (level?.toLowerCase()) {
        case 'beginner': return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
        case 'intermediate': return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
        case 'advanced': return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
        case 'expert': return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
        default: return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
};

const ResourceCard: React.FC<{ resource: RoadmapResource }> = ({ resource }) => {
    const { t } = useLanguage();
    const getResourceUrl = (title: string): string => {
        const query = encodeURIComponent(title);
        return `https://www.google.com/search?q=${query}`;
    };

    const getBadgeStyle = (type: RoadmapResource['type']) => {
        switch (type) {
            case 'course': return "text-green-600 bg-green-200 dark:bg-green-500/10 dark:text-green-300";
            case 'video': return "text-red-600 bg-red-200 dark:bg-red-500/10 dark:text-red-300";
            case 'article': return "text-blue-600 bg-blue-200 dark:bg-blue-500/10 dark:text-blue-300";
            case 'paper': return "text-purple-600 bg-purple-200 dark:bg-purple-500/10 dark:text-purple-300";
            default: return "text-gray-600 bg-gray-200 dark:bg-gray-600 dark:text-gray-300";
        }
    };

    const getContainerStyle = (type: RoadmapResource['type']) => {
        switch (type) {
            case 'course': return "bg-green-50 hover:bg-green-100 dark:bg-green-500/10 hover:dark:bg-green-500/20";
            case 'video': return "bg-red-50 hover:bg-red-100 dark:bg-red-500/10 hover:dark:bg-red-500/20";
            case 'article': return "bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 hover:dark:bg-blue-500/20";
            case 'paper': return "bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/10 hover:dark:bg-purple-500/20";
            default: return "bg-gray-50 hover:bg-gray-100 dark:bg-slate-700 hover:dark:bg-slate-600";
        }
    }

    return (
        <a 
            href={getResourceUrl(resource.title)} 
            target="_blank" 
            rel="noopener noreferrer" 
            className={`flex items-start sm:items-center space-x-3 p-3 rounded-lg transition-colors ${getContainerStyle(resource.type)}`}
        >
            <div className="flex-shrink-0 pt-1 sm:pt-0">
                <span className={`text-xs font-semibold uppercase px-2 py-1 rounded ${getBadgeStyle(resource.type)}`}>
                    {resource.type}
                </span>
            </div>
            <div className="flex-grow">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{resource.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('clickToSearch')}</p>
            </div>
            <ExternalLinkIcon className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-1 sm:mt-0" />
        </a>
    );
};

const SkillRoadmap = ({ roadmap }: SkillRoadmapProps) => {
  const { t } = useLanguage();
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h2 className="text-3xl font-bold text-text-light-mode dark:text-text-dark-mode mb-2">{t('roadmapTitle')}</h2>
      <p className="text-gray-600 dark:text-gray-300 mb-8">{t('roadmapSubtitle')}</p>
      
      <div className="relative border-l-2 border-primary pl-8 space-y-12">
        {roadmap.modules.map((module, index) => (
          <div key={index} className="relative">
            <div className="absolute -left-10 top-1.5 w-4 h-4 bg-primary rounded-full border-4 border-white dark:border-dark"></div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-2">
                <h3 className="text-2xl font-bold text-primary">{module.title}</h3>
                {module.targetProficiency && (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getProficiencyBadgeStyle(module.targetProficiency)}`}>
                        {t('targetProficiency')}: {t(module.targetProficiency.toLowerCase())}
                    </span>
                )}
            </div>
            <p className="text-gray-700 dark:text-gray-200 mb-4">{module.description}</p>
            
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-text-light-mode dark:text-text-dark-mode mb-3">{t('curatedResources')}</h4>
                <div className="space-y-3">
                    {module.resources.map((resource, resIndex) => (
                        <ResourceCard key={resIndex} resource={resource} />
                    ))}
                </div>
            </div>
          </div>
        ))}
        <div className="absolute -left-10 top-0 h-full"></div>
      </div>
    </div>
  );
};

export default SkillRoadmap;