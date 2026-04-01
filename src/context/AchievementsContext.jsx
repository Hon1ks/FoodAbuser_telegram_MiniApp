import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ACHIEVEMENTS } from '../achievements/definitions';

function loadUnlocked() {
  try { return JSON.parse(localStorage.getItem('fa_achievements') || '{}'); }
  catch { return {}; }
}

function saveUnlocked(data) {
  localStorage.setItem('fa_achievements', JSON.stringify(data));
}

// ── Streak helpers ──────────────────────────────────────────────────────────

/** Walk backwards from today counting consecutive days that pass a predicate */
function countConsecutiveDays(predicate) {
  let streak = 0;
  let offset = 0;
  while (true) {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const dateStr = d.toISOString().split('T')[0];
    if (predicate(dateStr)) { streak++; offset++; }
    else break;
    if (offset > 366) break; // safety cap
  }
  return streak;
}

/** Consecutive days where daily water >= waterGoal */
function computeWaterStreak(waterGoal) {
  if (!waterGoal) return 0;
  try {
    const history = JSON.parse(localStorage.getItem('fa_water_history') || '{}');
    return countConsecutiveDays(d => (history[d] || 0) >= waterGoal);
  } catch { return 0; }
}

/** Consecutive days where user logged an early breakfast (<9am) */
function computeBreakfastStreak() {
  try {
    const log = JSON.parse(localStorage.getItem('fa_breakfast_early_log') || '[]');
    const dateSet = new Set(log);
    return countConsecutiveDays(d => dateSet.has(d));
  } catch { return 0; }
}

/** Total days where daily calories are within ±5% of goal + current consecutive streak */
function computeCalorieGoalStats(meals, calorieGoal) {
  if (!meals || !meals.length || !calorieGoal) return { hitDays: 0, streak: 0 };
  const lower = calorieGoal * 0.95;
  const upper = calorieGoal * 1.05;
  // Group calories by date
  const byDate = {};
  meals.forEach(m => {
    byDate[m.date] = (byDate[m.date] || 0) + (Number(m.calories) || 0);
  });
  const hitSet = new Set(
    Object.keys(byDate).filter(d => byDate[d] >= lower && byDate[d] <= upper)
  );
  const streak = countConsecutiveDays(d => hitSet.has(d));
  return { hitDays: hitSet.size, streak };
}

// ── Exported helpers (also used in AchievementsScreen for progress display) ─
export { computeWaterStreak, computeBreakfastStreak, computeCalorieGoalStats };

// ────────────────────────────────────────────────────────────────────────────

const AchievementsContext = createContext(null);

export function AchievementsProvider({ children }) {
  const [unlocked, setUnlocked] = useState(loadUnlocked);
  const [toastQueue, setToastQueue] = useState([]);
  const [activeToast, setActiveToast] = useState(null);

  // Process queue: show one toast at a time, pick next after dismiss
  useEffect(() => {
    if (activeToast || !toastQueue.length) return;
    setActiveToast(toastQueue[0]);
    setToastQueue(prev => prev.slice(1));
  }, [toastQueue, activeToast]);

  const dismissToast = useCallback(() => {
    setActiveToast(null);
  }, []);

  /** Generic unlock helper — prevents duplicates, queues toasts */
  const unlockNew = useCallback((candidates) => {
    if (!candidates.length) return;
    const current = loadUnlocked();
    const newOnes = candidates.filter(a => !current[a.key]);
    if (!newOnes.length) return;
    const now = new Date().toISOString();
    const updated = { ...current };
    newOnes.forEach(a => { updated[a.key] = { unlockedAt: now }; });
    saveUnlocked(updated);
    setUnlocked(updated);
    setToastQueue(prev => [...prev, ...newOnes]);
  }, []);

  /**
   * Check meal_count achievements.
   * Handles catch-up: if user jumped from 4→12, unlocks 5 AND 10 in order.
   */
  const checkMealCount = useCallback((totalMeals) => {
    const candidates = ACHIEVEMENTS
      .filter(a => a.type === 'meal_count')
      .filter(a => totalMeals >= a.threshold)
      .sort((a, b) => a.threshold - b.threshold);
    unlockNew(candidates);
  }, [unlockNew]);

  /** Check calorie goal achievements (В цель / Снайпер / Киборг) */
  const checkCalorieGoal = useCallback((meals, calorieGoal) => {
    const { hitDays, streak } = computeCalorieGoalStats(meals, calorieGoal);
    const candidates = ACHIEVEMENTS
      .filter(a => a.type === 'calorie_goal')
      .filter(a => {
        if (a.key === 'calorie_1')  return hitDays >= 1;
        if (a.key === 'calorie_7')  return streak  >= 7;
        if (a.key === 'calorie_30') return hitDays >= 30;
        return false;
      })
      .sort((a, b) => a.threshold - b.threshold);
    unlockNew(candidates);
  }, [unlockNew]);

  /** Check Посейдон: waterIntake >= waterGoal × 2 */
  const checkWaterOverflow = useCallback((waterIntake, waterGoal) => {
    if (!waterGoal || waterIntake < waterGoal * 2) return;
    const candidates = ACHIEVEMENTS.filter(a => a.key === 'water_poseidon');
    unlockNew(candidates);
  }, [unlockNew]);

  /** Check water streak achievements (Маг воды: 10 дней подряд) */
  const checkWaterAchievements = useCallback((waterGoal) => {
    const streak = computeWaterStreak(waterGoal);
    const candidates = ACHIEVEMENTS
      .filter(a => a.type === 'water' && a.key !== 'water_poseidon')
      .filter(a => streak >= a.threshold)
      .sort((a, b) => a.threshold - b.threshold);
    unlockNew(candidates);
  }, [unlockNew]);

  /** Check breakfast streak achievement (Ранняя пташка: 7 дней подряд до 9:00) */
  const checkBreakfastStreak = useCallback(() => {
    const streak = computeBreakfastStreak();
    const candidates = ACHIEVEMENTS
      .filter(a => a.type === 'breakfast')
      .filter(a => streak >= a.threshold)
      .sort((a, b) => a.threshold - b.threshold);
    unlockNew(candidates);
  }, [unlockNew]);

  /** Next locked achievement for given meal count */
  const getNextMealRank = useCallback((totalMeals) => {
    return ACHIEVEMENTS
      .filter(a => a.type === 'meal_count' && totalMeals < a.threshold)
      .sort((a, b) => a.threshold - b.threshold)[0] ?? null;
  }, []);

  /** Highest unlocked meal rank */
  const getCurrentMealRank = useCallback((totalMeals) => {
    return [...ACHIEVEMENTS]
      .filter(a => a.type === 'meal_count' && totalMeals >= a.threshold)
      .sort((a, b) => b.threshold - a.threshold)[0] ?? null;
  }, []);

  return (
    <AchievementsContext.Provider value={{
      unlocked,
      activeToast,
      dismissToast,
      checkMealCount,
      checkCalorieGoal,
      checkWaterOverflow,
      checkWaterAchievements,
      checkBreakfastStreak,
      getNextMealRank,
      getCurrentMealRank,
    }}>
      {children}
    </AchievementsContext.Provider>
  );
}

export const useAchievements = () => {
  const ctx = useContext(AchievementsContext);
  if (!ctx) throw new Error('useAchievements must be used within AchievementsProvider');
  return ctx;
};
