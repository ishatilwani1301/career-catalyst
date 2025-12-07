import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import Header from './components/Header';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import ErrorBoundary from './components/ErrorBoundary';
import { UserProfile, SkillRoadmap, AppView, User, DashboardTab } from './types';
import LoginPage from './components/LoginPage';
import { generateSkillRoadmap } from './services/geminiService';

const AppContent = () => {
  const [appView, setAppView] = useState<AppView>(AppView.LOGIN);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [roadmap, setRoadmap] = useState<SkillRoadmap | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>(DashboardTab.DAILY_BYTES);
  const { language } = useLanguage();

  // Check for a logged-in user on initial load
  useEffect(() => {
    try {
      const loggedInUserString = sessionStorage.getItem('currentUser');
      if (loggedInUserString) {
        const user: User = JSON.parse(loggedInUserString);
        handleAuthSuccess(user, false); // Don't reset tab on reload
      }
    } catch (error) {
      console.error("Failed to parse user from session storage:", error);
      sessionStorage.removeItem('currentUser');
    }
  }, []);

  const handleAuthSuccess = (user: User, resetTab: boolean = true) => {
    try {
      const profileString = localStorage.getItem(`profile_${user.email}`);
      const roadmapString = localStorage.getItem(`roadmap_${user.email}`);
      
      setCurrentUser(user);
      sessionStorage.setItem('currentUser', JSON.stringify(user));

      if (profileString && roadmapString) {
        setUserProfile(JSON.parse(profileString));
        setRoadmap(JSON.parse(roadmapString));
        setAppView(AppView.DASHBOARD);
        if (resetTab) setActiveTab(DashboardTab.DAILY_BYTES);
      } else {
        setAppView(AppView.ONBOARDING);
      }
    } catch (error) {
       console.error("Failed to load user profile or roadmap:", error);
       // If parsing fails, force re-onboarding
       setAppView(AppView.ONBOARDING);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setUserProfile(null);
    setRoadmap(null);
    sessionStorage.removeItem('currentUser');
    setAppView(AppView.LOGIN);
  };

  const handleOnboardingComplete = (profile: UserProfile, generatedRoadmap: SkillRoadmap) => {
    if (!currentUser) return;
    
    localStorage.setItem(`profile_${currentUser.email}`, JSON.stringify(profile));
    localStorage.setItem(`roadmap_${currentUser.email}`, JSON.stringify(generatedRoadmap));

    setUserProfile(profile);
    setRoadmap(generatedRoadmap);
    setAppView(AppView.DASHBOARD);
    setActiveTab(DashboardTab.DAILY_BYTES);
  };

  const handleProfileUpdate = async (newProfile: UserProfile) => {
    if (!currentUser) return;

    // Generate a new roadmap based on the updated profile
    const newRoadmap = await generateSkillRoadmap(newProfile, language);
    
    // Update state
    setUserProfile(newProfile);
    setRoadmap(newRoadmap);

    // Update localStorage
    localStorage.setItem(`profile_${currentUser.email}`, JSON.stringify(newProfile));
    localStorage.setItem(`roadmap_${currentUser.email}`, JSON.stringify(newRoadmap));
    
    // Switch tab to see changes immediately
    setActiveTab(DashboardTab.DAILY_BYTES);
  };


  const renderContent = () => {
    switch (appView) {
      case AppView.LOGIN:
        return <LoginPage onLogin={handleAuthSuccess} />;
      case AppView.ONBOARDING:
        return (
          <>
            <Header currentUser={currentUser} onLogout={handleLogout} onProfileClick={() => {}} />
            <main className="container mx-auto px-4 sm:px-6 lg:px-8">
              <Onboarding onComplete={handleOnboardingComplete} />
            </main>
          </>
        );
      case AppView.DASHBOARD:
        if (userProfile && roadmap && currentUser) {
          return (
             <>
                <Header currentUser={currentUser} onLogout={handleLogout} onProfileClick={() => setActiveTab(DashboardTab.PROFILE)} />
                <Dashboard 
                  userProfile={userProfile}
                  roadmap={roadmap}
                  currentUser={currentUser}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  onProfileUpdate={handleProfileUpdate}
                />
             </>
          );
        }
        // Fallback to onboarding if data is missing
        setAppView(AppView.ONBOARDING);
        return null;
      default:
        return <LoginPage onLogin={handleAuthSuccess} />;
    }
  };

  return (
    <div className="bg-light dark:bg-dark min-h-screen font-sans text-text-light-mode dark:text-text-dark-mode">
        {renderContent()}
    </div>
  );
};


const App = () => {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <ErrorBoundary>
            <AppContent />
        </ErrorBoundary>
      </LanguageProvider>
    </ThemeProvider>
  );
};


export default App;