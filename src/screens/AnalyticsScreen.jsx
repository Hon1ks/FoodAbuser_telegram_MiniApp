import { useState, useMemo } from 'react';
import { useMeals } from '../context/MealContext';
import { useSettings } from '../context/SettingsContext';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Bar, ReferenceLine,
} from 'recharts';
import styles from './AnalyticsScreen.module.css';

const PRESETS = [
  { label: '1д', days: 1 },
  { label: '7д', days: 7 },
  { label: '30д', days: 30 },
];

const CHART_DEFS = [
  { key: 'calories', label: '🔥 Калории' },
  { key: 'macros',   label: '📊 Макро (общий)' },
  { key: 'protein',  label: '● Белки',    color: '#43cea2' },
  { key: 'fat',      label: '● Жиры',     color: '#f7971e' },
  { key: 'carbs',    label: '● Углеводы', color: '#6C63FF' },
  { key: 'weight',   label: '⚖️ Вес' },
];
const DEFAULT_VIS = Object.fromEntries(CHART_DEFS.map(c => [c.key, true]));

function dateRange(days, fromDate, toDate) {
  if (fromDate && toDate) {
    const dates = [];
    const cur = new Date(fromDate + 'T12:00');
    const end = new Date(toDate + 'T12:00');
    while (cur <= end) {
      dates.push(cur.toLocaleDateString('sv-SE'));
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toLocaleDateString('sv-SE'));
  }
  return dates;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipLabel}>{label}</p>
      {payload.map(p => <p key={p.dataKey} style={{ color: p.color, margin: '2px 0', fontSize: 12 }}>{p.name}: {Math.round(p.value * 10) / 10}</p>)}
    </div>
  );
};

