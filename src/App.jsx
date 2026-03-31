import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MealProvider } from './context/MealContext';
import { SettingsProvider } from './context/SettingsContext';
import BottomNav from './components/BottomNav';
import HomeScreen from './screens/HomeScreen';
import DiaryScreen from './screens/DiaryScreen';
import AddMealScreen from './screens/AddMealScreen';
import AnalyticsScreen from './screens/AnalyticsScreen';
import SettingsScreen from './screens/SettingsScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import './App.css';

// Initialise Telegram WebApp
if (window.Telegram?.WebApp) {
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
}

function AppInner() {
  const [onboardingDone, setOnboardingDone] = useState(
    () => !!localStorage.getItem('fa_onboarding_done')
  );

  const completeOnboarding = () => {
    localStorage.setItem('fa_onboarding_done', '1');
    setOnboardingDone(true);
  };

  if (!onboardingDone) {
    return <OnboardingScreen onComplete={completeOnboarding} />;
  }

  return (
    <div className="app-wrapper">
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/diary" element={<DiaryScreen />} />
          <Route path="/add" element={<AddMealScreen />} />
          <Route path="/analytics" element={<AnalyticsScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <MealProvider>
        <BrowserRouter>
          <AppInner />
        </BrowserRouter>
      </MealProvider>
    </SettingsProvider>
  );
}
