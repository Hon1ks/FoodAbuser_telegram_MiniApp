import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MealProvider } from './context/MealContext';
import { SettingsProvider } from './context/SettingsContext';
import BottomNav from './components/BottomNav';
import HomeScreen from './screens/HomeScreen';
import DiaryScreen from './screens/DiaryScreen';
import AddMealScreen from './screens/AddMealScreen';
import AnalyticsScreen from './screens/AnalyticsScreen';
import SettingsScreen from './screens/SettingsScreen';
import './App.css';

// Initialise Telegram WebApp
if (window.Telegram?.WebApp) {
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
}

export default function App() {
  return (
    <SettingsProvider>
      <MealProvider>
        <BrowserRouter>
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
        </BrowserRouter>
      </MealProvider>
    </SettingsProvider>
  );
}
