import { useState, useCallback } from 'react';

const KEY = 'fa_favorites';

const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
};

export function useFavorites() {
  const [favorites, setFavorites] = useState(load);

  const addFavorite = useCallback((meal) => {
    if (!meal.name?.trim()) return;
    const item = {
      id: Date.now(),
      name: meal.name,
      calories: Number(meal.calories) || 0,
      protein: Number(meal.protein) || 0,
      fat: Number(meal.fat) || 0,
      carbs: Number(meal.carbs) || 0,
      weight: Number(meal.weight) || 0,
      category: meal.category || 'other',
    };
    setFavorites(prev => {
      // Заменяем если уже есть с таким именем, иначе добавляем в начало
      const next = [item, ...prev.filter(f => f.name !== item.name)].slice(0, 25);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
    return item;
  }, []);

  const removeFavorite = useCallback((id) => {
    setFavorites(prev => {
      const next = prev.filter(f => f.id !== id);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { favorites, addFavorite, removeFavorite };
}
