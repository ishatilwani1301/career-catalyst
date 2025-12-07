import React from 'react';
import { UserProfile, SkillRoadmap as SkillRoadmapType, DashboardTab, User } from '../types';
import SkillRoadmap from './SkillRoadmap';
import Jamboard from './Whiteboard';
import InterviewPrep from './JobSimulator';
import DailyBytes from './Home';
import ProfilePage from './ProfilePage';
import { DailyBytesIcon, RoadmapIcon, WhiteboardIcon, InterviewPrepIcon } from './icons';
import { useLanguage } from '../contexts/LanguageContext';

interface DashboardProps {
  userProfile: UserProfile;
  roadmap: SkillRoadmapType;
  currentUser: User;
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  onProfileUpdate: (newProfile: UserProfile) => Promise<void>;
}

const Dashboard = ({ userProfile, roadmap, currentUser, activeTab, setActiveTab, onProfileUpdate }: DashboardProps) => {
  const { t } = useLanguage();

  const renderContent = () => {
    switch (activeTab) {
      case DashboardTab.DAILY_BYTES:
        return <DailyBytes userProfile={userProfile} />;
      case DashboardTab.ROADMAP:
        return <SkillRoadmap roadmap={roadmap} />;
      case DashboardTab.JAMBOARD:
        return <Jamboard />;
      case DashboardTab.INTERVIEW_PREP:
        return <InterviewPrep userProfile={userProfile} currentUser={currentUser} />;
      case DashboardTab.PROFILE:
        return <ProfilePage 
                  currentUser={currentUser} 
                  userProfile={userProfile}
                  onBack={() => setActiveTab(DashboardTab.DAILY_BYTES)} 
                  onProfileUpdate={onProfileUpdate}
                />;
      default:
        return null;
    }
  };

  const getTabName = (tab: DashboardTab): string => {
    switch (tab) {
        case DashboardTab.DAILY_BYTES: return t('dailyBytes');
        case DashboardTab.ROADMAP: return t('roadmap');
        case DashboardTab.JAMBOARD: return t('jamboard');
        case DashboardTab.INTERVIEW_PREP: return t('interviewPrep');
        case DashboardTab.PROFILE: return t('profile');
        default: return '';
    }
  }

  const tabs = [
    { name: DashboardTab.DAILY_BYTES, icon: <DailyBytesIcon /> },
    { name: DashboardTab.ROADMAP, icon: <RoadmapIcon /> },
    { name: DashboardTab.JAMBOARD, icon: <WhiteboardIcon /> },
    { name: DashboardTab.INTERVIEW_PREP, icon: <InterviewPrepIcon /> },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <main className={`flex-1 bg-light dark:bg-dark overflow-y-auto ${activeTab !== DashboardTab.PROFILE ? 'pb-24' : ''}`}>
        {renderContent()}
      </main>

      {activeTab !== DashboardTab.PROFILE && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-dark/80 backdrop-blur-sm p-2 border-t border-gray-200 dark:border-gray-700 shadow-lg z-10">
          <div className="flex justify-around w-full max-w-4xl mx-auto">
            {tabs.map(tab => (
              <button
                key={tab.name}
                onClick={() => setActiveTab(tab.name)}
                className={`flex flex-col items-center justify-center space-y-1 p-2 rounded-lg transition-colors w-28 ${
                  activeTab === tab.name
                    ? 'text-secondary'
                    : 'text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-secondary'
                }`}
              >
                {React.cloneElement(tab.icon, { className: 'w-7 h-7' })}
                <span className="text-xs font-medium tracking-wide">{getTabName(tab.name)}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
};

export default Dashboard;