import { useState, useCallback } from 'react';
import { getAiAdvice } from '../services/api';
import styles from './AiAdviceCard.module.css';

const CACHE_KEY = 'fa_ai_advice';
const CACHE_TTL_H = 12; // refresh every 12h max

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { tips, ts } = JSON.parse(raw);
    const ageH = (Date.now() - ts) / 3600000;
    if (ageH > CACHE_TTL_H) return null;
    return tips;
  } catch { return null; }
}

function saveCache(tips) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ tips, ts: Date.now() })); } catch {}
}

// ── Build plain-text summary from meals + settings ─────────────────────────
function buildSummary(meals, settings, weightRecords) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    return d.toLocaleDateString('sv-SE');
  });

  const byDay = {};
  for (const d of days) byDay[d] = { calories: 0, protein: 0, fat: 0, carbs: 0, count: 0 };
  for (const m of meals) {
    if (byDay[m.date] !== undefined) {
      byDay[m.date].calories += m.calories || 0;
      byDay[m.date].protein  += m.protein  || 0;
      byDay[m.date].fat      += m.fat      || 0;
      byDay[m.date].carbs    += m.carbs    || 0;
      byDay[m.date].count++;
    }
  }

  const daysWithData = days.filter(d => byDay[d].count > 0);
  if (daysWithData.length === 0) return null;

  const avg = (key) => Math.round(daysWithData.reduce((s, d) => s + byDay[d][key], 0) / daysWithData.length);

  // Weight trend
  const recentWeights = [...weightRecords]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  const weightTrend = recentWeights.length >= 2
    ? `Последние веса: ${recentWeights.map(r => `${r.weight}кг`).join(', ')}`
    : recentWeights.length === 1
      ? `Текущий вес: ${recentWeights[0].weight}кг`
      : 'Вес не записан';

  return [
    `Дней с данными: ${daysWithData.length} из 7`,
    `Среднее калорий: ${avg('calories')} / цель ${settings.calorieGoal || 0} ккал`,
    `Средний белок: ${avg('protein')}г / цель ${settings.proteinGoal || 0}г`,
    `Средние жиры: ${avg('fat')}г / цель ${settings.fatGoal || 0}г`,
    `Средние углеводы: ${avg('carbs')}г / цель ${settings.carbsGoal || 0}г`,
    `Среднее приёмов пищи в день: ${(daysWithData.reduce((s, d) => s + byDay[d].count, 0) / daysWithData.length).toFixed(1)}`,
    weightTrend,
    settings.weightGoal ? `Цель по весу: ${settings.weightGoal}кг` : '',
  ].filter(Boolean).join('\n');
}

export default function AiAdviceCard({ meals, settings, weightRecords }) {
  const [tips, setTips] = useState(() => loadCache());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  const fetchAdvice = useCallback(async (force = false) => {
    if (loading) return;
    if (!force) {
      const cached = loadCache();
      if (cached) { setTips(cached); return; }
    }

    const summary = buildSummary(meals, settings, weightRecords);
    if (!summary) { setError('Недостаточно данных — добавь несколько приёмов пищи'); return; }

    setLoading(true); setError('');
    try {
      const res = await getAiAdvice(summary);
      if (res.tips?.length > 0) {
        setTips(res.tips);
        saveCache(res.tips);
      } else {
        setError('Нет советов — попробуй позже');
      }
    } catch (e) {
      setError(e.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  }, [meals, settings, weightRecords, loading]);

  const hasTips = tips && tips.length > 0;

  return (
    <div className={styles.card}>
      <div className={styles.header} onClick={() => !hasTips ? fetchAdvice() : setExpanded(v => !v)}>
        <div className={styles.titleRow}>
          <span className={styles.icon}>🧠</span>
          <div>
            <p className={styles.title}>AI советы</p>
            <p className={styles.subtitle}>Персональный анализ питания за 7 дней</p>
          </div>
        </div>
        <div className={styles.headerRight}>
          {hasTips && (
            <button className={styles.refreshBtn} onClick={e => { e.stopPropagation(); fetchAdvice(true); }} disabled={loading}>
              {loading ? '...' : '↻'}
            </button>
          )}
          {hasTips && <span className={styles.arrow}>{expanded ? '▲' : '▼'}</span>}
        </div>
      </div>

      {!hasTips && !loading && !error && (
        <button className={styles.analyzeBtn} onClick={() => fetchAdvice()}>
          ✨ Получить советы
        </button>
      )}

      {loading && (
        <div className={styles.loadingRow}>
          <div className={styles.loadingDots}>
            <span /><span /><span />
          </div>
          <p className={styles.loadingText}>Анализирую питание...</p>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {hasTips && expanded && (
        <div className={styles.tips}>
          {tips.map((tip, i) => (
            <div key={i} className={styles.tip}>
              <span className={styles.tipEmoji}>{tip.emoji}</span>
              <div className={styles.tipContent}>
                <p className={styles.tipTitle}>{tip.title}</p>
                <p className={styles.tipText}>{tip.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