function MacroChart({ dataKey, label, color, goal, data }) {
  const avg = data.length
    ? Math.round(data.reduce((s, d) => s + (d[dataKey] || 0), 0) / data.length)
    : 0;
  return (
    <div className={styles.chartCard}>
      <div className={styles.chartTitleRow}>
        <span className={styles.macroChartDot} style={{ background: color }} />
        <h2 className={styles.chartTitle} style={{ color }}>{label}</h2>
        <span className={styles.macroChartAvg}>ср. {avg}г · цель {goal}г</span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
          <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey={dataKey} name={`${label} (г)`} fill={color} radius={[4,4,0,0]} activeBar={{ fill: color, opacity: 0.8 }} />
          {goal > 0 && <ReferenceLine y={goal} stroke={color} strokeDasharray="5 5" strokeOpacity={0.5} label={{ value:'цель', fill: color, fontSize: 10 }} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AnalyticsScreen() {
  const { meals } = useMeals();
  const { settings, weightRecords } = useSettings();

  const [preset, setPreset] = useState(7);
  const [customMode, setCustomMode] = useState('days');
  const [customDays, setCustomDays] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  // Chart visibility: persisted to localStorage
  const [chartVisible, setChartVisible] = useState(() => {
    try {
      const s = localStorage.getItem('fa_chart_vis');
      return s ? { ...DEFAULT_VIS, ...JSON.parse(s) } : DEFAULT_VIS;
    } catch { return DEFAULT_VIS; }
  });
  const [showChartPanel, setShowChartPanel] = useState(false);

  const toggleChart = (key) => {
    setChartVisible(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('fa_chart_vis', JSON.stringify(next));
      return next;
    });
  };

  const dates = useMemo(() => {
    if (showCustom) {
      if (customMode === 'range' && fromDate && toDate) return dateRange(0, fromDate, toDate);
      if (customMode === 'days' && customDays > 0) return dateRange(Number(customDays));
    }
    return dateRange(preset);
  }, [preset, showCustom, customMode, customDays, fromDate, toDate]);

  const calorieData = useMemo(() => dates.map(date => {
    const dayMeals = meals.filter(m => m.date === date);
    return { date: date.slice(5), calories: Math.round(dayMeals.reduce((s, m) => s + (Number(m.calories) || 0), 0)), goal: settings.calorieGoal };
  }), [dates, meals, settings.calorieGoal]);

  const macroData = useMemo(() => dates.map(date => {
    const dm = meals.filter(m => m.date === date);
    return {
      date: date.slice(5),
      protein: Math.round(dm.reduce((s, m) => s + (Number(m.protein) || 0), 0)),
      fat: Math.round(dm.reduce((s, m) => s + (Number(m.fat) || 0), 0)),
      carbs: Math.round(dm.reduce((s, m) => s + (Number(m.carbs) || 0), 0)),
    };
  }), [dates, meals]);

  const weightData = useMemo(() =>
    weightRecords.filter(r => dates.includes(r.date))
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(r => ({ date: r.date.slice(5), weight: r.weight })),
    [weightRecords, dates]);

  const totalMeals = useMemo(() => meals.filter(m => dates.includes(m.date)).length, [meals, dates]);
  const avgCalories = useMemo(() => {
    const daysWithMeals = dates.filter(d => meals.some(m => m.date === d));
    if (!daysWithMeals.length) return 0;
    return Math.round(daysWithMeals.reduce((s, d) => s + meals.filter(m => m.date === d).reduce((a, m) => a + (Number(m.calories) || 0), 0), 0) / daysWithMeals.length);
  }, [meals, dates]);

  const handlePreset = (days) => { setPreset(days); setShowCustom(false); };
  const handleCustomApply = () => { setPreset(null); };

  // Count hidden charts for badge
  const hiddenCount = Object.values(chartVisible).filter(v => !v).length;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Аналитика</h1>

      {/* Period + chart settings row */}
      <div className={styles.periodRow}>
        {PRESETS.map(({ label, days }) => (
          <button key={days} className={[styles.periodBtn, !showCustom && preset === days ? styles.periodActive : ''].join(' ')} onClick={() => handlePreset(days)}>{label}</button>
        ))}
        <button className={[styles.periodBtn, showCustom ? styles.periodActive : ''].join(' ')} onClick={() => setShowCustom(v => !v)}>⚙️ Своё</button>
        <button
          className={[styles.periodBtn, styles.chartSettingsBtn, showChartPanel ? styles.periodActive : ''].join(' ')}
          onClick={() => setShowChartPanel(v => !v)}
        >
          📊{hiddenCount > 0 ? ` −${hiddenCount}` : ''}
        </button>
      </div>

      {/* Chart visibility panel */}
      {showChartPanel && (
        <div className={styles.chartPanel}>
          <p className={styles.chartPanelTitle}>Показывать графики:</p>
          <div className={styles.chartToggleRow}>
            {CHART_DEFS.map(({ key, label, color }) => (
              <button
                key={key}
                className={[styles.chartToggleBtn, chartVisible[key] ? styles.chartToggleActive : ''].join(' ')}
                style={chartVisible[key] && color ? { borderColor: color, color } : {}}
                onClick={() => toggleChart(key)}
              >
                {chartVisible[key] ? '✓' : '○'} {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom period panel */}
      {showCustom && (
        <div className={styles.customPanel}>
          <div className={styles.customModeRow}>
            <button className={[styles.customModeBtn, customMode === 'days' ? styles.customModeActive : ''].join(' ')} onClick={() => setCustomMode('days')}>По кол-ву дней</button>
            <button className={[styles.customModeBtn, customMode === 'range' ? styles.customModeActive : ''].join(' ')} onClick={() => setCustomMode('range')}>По датам</button>
          </div>
          {customMode === 'days' ? (
            <div className={styles.customRow}>
              <input className={styles.customInput} type="number" min="1" max="365" placeholder="Кол-во дней" value={customDays} onChange={e => setCustomDays(e.target.value)} />
              <button className={styles.applyBtn} onClick={handleCustomApply} disabled={!customDays}>Применить</button>
            </div>
          ) : (
            <div className={styles.customRangeRow}>
              <input className={styles.customInput} type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              <span className={styles.rangeSep}>—</span>
              <input className={styles.customInput} type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
              <button className={styles.applyBtn} onClick={handleCustomApply} disabled={!fromDate || !toDate}>→</button>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      <div className={styles.summaryRow}>
        <div className={styles.summaryChip}><span className={styles.summaryVal}>{totalMeals}</span><span className={styles.summaryLabel}>приёмов пищи</span></div>
        <div className={styles.summaryChip}><span className={styles.summaryVal}>{avgCalories}</span><span className={styles.summaryLabel}>средн. ккал/день</span></div>
        {weightData.length > 0 && <div className={styles.summaryChip}><span className={styles.summaryVal}>{weightData[weightData.length - 1].weight}</span><span className={styles.summaryLabel}>кг сейчас</span></div>}
      </div>

      {/* Calories */}
      {chartVisible.calories && (
        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle} style={{ marginBottom: 12 }}>Калории</h2>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={calorieData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="calories" name="ккал" fill="#43cea2" radius={[4,4,0,0]} activeBar={{ fill: '#5dd9b4', opacity: 1 }} />
              <ReferenceLine y={settings.calorieGoal} stroke="#6C63FF" strokeDasharray="5 5" label={{ value:'цель', fill:'#6C63FF', fontSize:10 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Macros combined */}
      {chartVisible.macros && (
        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle} style={{ marginBottom: 12 }}>Макронутриенты (г)</h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={macroData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1 }} />
              <Line type="monotone" dataKey="protein" name="Белки" stroke="#43cea2" strokeWidth={2} dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
              <Line type="monotone" dataKey="fat" name="Жиры" stroke="#f7971e" strokeWidth={2} dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
              <Line type="monotone" dataKey="carbs" name="Углеводы" stroke="#6C63FF" strokeWidth={2} dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Individual macro charts */}
      {[
        { key: 'protein', label: 'Белки',    color: '#43cea2', goal: settings.proteinGoal },
        { key: 'fat',     label: 'Жиры',     color: '#f7971e', goal: settings.fatGoal },
        { key: 'carbs',   label: 'Углеводы', color: '#6C63FF', goal: settings.carbsGoal },
      ].map(({ key, label, color, goal }) => (
        chartVisible[key] && (
          <MacroChart key={key} dataKey={key} label={label} color={color} goal={goal} data={macroData} />
        )
      ))}

      {/* Weight */}
      {chartVisible.weight && (
        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle} style={{ marginBottom: 12 }}>Вес (кг)</h2>
          {weightData.length > 1 ? (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={weightData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} domain={['auto', 'auto']} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1 }} />
                <Line type="monotone" dataKey="weight" name="кг" stroke="#6C63FF" strokeWidth={2.5} dot={{ r: 4, fill:'#6C63FF', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className={styles.noData}>Добавьте записи веса в Настройках</p>
          )}
        </div>
      )}
    </div>
  );
}
