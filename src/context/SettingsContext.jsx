import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSettings, saveSettings as apiSaveSettings, getWeight, addWeight as apiAddWeight, deleteWeight as apiDeleteWeight } from '../services/api';

const DEFAULT_SETTINGS = {
  calorieGoal: 2000,
  proteinGoal: 150,
  fatGoal: 65,
  carbsGoal: 250,
  waterGoal: 2000,
  weightGoal: 0,
  initialWeight: 0,
  showWeightTracker: true,
  showWaterTracker: true,
  name: '',
  language: 'ru',
};

// Water: localStorage, daily reset
function loadTodayWater() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const stored = JSON.parse(localStorage.getItem('fa_water') || '{}');
    return stored.date === today ? (stored.amount || 0) : 0;
  } catch { return 0; }
}
function saveTodayWater(amount) {
  const today = new Date().toISOString().split('T')[0];
  localStorage.setItem('fa_water', JSON.stringify({ date: today, amount }));
}

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [weightRecords, setWeightRecords] = useState([]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [waterIntake, setWaterIntake] = useState(loadTodayWater);

  useEffect(() => { loadSettings(); loadWeight(); }, []);

  const loadSettings = async () => {
    try {
      const data = await getSettings();
      if (data && typeof data === 'object') {
        setSettings((prev) => ({ ...prev, ...data }));
      }
    } catch { /* use defaults */ }
  };

  const loadWeight = async () => {
    try {
      const data = await getWeight();
      setWeightRecords(Array.isArray(data) ? data : data.records || []);
    } catch { setWeightRecords([]); }
  };

  const updateSettings = useCallback(async (updates) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    setSettingsLoading(true);
    try { await apiSaveSettings(next); }
    finally { setSettingsLoading(false); }
  }, [settings]);

  // Water
  const addWater = useCallback((ml) => {
    setWaterIntake((prev) => {
      const next = Math.min(prev + ml, 9999);
      saveTodayWater(next);
      return next;
    });
  }, []);
  const resetWater = useCallback(() => { setWaterIntake(0); saveTodayWater(0); }, []);
  const setWaterManual = useCallback((ml) => {
    const v = Math.max(0, Math.min(ml, 9999));
    setWaterIntake(v); saveTodayWater(v);
  }, []);

  // Weight
  const addWeight = useCallback(async (record) => {
    const now = Date.now();
    const date = record.date || new Date().toISOString().split('T')[0];
    const tempId = `temp_${now}`;
    // _seq: very large so this record sorts LAST (newest) in tiebreaker
    const tempRecord = { weight: Number(record.weight), date, timestamp: now, id: tempId, _seq: 999999 };

    // Optimistic: show new weight in UI immediately
    setWeightRecords(prev => [...prev, tempRecord]);

    try {
      const result = await apiAddWeight({ weight: tempRecord.weight, date, timestamp: now });
      // Replace temp ID with the real ID from the API response (if returned)
      const realId = result?.id ?? result?.record?.id ?? null;
      if (realId) {
        setWeightRecords(prev => prev.map(r => r.id === tempId ? { ...r, id: realId } : r));
      }
      // We intentionally skip loadWeight() here: calling it would normalise
      // all same-day timestamps to noon, making the sort non-deterministic.
      // The Date.now() timestamp on the temp record guarantees correct ordering.
      // Records sync from the server on the next full page load.
    } catch (e) {
      setWeightRecords(prev => prev.filter(r => r.id !== tempId));
      throw e;
    }
  }, []); // setWeightRecords is always stable

  const deleteWeight = useCallback(async (id) => {
    // Optimistic: remove immediately so the UI always responds
    setWeightRecords(prev => prev.filter(r => r.id !== id));
    try {
      await apiDeleteWeight(id);
    } catch {
      // On failure, reload from server to restore correct state
      loadWeight();
    }
  }, []);

  // Sort: date desc → timestamp desc → _seq desc (insertion order tiebreaker)
  const sortedLatest = (records) =>
    [...records].sort((a, b) => {
      if (b.date > a.date) return 1;
      if (b.date < a.date) return -1;
      if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
      return (b._seq ?? 0) - (a._seq ?? 0);
    });

  const getLatestWeight = useCallback(() => {
    if (!weightRecords.length) return null;
    return sortedLatest(weightRecords)[0];
  }, [weightRecords]);

  // Uses settings.initialWeight if explicitly set, otherwise the oldest record
  const getInitialWeight = useCallback(() => {
    if (settings.initialWeight > 0) return { weight: settings.initialWeight, date: null, id: 'initial' };
    if (!weightRecords.length) return null;
    return [...weightRecords].sort((a, b) => {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      return (a._seq ?? 0) - (b._seq ?? 0);
    })[0];
  }, [weightRecords, settings.initialWeight]);

  return (
    <SettingsContext.Provider value={{
      settings, updateSettings, settingsLoading,
      weightRecords, addWeight, deleteWeight, getLatestWeight, getInitialWeight, loadWeight,
      waterIntake, addWater, resetWater, setWaterManual,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
};
