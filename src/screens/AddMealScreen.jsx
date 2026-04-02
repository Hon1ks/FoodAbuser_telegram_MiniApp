import { useState, useRef, useEffect } from 'react';
import { useMeals } from '../context/MealContext';
import { analyzeFood, analyzeFoodByText } from '../services/api';
import { useFavorites } from '../hooks/useFavorites';
import { useSettings } from '../context/SettingsContext';
import styles from './AddMealScreen.module.css';

// ── AI Rate Limiter ────────────────────────────────────────────────────
const AI_DAILY_LIMIT = 10;

function getAiUsage() {
  try {
    const raw = localStorage.getItem('fa_ai_usage');
    if (!raw) return { date: '', count: 0 };
    const data = JSON.parse(raw);
    const today = new Date().toISOString().split('T')[0];
    if (data.date !== today) return { date: today, count: 0 };
    return data;
  } catch { return { date: '', count: 0 }; }
}

function incrementAiUsage() {
  const usage = getAiUsage();
  const today = new Date().toISOString().split('T')[0];
  const next = { date: today, count: (usage.date === today ? usage.count : 0) + 1 };
  localStorage.setItem('fa_ai_usage', JSON.stringify(next));
  return next.count;
}

function getRemainingAiRequests() {
  const usage = getAiUsage();
  return Math.max(0, AI_DAILY_LIMIT - usage.count);
}
// ───────────────────────────────────────────────────────────────────────

// ── Module-level: keep AI analysis alive across tab switches ────────────
// The promise + result live here even when the component unmounts/remounts.
let _inflightPromise = null;
let _lastResult = null;   // caches result so a remount can recover it
let _lastError  = null;
const _subscribers = new Set();

function _trackInflight(promise) {
  _inflightPromise = promise;
  _lastResult = null;
  _lastError  = null;
  promise
    .then(result => {
      if (_inflightPromise !== promise) return;
      _inflightPromise = null;
      _lastResult = result;           // ← cache for remounting component
      _subscribers.forEach(cb => cb(null, result));
      _subscribers.clear();
    })
    .catch(err => {
      if (_inflightPromise !== promise) return;
      _inflightPromise = null;
      _lastError = err;
      _subscribers.forEach(cb => cb(err, null));
      _subscribers.clear();
    });
}
// ───────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'breakfast', label: 'Завтрак' },
  { value: 'lunch', label: 'Обед' },
  { value: 'dinner', label: 'Ужин' },
  { value: 'snack', label: 'Перекус' },
  { value: 'other', label: 'Прочее' },
];

const today = () => new Date().toISOString().split('T')[0];
const EMPTY_FORM = { name: '', calories: '', protein: '', fat: '', carbs: '', weight: '', category: 'other', date: today() };

function applyAiResult(result, prev) {
  if (result?.items?.length > 0) {
    const total = result.total || {};
    const first = result.items[0];
    return {
      ...prev,
      name: result.items.map(i => i.ru_name || i.name).join(' + ') || prev.name,
      calories: Math.round(total.calories ?? first.calories ?? 0),
      protein: +(total.protein ?? first.protein ?? prev.protein).toFixed(1),
      fat:     +(total.fat     ?? first.fat     ?? prev.fat    ).toFixed(1),
      carbs:   +(total.carbs   ?? first.carbs   ?? prev.carbs  ).toFixed(1),
      weight:  result.items.reduce((s, i) => s + (i.grams || 0), 0) || prev.weight,
    };
  }
  if (result && !result.items) {
    return {
      ...prev,
      name: result.name || prev.name,
      calories: result.calories ?? prev.calories,
      protein: result.protein ?? prev.protein,
      fat: result.fat ?? prev.fat,
      carbs: result.carbs ?? prev.carbs,
      weight: result.weight ?? prev.weight,
    };
  }
  return prev;
}

