import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMeals, addMeal as apiAddMeal, deleteMeal as apiDeleteMeal } from '../services/api';

const MealContext = createContext(null);

export function MealProvider({ children }) {
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMeals = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMeals(params);
      setMeals(Array.isArray(data) ? data : data.meals || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeals();
  }, [fetchMeals]);

  const addMeal = useCallback(async (meal) => {
    const record = {
      name: meal.name || 'Блюдо',
      calories: Number(meal.calories) || 0,
      protein: Number(meal.protein) || 0,
      fat: Number(meal.fat) || 0,
      carbs: Number(meal.carbs) || 0,
      weight: Number(meal.weight) || 0,
      category: meal.category || 'other',
      date: meal.date || new Date().toISOString().split('T')[0],
      timestamp: meal.timestamp || Date.now(),
    };
    const result = await apiAddMeal(record);
    await fetchMeals();
    return result;
  }, [fetchMeals]);

  const deleteMeal = useCallback(async (id) => {
    // Optimistic: remove immediately so the UI always responds to the tap
    setMeals(prev => prev.filter(m => m.id !== id));
    try {
      await apiDeleteMeal(id);
    } catch {
      // On failure, reload from server to restore correct state
      fetchMeals();
    }
  }, [fetchMeals]);

  const clearAllMeals = useCallback(async () => {
    const toDelete = [...meals];
    setMeals([]); // optimistic clear
    try {
      await Promise.all(toDelete.map(m => apiDeleteMeal(m.id)));
    } catch {
      fetchMeals(); // restore on failure
    }
  }, [meals, fetchMeals]);

  const getTodayMeals = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    return meals.filter((m) => m.date === today);
  }, [meals]);

  const getMealsByDate = useCallback((date) => {
    return meals.filter((m) => m.date === date);
  }, [meals]);

  const getTodayStats = useCallback(() => {
    const todayMeals = getTodayMeals();
    return todayMeals.reduce(
      (acc, m) => ({
        calories: acc.calories + (Number(m.calories) || 0),
        protein: acc.protein + (Number(m.protein) || 0),
        fat: acc.fat + (Number(m.fat) || 0),
        carbs: acc.carbs + (Number(m.carbs) || 0),
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0 }
    );
  }, [getTodayMeals]);

  return (
    <MealContext.Provider value={{ meals, loading, error, addMeal, deleteMeal, clearAllMeals, fetchMeals, getTodayMeals, getMealsByDate, getTodayStats }}>
      {children}
    </MealContext.Provider>
  );
}

export const useMeals = () => {
  const ctx = useContext(MealContext);
  if (!ctx) throw new Error('useMeals must be used within MealProvider');
  return ctx;
};
