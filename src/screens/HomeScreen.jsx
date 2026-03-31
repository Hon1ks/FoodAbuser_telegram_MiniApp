import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMeals } from '../context/MealContext';
import { useSettings } from '../context/SettingsContext';
import styles from './HomeScreen.module.css';

const CATEGORY_LABELS = { breakfast:'Завтрак', lunch:'Обед', dinner:'Ужин', snack:'Перекус', other:'Прочее' };

function calcStreak(meals) {
  if (!meals.length) return 0;
  const datesWithMeals = new Set(meals.map(m => m.date));
  const today = new Date().toLocaleDateString('sv-SE');
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('sv-SE');
  const startDate = datesWithMeals.has(today) ? today : datesWithMeals.has(yesterday) ? yesterday : null;
  if (!startDate) return 0;
  let streak = 0;
  const cur = new Date(startDate + 'T12:00');
  while (datesWithMeals.has(cur.toLocaleDateString('sv-SE'))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

function MacroBar({ label, value, goal, color }) {
  const pct = Math.min((value / Math.max(goal, 1)) * 100, 100);
  return (
    <div className={styles.macroItem}>
      <div className={styles.macroHeader}>
        <span className={styles.macroLabel}>{label}</span>
        <span className={styles.macroValue}>{Math.round(value)} / {goal}г</span>
      </div>
      <div className={styles.barTrack}><div className={styles.barFill} style={{ width:`${pct}%`, background:color }} /></div>
    </div>
  );
}

/* ── Animated Water Glass ── */
function WaterGlass({ fillPct, displayPct }) {
  const fill = Math.min(Math.max(fillPct, 0), 100);
  const isOverflow = displayPct >= 100;

  return (
    <div className={styles.glassOuter}>
      {/* Overflow drips falling outside the glass */}
      {isOverflow && (
        <div className={styles.overflowZone}>
          <div className={styles.overflowDrip} style={{ left:'12%', animationDelay:'0s',   animationDuration:'1.1s' }} />
          <div className={styles.overflowDrip} style={{ left:'68%', animationDelay:'0.45s', animationDuration:'0.85s' }} />
          <div className={styles.overflowDrip} style={{ left:'38%', animationDelay:'0.8s',  animationDuration:'1.3s' }} />
        </div>
      )}
      <div className={[styles.glass, isOverflow ? styles.glassOverflowing : ''].join(' ')}>
        <div className={styles.waterLevel} style={{ height: `${fill}%` }}>
          <div className={styles.waveWrap}>
            <div className={styles.wave} />
            <div className={styles.wave2} />
          </div>
        </div>
        <div className={styles.glassLabel}>{Math.round(displayPct)}%</div>
        {fill > 10 && <div className={styles.bubble} style={{ left:'20%', animationDelay:'0s',   animationDuration:'2.2s' }} />}
        {fill > 25 && <div className={styles.bubble} style={{ left:'55%', animationDelay:'0.8s', animationDuration:'1.8s' }} />}
        {fill > 50 && <div className={styles.bubble} style={{ left:'35%', animationDelay:'1.4s', animationDuration:'2.5s' }} />}
      </div>
      <div className={styles.glassBase} />
    </div>
  );
}

/* ── Water Tracker ── */
function WaterTracker() {
  const { settings, waterIntake, addWater, resetWater, setWaterManual } = useSettings();
  const [manual, setManual] = useState('');
  const [showManual, setShowManual] = useState(false);
  const goal = settings.waterGoal || 2000;
  const rawPct = (waterIntake / goal) * 100;
  const fillPct = Math.min(rawPct, 100);   // высота заполнения (макс 100%)
  const displayPct = rawPct;               // отображаемый % (может быть >100)
  const QUICK = [150, 200, 300, 500];

  return (
    <div className={styles.trackerCard}>
      <div className={styles.trackerHeader}>
        <span className={styles.trackerTitle}>💧 Вода</span>
        <span className={styles.trackerMeta}>{(goal / 1000).toFixed(1)} л цель</span>
      </div>

      <div className={styles.waterBody}>
        <WaterGlass fillPct={fillPct} displayPct={displayPct} />
        <div className={styles.waterRight}>
          <div className={styles.waterAmount}>
            <span className={styles.waterVal}>{waterIntake < 1000 ? waterIntake : (waterIntake/1000).toFixed(2).replace(/\.?0+$/,'')}
            </span>
            <span className={styles.waterUnit}>{waterIntake < 1000 ? 'мл' : 'л'}</span>
          </div>
          <p className={styles.waterRemain}>
            {waterIntake >= goal * 2
              ? '🔱 Уровень Посейдон достигнут!'
              : waterIntake >= goal
                ? '🎉 Цель достигнута!'
                : `ещё ${goal - waterIntake} мл`}
          </p>
          <div className={styles.waterBtns}>
            {QUICK.map(ml => (
              <button key={ml} className={styles.waterBtn} onClick={() => addWater(ml)}>+{ml}</button>
            ))}
          </div>
          <div className={styles.waterActions}>
            <button className={styles.waterLinkBtn} onClick={() => setShowManual(v => !v)}>✏️ вручную</button>
            <button className={styles.waterLinkBtn} onClick={resetWater}>↺ сброс</button>
          </div>
          {showManual && (
            <div className={styles.manualRow}>
              <input className={styles.manualInput} type="number" min="0" max="9999" placeholder="мл" value={manual} onChange={e => setManual(e.target.value)} />
              <button className={styles.manualAddBtn} onClick={() => { setWaterManual(waterIntake + Number(manual)); setManual(''); setShowManual(false); }}>+</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Weight Data Hook ── */
function useWeightData() {
  const { settings, getLatestWeight, getInitialWeight } = useSettings();
  const latestRec = getLatestWeight();
  const initialRec = getInitialWeight();
  const latest = latestRec ? latestRec.weight : null;
  const initial = initialRec ? initialRec.weight : (settings.initialWeight || null);
  const goal = Number(settings.weightGoal) || null;

  let progress = 0;
  if (initial && latest !== null && goal && initial !== goal) {
    progress = Math.min(Math.max(((initial - latest) / (initial - goal)) * 100, 0), 100);
  }

  return { initial, latest, goal, progress };
}

/* ── Widget 1: Циферблат (Ring Dial) ── */
function W1RingDial() {
  const { initial, latest, goal, progress } = useWeightData();

  const cx = 64, cy = 64, R = 52;
  // Arc from -210° to +30° = 240° sweep
  const startDeg = -210;
  const sweepDeg = 240;
  const endDeg = startDeg + sweepDeg;

  const toRad = (d) => (d * Math.PI) / 180;

  const arcPath = (fromDeg, toDeg) => {
    const x1 = cx + R * Math.cos(toRad(fromDeg));
    const y1 = cy + R * Math.sin(toRad(fromDeg));
    const x2 = cx + R * Math.cos(toRad(toDeg));
    const y2 = cy + R * Math.sin(toRad(toDeg));
    const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`;
  };

  const progressDeg = startDeg + (sweepDeg * progress) / 100;
  const dotX = cx + R * Math.cos(toRad(progressDeg));
  const dotY = cy + R * Math.sin(toRad(progressDeg));

  const totalLen = (sweepDeg / 360) * 2 * Math.PI * R;
  const filledLen = (progress / 100) * totalLen;

  return (
    <div className={styles.w1Wrap}>
      <svg width="128" height="128" viewBox="0 0 128 128" style={{ flexShrink: 0 }}>
        <defs>
          <linearGradient id="wRingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6C63FF" />
            <stop offset="100%" stopColor="#43cea2" />
          </linearGradient>
        </defs>
        {/* Background arc */}
        <path d={arcPath(startDeg, endDeg)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeLinecap="round" />
        {/* Progress arc */}
        {progress > 0 && (
          <path d={arcPath(startDeg, endDeg)} fill="none" stroke="url(#wRingGrad)" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${filledLen} ${totalLen}`}
            strokeDashoffset="0"
          />
        )}
        {/* Glowing dot */}
        {latest !== null && (
          <>
            <circle cx={dotX} cy={dotY} r="8" fill="rgba(67,206,162,0.25)" />
            <circle cx={dotX} cy={dotY} r="4" fill="#43cea2" />
          </>
        )}
        {/* Center text */}
        <text x={cx} y={cy - 8} textAnchor="middle" fill="#fff" fontSize="20" fontWeight="800">
          {latest !== null ? latest : '–'}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="10">
          кг
        </text>
        {progress > 0 && (
          <text x={cx} y={cy + 22} textAnchor="middle" fill="#43cea2" fontSize="11" fontWeight="700">
            {Math.round(progress)}%
          </text>
        )}
      </svg>
      <div className={styles.w1Stats}>
        <div className={styles.w1Stat}>
          <span className={styles.w1Label}>Нач</span>
          <span className={styles.w1Val}>{initial !== null ? initial : '–'}</span>
        </div>
        <div className={styles.w1Stat}>
          <span className={styles.w1Label}>Тек</span>
          <span className={styles.w1Val} style={{ color: '#43cea2' }}>{latest !== null ? latest : '–'}</span>
        </div>
        <div className={styles.w1Stat}>
          <span className={styles.w1Label}>Цель</span>
          <span className={styles.w1Val}>{goal !== null ? goal : '–'}</span>
        </div>
        {initial !== null && latest !== null && (() => {
          const delta = +(latest - initial).toFixed(1);
          return (
            <div className={styles.w1Stat}>
              <span className={styles.w1Label}>Δ</span>
              <span className={styles.w1Val} style={{ color: delta <= 0 ? '#43cea2' : '#ff6b6b', fontSize: 13 }}>
                {delta === 0 ? '±0' : `${delta > 0 ? '+' : ''}${delta}`}
              </span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

/* ── Weight Record Card ── */
function WeightRecordCard() {
  const navigate = useNavigate();
  const { addWeight } = useSettings();
  const [input, setInput] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  const handleAdd = async () => {
    if (!input) return;
    setErr('');
    setSaving(true);
    try {
      await addWeight({ weight: Number(input) });
      setInput('');
      setShowInput(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      {showInput ? (
        <div className={styles.weightQuickRow}>
          <input
            className={styles.manualInput}
            type="number" step="0.1" min="20" max="500"
            placeholder="Введите вес (кг)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            autoFocus
          />
          <button className={styles.manualAddBtn} onClick={handleAdd} disabled={!input || saving}>{saving ? '…' : '✓'}</button>
          <button className={styles.cancelInputBtn} onClick={() => { setShowInput(false); setInput(''); }}>✕</button>
        </div>
      ) : (
        <div className={styles.weightBtnRow}>
          <button className={styles.weightRecordBtn} onClick={() => setShowInput(true)}>+ Записать новый вес</button>
          <button className={styles.weightHistoryBtn} onClick={() => navigate('/settings')}>⊞ История</button>
        </div>
      )}
      {saved && <p className={styles.weightSaved}>✓ Вес сохранён!</p>}
      {err && <p className={styles.trackerErr}>{err}</p>}
    </div>
  );
}

/* ── Weight Tracker ── */
function WeightTracker() {
  const { settings } = useSettings();

  if (!settings.showWeightTracker) return null;

  return (
    <div className={styles.trackerCard}>
      <div className={styles.trackerHeader}>
        <span className={styles.trackerTitle}>⚖️ Трекер веса</span>
      </div>
      <W1RingDial />
      <WeightRecordCard />
    </div>
  );
}

/* ── Main HomeScreen ── */
export default function HomeScreen() {
  const { meals, getTodayMeals, getTodayStats, loading } = useMeals();
  const { settings } = useSettings();

  const todayMeals = getTodayMeals();
  const stats = getTodayStats();
  const calPct = Math.min((stats.calories / Math.max(settings.calorieGoal, 1)) * 100, 100);
  const streak = calcStreak(meals);

  const tg = window.Telegram?.WebApp;
  const user = tg?.initDataUnsafe?.user;
  const name = user?.first_name || settings.name || '';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.greeting}>Привет{name ? `, ${name}` : ''}! 👋</h1>
          <p className={styles.date}>{new Date().toLocaleDateString('ru-RU', { weekday:'long', day:'numeric', month:'long' })}</p>
          {streak > 0 && (
            <div className={styles.streakBadge}>
              <span className={styles.streakFire}>{streak >= 14 ? '🔥' : streak >= 7 ? '🔆' : '✦'}</span>
              <span className={styles.streakNum}>{streak}</span>
              <span className={styles.streakLabel}>{streak === 1 ? 'день подряд' : streak < 5 ? 'дня подряд' : 'дней подряд'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Calorie card */}
      <div className={styles.card}>
        <div className={styles.ringSection}>
          <div className={styles.ringWrap}>
            <svg viewBox="0 0 80 80" className={styles.ring}>
              <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
              <circle cx="40" cy="40" r="32" fill="none" stroke="url(#calGrad)" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${2*Math.PI*32}`}
                strokeDashoffset={`${2*Math.PI*32*(1-calPct/100)}`}
                transform="rotate(-90 40 40)" />
              <defs><linearGradient id="calGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#43cea2"/><stop offset="100%" stopColor="#6C63FF"/></linearGradient></defs>
            </svg>
            <div className={styles.ringCenter}>
              <span className={styles.ringCal}>{Math.round(stats.calories)}</span>
              <span className={styles.ringLabel}>ккал</span>
            </div>
          </div>
          <div className={styles.ringInfo}>
            <p className={styles.ringGoalText}>Цель: {settings.calorieGoal} ккал</p>
            <p className={styles.ringRemain}>
              {stats.calories >= settings.calorieGoal
                ? `+${Math.round(stats.calories - settings.calorieGoal)} сверх нормы`
                : `Осталось: ${Math.round(settings.calorieGoal - stats.calories)} ккал`}
            </p>
          </div>
        </div>
        <div className={styles.macros}>
          <MacroBar label="Белки" value={stats.protein} goal={settings.proteinGoal} color="#43cea2" />
          <MacroBar label="Жиры" value={stats.fat} goal={settings.fatGoal} color="#f7971e" />
          <MacroBar label="Углеводы" value={stats.carbs} goal={settings.carbsGoal} color="#6C63FF" />
        </div>
      </div>

      {settings.showWaterTracker && <WaterTracker />}
      <WeightTracker />

      {/* Today's meals */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Сегодня</h2>
        {loading && <p className={styles.empty}>Загрузка...</p>}
        {!loading && todayMeals.length === 0 && <p className={styles.empty}>Нажми + чтобы добавить приём пищи</p>}
        {todayMeals.map((meal) => (
          <div key={meal.id} className={styles.mealCard}>
            <div className={styles.mealInfo}>
              <span className={styles.mealName}>{meal.name}</span>
              <span className={styles.mealCategory}>{CATEGORY_LABELS[meal.category] || meal.category}{meal.weight > 0 ? ` · ${meal.weight}г` : ''}</span>
            </div>
            <span className={styles.mealCal}>{Math.round(meal.calories)} ккал</span>
          </div>
        ))}
      </div>
    </div>
  );
}
