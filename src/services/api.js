const DEV_MODE = import.meta.env.DEV;
// In dev mode, use Vite proxy (/api → Worker) to bypass CORS
const API_BASE = DEV_MODE ? '/api' : 'https://food-abuser-api.goorbunoov22.workers.dev';

function getAuthHeaders() {
  if (DEV_MODE) {
    return { 'X-Dev-User-Id': 'dev_user' };
  }
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData;
  if (initData) {
    return { 'X-Telegram-Init-Data': initData };
  }
  return { 'X-Dev-User-Id': 'dev_user' };
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...options.headers,
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

// --- Meal normalization (API ↔ internal format) ---
function normalizeMeal(m) {
  const mealTime = m.meal_time || m.created_at || new Date().toISOString();
  return {
    id: m.id,
    name: m.title || m.name || 'Блюдо',
    category: m.category || 'other',
    calories: Number(m.calories) || 0,
    protein: Number(m.protein) || 0,
    fat: Number(m.fat) || 0,
    carbs: Number(m.carbs) || 0,
    weight: Number(m.portion_weight ?? m.weight) || 0,
    date: mealTime.split('T')[0],
    timestamp: new Date(mealTime).getTime(),
  };
}

function mealToApi(meal) {
  const date = meal.date || new Date().toISOString().split('T')[0];
  return {
    title: meal.name || 'Блюдо',
    description: meal.description || '',
    category: meal.category || 'other',
    calories: Number(meal.calories) || 0,
    protein: Number(meal.protein) || 0,
    fat: Number(meal.fat) || 0,
    carbs: Number(meal.carbs) || 0,
    portion_weight: Number(meal.weight) || 0,
    // Always use selected date — never override with timestamp
    meal_time: new Date(`${date}T12:00:00`).toISOString(),
  };
}

// Meals
export const getMeals = async (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  const data = await request(`/meals${qs ? '?' + qs : ''}`);
  const list = Array.isArray(data) ? data : data.meals || [];
  return list.map(normalizeMeal);
};

export const addMeal = (meal) =>
  request('/meals', { method: 'POST', body: JSON.stringify(mealToApi(meal)) });

export const deleteMeal = (id) => request(`/meals?id=${encodeURIComponent(id)}`, { method: 'DELETE' });

// Settings
export const getSettings = () => request('/settings');
export const saveSettings = (settings) =>
  request('/settings', { method: 'POST', body: JSON.stringify(settings) });

// Weight
function normalizeWeight(r) {
  const date = r.date || new Date().toISOString().split('T')[0];
  // Prefer exact created_at from API, then our sent timestamp, then noon fallback
  const ts = r.created_at
    ? new Date(r.created_at).getTime()
    : r.timestamp
      ? Number(r.timestamp)
      : new Date(`${date}T12:00:00`).getTime();
  return {
    ...r,
    weight: Number(r.weight),
    date,
    timestamp: ts,
  };
}

export const getWeight = async (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  const data = await request(`/weight${qs ? '?' + qs : ''}`);
  const list = Array.isArray(data) ? data : data.records || [];
  // _seq preserves API insertion order as a tiebreaker when timestamps are identical
  return list.map((r, idx) => ({ ...normalizeWeight(r), _seq: idx }));
};

export const addWeight = (record) =>
  request('/weight', { method: 'POST', body: JSON.stringify(record) });

export const deleteWeight = (id) => request(`/weight?id=${encodeURIComponent(id)}`, { method: 'DELETE' });

const VLM_URL = 'https://vlm-foodabuser-tg-miniapp.goorbunoov95.workers.dev/';

// AI food analysis — by photo
export const analyzeFood = async (base64Image) => {
  const res = await fetch(VLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ image: base64Image }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `VLM ${res.status}`);
  }
  const data = await res.json();
  // Sync server-side remaining count back to localStorage
  if (typeof data.ai_remaining === 'number') {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('fa_ai_usage', JSON.stringify({ date: today, count: 10 - data.ai_remaining }));
  }
  return data;
};

// AI food analysis — by text description
export const analyzeFoodByText = async (text) => {
  const res = await fetch(VLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `VLM ${res.status}`);
  }
  const data = await res.json();
  if (typeof data.ai_remaining === 'number') {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('fa_ai_usage', JSON.stringify({ date: today, count: 10 - data.ai_remaining }));
  }
  return data;
};