export default function AddMealScreen() {
  const { addMeal } = useMeals();
  const { favorites, addFavorite, removeFavorite } = useFavorites();
  const { settings } = useSettings();
  const [nightDismissed, setNightDismissed] = useState(false);
  const currentHour = new Date().getHours();
  const showNightWarning = settings.nightWarning !== false
    && currentHour >= (settings.nightWarningHour ?? 21)
    && !nightDismissed;

  // ── State — restored from sessionStorage on mount ───────────────────
  const [form, setForm] = useState(() => {
    try { const s = sessionStorage.getItem('fa_form'); return s ? JSON.parse(s) : { ...EMPTY_FORM, date: today() }; }
    catch { return { ...EMPTY_FORM, date: today() }; }
  });
  const [aiMode, setAiMode] = useState(() => sessionStorage.getItem('fa_aiMode') || 'photo');
  const [textDesc, setTextDesc] = useState(() => sessionStorage.getItem('fa_text') || '');
  // aiResult is also persisted so it survives tab navigation
  const [aiResult, setAiResult] = useState(() => {
    try { const s = sessionStorage.getItem('fa_aiResult'); return s ? JSON.parse(s) : null; }
    catch { return null; }
  });
  // If there's an in-flight analysis from a previous mount, start in "analyzing" state
  const [analyzing, setAnalyzing] = useState(() => _inflightPromise !== null);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [pendingFile, setPendingFile] = useState(null);  // file selected, waiting for hint
  const [hint, setHint] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [favSaved, setFavSaved] = useState(false);
  const [showFavs, setShowFavs] = useState(false);
  const [aiRemaining, setAiRemaining] = useState(() => getRemainingAiRequests());

  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const nameRef = useRef(null);

  // ── Simulated AI analysis progress (0 → ~85% during fetch, 100% on done) ──
  useEffect(() => {
    if (!analyzing) {
      if (analyzeProgress > 0) {
        // Analysis just finished — jump to 100% briefly, then reset
        setAnalyzeProgress(100);
        const t = setTimeout(() => setAnalyzeProgress(0), 600);
        return () => clearTimeout(t);
      }
      return;
    }
    setAnalyzeProgress(0);
    // Easing: fast start → slow approach to ceiling
    // Tick every 300ms; speed decreases as progress approaches 85%
    const interval = setInterval(() => {
      setAnalyzeProgress(prev => {
        if (prev >= 95) return prev; // hold until real response arrives
        const remaining = 95 - prev;
        const step = Math.max(remaining * 0.12, 0.5); // 12% of remaining, min 0.5
        return Math.min(prev + step, 85);
      });
    }, 300);
    return () => clearInterval(interval);
  }, [analyzing]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-resize name textarea (also fires when AI fills the field) ──
  useEffect(() => {
    const el = nameRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [form.name]);

  // ── Persist to sessionStorage ────────────────────────────────────────
  useEffect(() => { sessionStorage.setItem('fa_form', JSON.stringify(form)); }, [form]);
  useEffect(() => { sessionStorage.setItem('fa_aiMode', aiMode); }, [aiMode]);
  useEffect(() => { sessionStorage.setItem('fa_text', textDesc); }, [textDesc]);

  // ── Re-attach to analysis that ran while this component was unmounted ──
  useEffect(() => {
    // Case 1: analysis already finished while we were away → apply cached result
    if (_lastResult) {
      _persistAiResult(_lastResult, setAiResult, setForm);
      _lastResult = null;
      setAnalyzing(false);
      return;
    }
    if (_lastError) {
      setError('Ошибка анализа: ' + _lastError.message);
      _lastError = null;
      setAnalyzing(false);
      return;
    }
    // Case 2: analysis is still in-flight → subscribe to its result
    if (!_inflightPromise) return;
    const cb = (err, result) => {
      setAnalyzing(false);
      if (!err && result) _persistAiResult(result, setAiResult, setForm);
      else if (err) setError('Ошибка анализа: ' + err.message);
    };
    _subscribers.add(cb);
    return () => { _subscribers.delete(cb); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  // ── AI: photo ────────────────────────────────────────────────────────
  const processImageFile = async (file, hintText = '') => {
    if (!file) return;
    if (getRemainingAiRequests() <= 0) {
      setError(`Дневной лимит AI исчерпан (${AI_DAILY_LIMIT}/${AI_DAILY_LIMIT}). Попробуй завтра.`);
      return;
    }
    setAnalyzing(true); setError(''); setAiResult(null);
    setPendingFile(null); setHint('');
    sessionStorage.removeItem('fa_aiResult');

    const analysisPromise = (async () => {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      return await analyzeFood(b64, hintText);
    })();

    _trackInflight(analysisPromise);

    try {
      const result = await analysisPromise;
      incrementAiUsage();
      setAiRemaining(getRemainingAiRequests());
      _persistAiResult(result, setAiResult, setForm);
    } catch (e) {
      setError('Ошибка анализа: ' + e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // ── File selected → show hint UI before sending ──────────────────────
  const handleFileSelected = (file) => {
    if (!file) return;
    if (getRemainingAiRequests() <= 0) {
      setError(`Дневной лимит AI исчерпан (${AI_DAILY_LIMIT}/${AI_DAILY_LIMIT}). Попробуй завтра.`);
      return;
    }
    setPendingFile(file);
    setHint('');
    setError('');
  };

  // ── AI: text ─────────────────────────────────────────────────────────
  const handleTextAnalyze = async () => {
    if (!textDesc.trim()) { setError('Опишите блюдо'); return; }
    if (getRemainingAiRequests() <= 0) {
      setError(`Дневной лимит AI исчерпан (${AI_DAILY_LIMIT}/${AI_DAILY_LIMIT}). Попробуй завтра.`);
      return;
    }
    setAnalyzing(true); setError(''); setAiResult(null);
    sessionStorage.removeItem('fa_aiResult');

    const analysisPromise = analyzeFoodByText(textDesc);
    _trackInflight(analysisPromise);

    try {
      const result = await analysisPromise;
      incrementAiUsage();
      setAiRemaining(getRemainingAiRequests());
      _persistAiResult(result, setAiResult, setForm);
    } catch (e) {
      setError('Ошибка анализа: ' + e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Введите название'); return; }
    setSaving(true); setError('');
    try {
      await addMeal({ ...form });
      // Log early breakfast for "Ранняя пташка" achievement
      if (form.category === 'breakfast' && new Date().getHours() < 9) {
        try {
          const dateKey = new Date().toISOString().split('T')[0];
          const log = JSON.parse(localStorage.getItem('fa_breakfast_early_log') || '[]');
          if (!log.includes(dateKey)) {
            log.push(dateKey);
            localStorage.setItem('fa_breakfast_early_log', JSON.stringify(log));
          }
        } catch {}
      }
      setSuccess(true);
      const cleared = { ...EMPTY_FORM, date: today() };
      setForm(cleared);
      setAiResult(null); setTextDesc('');
      sessionStorage.removeItem('fa_form');
      sessionStorage.removeItem('fa_text');
      sessionStorage.removeItem('fa_aiResult');
      setTimeout(() => setSuccess(false), 2500);
    } catch (e) { setError('Ошибка сохранения: ' + e.message); }
    finally { setSaving(false); }
  };

  // ── Favorites ─────────────────────────────────────────────────────────
  const handleSaveFav = () => {
    if (!form.name.trim()) { setError('Введите название для сохранения в избранное'); return; }
    addFavorite(form);
    setFavSaved(true);
    setTimeout(() => setFavSaved(false), 2000);
  };

  const applyFav = (fav) => {
    setForm(p => ({ ...p, name: fav.name, calories: fav.calories, protein: fav.protein, fat: fav.fat, carbs: fav.carbs, weight: fav.weight, category: fav.category }));
    setShowFavs(false);
  };

  return (
    <div className={styles.container}>
      {showNightWarning && (
        <div className={styles.nightWarning}>
          <span>🌙 Позднее питание после {settings.nightWarningHour ?? 21}:00 может мешать сну и обмену веществ</span>
          <button className={styles.nightDismiss} onClick={() => setNightDismissed(true)}>✕</button>
        </div>
      )}
      <h1 className={styles.title}>Добавить приём пищи</h1>

      {/* ── Favourites section ── */}
      {favorites.length > 0 && (
        <div className={styles.favsSection}>
          <button className={styles.favsToggle} onClick={() => setShowFavs(v => !v)}>
            ⭐ Избранные блюда <span className={styles.favsCount}>{favorites.length}</span>
            <span className={styles.favsArrow}>{showFavs ? '▲' : '▼'}</span>
          </button>
          {showFavs && (
            <div className={styles.favsList}>
              {favorites.map(fav => (
                <div key={fav.id} className={styles.favItem}>
                  <button className={styles.favApplyBtn} onClick={() => applyFav(fav)}>
                    <span className={styles.favName}>{fav.name}</span>
                    <span className={styles.favMeta}>{fav.calories} ккал · {fav.weight}г</span>
                  </button>
                  <button className={styles.favDeleteBtn} onClick={() => removeFavorite(fav.id)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── AI Analysis ── */}
      <div className={styles.aiCard}>
        <div className={styles.aiCardHeader}>
          <div className={styles.aiModeRow}>
            <button className={[styles.modeBtn, aiMode==='photo' ? styles.modeActive : ''].join(' ')} onClick={() => setAiMode('photo')}>📷 Фото</button>
            <button className={[styles.modeBtn, aiMode==='text'  ? styles.modeActive : ''].join(' ')} onClick={() => setAiMode('text')}>✏️ Текст</button>
          </div>
          <span className={[styles.aiLimit, aiRemaining === 0 ? styles.aiLimitEmpty : aiRemaining <= 3 ? styles.aiLimitLow : ''].join(' ')}>
            ✨ {aiRemaining}/{AI_DAILY_LIMIT}
          </span>
        </div>

        {aiMode === 'photo' ? (
          <>
            <p className={styles.aiHint}>Снимите или выберите фото для автоанализа КБЖУ</p>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={e => handleFileSelected(e.target.files?.[0])} />
            <input ref={galleryRef} type="file" accept="image/*" style={{display:'none'}} onChange={e => handleFileSelected(e.target.files?.[0])} />
            <div className={styles.photoBtnRow}>
              <button className={styles.photoBtn} onClick={() => cameraRef.current?.click()} disabled={analyzing}>📸 Камера</button>
              <button className={[styles.photoBtn, styles.photoBtnGallery].join(' ')} onClick={() => galleryRef.current?.click()} disabled={analyzing}>🖼 Галерея</button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.aiHint}>Опишите блюдо — ИИ рассчитает КБЖУ</p>
            <textarea className={styles.textArea} value={textDesc} onChange={e => setTextDesc(e.target.value)}
              placeholder="Например: тарелка гречки с куриной грудкой, примерно 300г" rows={3} />
            <button className={styles.analyzeBtn} onClick={handleTextAnalyze} disabled={analyzing || !textDesc.trim()}>
              {analyzing ? '⏳ Анализирую...' : '✨ Рассчитать КБЖУ'}
            </button>
          </>
        )}

        {/* Hint UI: shown after file selected, before sending to AI */}
        {pendingFile && !analyzing && (
          <div className={styles.hintBox}>
            <p className={styles.hintLabel}>📸 Фото выбрано. Добавьте комментарий (необязательно):</p>
            <input
              className={styles.hintInput}
              type="text"
              value={hint}
              onChange={e => setHint(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && processImageFile(pendingFile, hint)}
              placeholder="Например: большая порция, гречка ~200г"
              maxLength={120}
            />
            <div className={styles.hintBtnRow}>
              <button className={styles.hintAnalyzeBtn} onClick={() => processImageFile(pendingFile, hint)}>
                ✨ Анализировать
              </button>
              <button className={styles.hintCancelBtn} onClick={() => { setPendingFile(null); setHint(''); }}>
                Отмена
              </button>
            </div>
          </div>
        )}

        {(analyzing || analyzeProgress === 100) && (
          <div className={styles.analyzingWrap}>
            <div className={styles.analyzingHeader}>
              <p className={styles.analyzing}>
                {analyzeProgress === 100 ? '✓ Готово!' : 'ИИ анализирует блюдо...'}
              </p>
              <span className={styles.analyzingPct}>{Math.round(analyzeProgress)}%</span>
            </div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${analyzeProgress}%`,
                  transition: analyzeProgress === 100
                    ? 'width 0.2s ease'
                    : 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}
        {aiResult && !analyzing && <div className={styles.aiSuccess}><span>✓</span><span>Данные заполнены. Проверьте ниже.</span></div>}
      </div>

      {/* ── Form ── */}
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label}>Дата приёма</label>
          <input className={styles.input} type="date" name="date" value={form.date} onChange={handleChange} />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Название блюда *</label>
          <textarea
            ref={nameRef}
            className={[styles.input, styles.nameTextarea].join(' ')}
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Например: Гречка с курицей"
            rows={1}
          />
        </div>

        <div className={styles.categoryRow}>
          {CATEGORIES.map(c => (
            <button key={c.value} type="button"
              className={[styles.catBtn, form.category===c.value ? styles.catActive : ''].join(' ')}
              onClick={() => setForm(p => ({...p, category: c.value}))}>
              {c.label}
            </button>
          ))}
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Калории (ккал)</label>
            <input className={styles.input} name="calories" type="number" min="0" value={form.calories} onChange={handleChange} placeholder="0" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Вес (г)</label>
            <input className={styles.input} name="weight" type="number" min="0" value={form.weight} onChange={handleChange} placeholder="0" />
          </div>
        </div>

        <div className={styles.macroRow}>
          <div className={styles.field}>
            <label className={styles.label}>Белки</label>
            <input className={[styles.input, styles.proteinInput].join(' ')} name="protein" type="number" min="0" step="0.1" value={form.protein} onChange={handleChange} placeholder="0" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Жиры</label>
            <input className={[styles.input, styles.fatInput].join(' ')} name="fat" type="number" min="0" step="0.1" value={form.fat} onChange={handleChange} placeholder="0" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Углеводы</label>
            <input className={[styles.input, styles.carbsInput].join(' ')} name="carbs" type="number" min="0" step="0.1" value={form.carbs} onChange={handleChange} placeholder="0" />
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.successMsg}>✓ Добавлено в дневник!</p>}
        {favSaved && <p className={styles.favSavedMsg}>⭐ Добавлено в избранное!</p>}

        <button className={styles.submitBtn} type="submit" disabled={saving}>
          {saving ? 'Сохраняю...' : 'Добавить в дневник'}
        </button>

        <button type="button" className={styles.favBtn} onClick={handleSaveFav}>
          ⭐ Сохранить в избранное
        </button>
      </form>
    </div>
  );
}

// ── Helper: save AI result to both React state and sessionStorage ───────
function _persistAiResult(result, setAiResult, setForm) {
  setAiResult(result);
  setForm(p => applyAiResult(result, p));
  try { sessionStorage.setItem('fa_aiResult', JSON.stringify(result)); } catch {}
}
