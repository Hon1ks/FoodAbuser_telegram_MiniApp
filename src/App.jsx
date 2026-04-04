import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MealProvider, useMeals } from './context/MealContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { AchievementsProvider, useAchievements } from './context/AchievementsContext';
import AchievementToast from './components/AchievementToast';
import BottomNav from './components/BottomNav';
import ErrorBoundary from './components/ErrorBoundary';
import HomeScreen from './screens/HomeScreen';
import DiaryScreen from './screens/DiaryScreen';
import AddMealScreen from './screens/AddMealScreen';
import AnalyticsScreen from './screens/AnalyticsScreen';
import SettingsScreen from './screens/SettingsScreen';
import AchievementsScreen from './screens/AchievementsScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import AdminScreen from './screens/AdminScreen';
import { trackAnalytics } from './services/api';
import './App.css';

// Initialise Telegram WebApp
if (window.Telegram?.WebApp) {
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
}

// ── Analytics: ping on open + heartbeat every 60s while visible ──────────
(function initAnalytics() {
  trackAnalytics('open');
  let interval = setInterval(() => {
    if (document.visibilityState === 'visible') trackAnalytics('heartbeat');
  }, 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      clearInterval(interval); interval = null;
    } else if (!interval) {
      interval = setInterval(() => {
        if (document.visibilityState === 'visible') trackAnalytics('heartbeat');
      }, 60000);
    }
  });
})();

/** Watches app state and triggers achievement checks automatically */
function AchievementWatcher() {
  const { meals } = useMeals();
  const { settings, waterIntake } = useSettings();
  const {
    checkMealCount,
    checkCalorieGoal,
    checkWaterOverflow,
    checkWaterAchievements,
    checkBreakfastStreak,
  } = useAchievements();

  // Meal count achievements
  useEffect(() => {
    if (meals.length > 0) checkMealCount(meals.length);
  }, [meals.length, checkMealCount]);

  // Calorie goal achievements (re-check when meals or goal changes)
  useEffect(() => {
    if (meals.length > 0) checkCalorieGoal(meals, settings.calorieGoal);
  }, [meals, settings.calorieGoal, checkCalorieGoal]);

  // Посейдон: 200% water goal
  useEffect(() => {
    checkWaterOverflow(waterIntake, settings.waterGoal);
  }, [waterIntake, settings.waterGoal, checkWaterOverflow]);

  // Маг воды: 10-day water streak (re-check when water changes)
  useEffect(() => {
    checkWaterAchievements(settings.waterGoal);
  }, [waterIntake, settings.waterGoal, checkWaterAchievements]);

  // Ранняя пташка: breakfast streak (check on mount)
  useEffect(() => {
    checkBreakfastStreak();
  }, [checkBreakfastStreak]);

  return null;
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
      <AchievementWatcher />
      <AchievementToast />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<ErrorBoundary title="Ошибка главного экрана"><HomeScreen /></ErrorBoundary>} />
          <Route path="/diary" element={<ErrorBoundary title="Ошибка дневника" minimal><DiaryScreen /></ErrorBoundary>} />
          <Route path="/add" element={<ErrorBoundary title="Ошибка добавления" minimal><AddMealScreen /></ErrorBoundary>} />
          <Route path="/analytics" element={<ErrorBoundary title="Ошибка аналитики" minimal><AnalyticsScreen /></ErrorBoundary>} />
          <Route path="/settings" element={<ErrorBoundary title="Ошибка настроек" minimal><SettingsScreen /></ErrorBoundary>} />
          <Route path="/achievements" element={<ErrorBoundary title="Ошибка достижений" minimal><AchievementsScreen /></ErrorBoundary>} />
          <Route path="/admin" element={<AdminScreen />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <MealProvider>
          <AchievementsProvider>
            <BrowserRouter>
              <AppInner />
            </BrowserRouter>
          </AchievementsProvider>
        </MealProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}
