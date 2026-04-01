import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useMeals } from '../context/MealContext';
import styles from './SettingsScreen.module.css';

// ── TDEE Calculator (Mifflin-St Jeor) ────────────────────────────────────
function calcTDEE({ gender, age, height, weight, activity, goal }) {
  if (!age || !height || !weight) return null;
  const bmr = gender === 'male'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;
  const mult = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
  const tdee = bmr * (mult[activity] || 1.375);
  const cal = Math.round(goal === 'lose' ? tdee * 0.8 : goal === 'gain' ? tdee * 1.1 : tdee);
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calories: cal,
    protein: Math.round((cal * 0.30) / 4),
    fat:     Math.round((cal * 0.25) / 9),
    carbs:   Math.round((cal * 0.45) / 4),
  };
}

const ACTIVITY_LABELS = {
  sedentary:   'Сидячий (офис, без тренировок)',
  light:       'Лёгкая активность (1-3 дня/нед)',
  moderate:    'Умеренная (3-5 дней/нед)',
  active:      'Высокая (6-7 дней/нед)',
  very_active: 'Очень высокая (спортсмен)',
};

function TDEECalculator({ onApply }) {
  const [calc, setCalc] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fa_tdee_input') || '{}'); }
    catch { return {}; }
  });
  const [result, setResult] = useState(null);

  const set = (k, v) => setCalc(p => {
    const next = { ...p, [k]: v };
    localStorage.setItem('fa_tdee_input', JSON.stringify(next));
    return next;
  });

  const handle = () => setResult(calcTDEE({
    gender:   calc.gender   || 'male',
    age:      Number(calc.age),
    height:   Number(calc.height),
    weight:   Number(calc.weight),
    activity: calc.activity || 'moderate',
    goal:     calc.goal     || 'maintain',
  }));

  return (
    <div>
      {/* Gender */}
      <div className={styles.genderRow}>
        {['male', 'female'].map(g => (
          <button key={g} type="button"
            className={[styles.genderBtn, (calc.gender || 'male') === g ? styles.genderActive : ''].join(' ')}
            onClick={() => set('gender', g)}>
            {g === 'male' ? '♂ Мужчина' : '♀ Женщина'}
          </button>
        ))}
      </div>
      {/* Age / Height / Weight */}
      <div className={styles.calcRow}>
        <div className={styles.calcField}>
          <label className={styles.fieldLabel}>Возраст</label>
          <div className={styles.inputWrap}>
            <input className={styles.input} type="number" min="10" max="100" value={calc.age || ''} onChange={e => set('age', e.target.value)} placeholder="лет" />
          </div>
        </div>
        <div className={styles.calcField}>
          <label className={styles.fieldLabel}>Рост</label>
          <div className={styles.inputWrap}>
            <input className={styles.input} type="number" min="100" max="250" value={calc.height || ''} onChange={e => set('height', e.target.value)} placeholder="см" />
          </div>
        </div>
        <div className={styles.calcField}>
          <label className={styles.fieldLabel}>Вес</label>
          <div className={styles.inputWrap}>
            <input className={styles.input} type="number" min="30" max="300" value={calc.weight || ''} onChange={e => set('weight', e.target.value)} placeholder="кг" />
          </div>
        </div>
      </div>
      {/* Activity */}
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Уровень активности</label>
        <select className={styles.input} value={calc.activity || 'moderate'} onChange={e => set('activity', e.target.value)}
          style={{ color: '#fff', background: '#1e1e30', colorScheme: 'dark' }}>
          {Object.entries(ACTIVITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {/* Goal */}
      <div className={styles.goalRow}>
        {[['lose','Похудеть'], ['maintain','Поддержать'], ['gain','Набрать']].map(([k, v]) => (
          <button key={k} type="button"
            className={[styles.goalBtn, (calc.goal || 'maintain') === k ? styles.goalActive : ''].join(' ')}
            onClick={() => set('goal', k)}>{v}</button>
        ))}
      </div>
      <button className={styles.calcBtn} onClick={handle}
        disabled={!calc.age || !calc.height || !calc.weight}>
        Рассчитать
      </button>
      {result && (
        <div className={styles.calcResult}>
          <div className={styles.calcResultRow}>
            <span className={styles.calcResultLabel}>Базовый обмен (BMR)</span>
            <span className={styles.calcResultVal}>{result.bmr} ккал</span>
          </div>
          <div className={styles.calcResultRow}>
            <span className={styles.calcResultLabel}>С учётом активности (TDEE)</span>
            <span className={styles.calcResultVal}>{result.tdee} ккал</span>
          </div>
          <div className={styles.calcResultDivider} />
          <div className={styles.calcResultRow}>
            <span className={styles.calcResultLabel}>Рекомендуемые калории</span>
            <span className={[styles.calcResultVal, styles.calcResultHighlight].join(' ')}>{result.calories} ккал</span>
          </div>
          <div className={styles.calcMacroRow}>
            <span className={styles.calcMacro} style={{ color: '#43cea2' }}>Б: {result.protein}г</span>
            <span className={styles.calcMacro} style={{ color: '#f7971e' }}>Ж: {result.fat}г</span>
            <span className={styles.calcMacro} style={{ color: '#6C63FF' }}>У: {result.carbs}г</span>
          </div>
          <button className={styles.applyCalcBtn} onClick={() => onApply(result)}>
            ↓ Применить к моим целям
          </button>
        </div>
      )}
    </div>
  );
}

function NumberField({ label, name, value, onChange, unit, min = 0 }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      <div className={styles.inputWrap}>
        <input className={styles.input} type="number" name={name} value={value} onChange={onChange} min={min} />
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>
    </div>
  );
}

function Toggle({ value, onChange, label, hint }) {
  return (
    <div className={styles.toggleRow}>
      <div>
        <p className={styles.toggleLabel}>{label}</p>
        {hint && <p className={styles.toggleHint}>{hint}</p>}
      </div>
      <label className={styles.toggle}>
        <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} />
        <span className={styles.toggleSlider} />
      </label>
    </div>
  );
}

export default function SettingsScreen() {
  const navigate = useNavigate();
  const { settings, updateSettings, settingsLoading, weightRecords, addWeight, deleteWeight, clearWeightHistory, getLatestWeight, calcSmartWaterGoal, theme, setTheme } = useSettings();
  const { meals, clearAllMeals } = useMeals();

  const handleExportCSV = () => {
    const CATEGORY_LABELS = { breakfast:'Завтрак', lunch:'Обед', dinner:'Ужин', snack:'Перекус', other:'Прочее' };
    const BOM = '\uFEFF';
    const header = 'Дата,Название,Категория,Калории,Белки (г),Жиры (г),Углеводы (г),Вес (г)';
    const rows = [...meals]
      .sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0))
      .map(m => [
        m.date,
        `"${(m.name || '').replace(/"/g, '""')}"`,
        CATEGORY_LABELS[m.category] || m.category,
        Math.round(m.calories || 0),
        +(m.protein || 0).toFixed(1),
        +(m.fat || 0).toFixed(1),
        +(m.carbs || 0).toFixed(1),
        m.weight || 0,
      ].join(','));
    const csv = BOM + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `food-diary-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const [goals, setGoals] = useState({
    calorieGoal: settings.calorieGoal,
    proteinGoal: settings.proteinGoal,
    fatGoal: settings.fatGoal,
    carbsGoal: settings.carbsGoal,
    waterGoal: settings.waterGoal,
    weightGoal: settings.weightGoal,
    initialWeight: settings.initialWeight,
  });
  const [goalsSaved, setGoalsSaved] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [weightDate, setWeightDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [weightSaving, setWeightSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);

  useEffect(() => {
    setGoals({
      calorieGoal: settings.calorieGoal,
      proteinGoal: settings.proteinGoal,
      fatGoal: settings.fatGoal,
      carbsGoal: settings.carbsGoal,
      waterGoal: settings.waterGoal,
      weightGoal: settings.weightGoal,
      initialWeight: settings.initialWeight,
    });
  }, [
    settings.calorieGoal, settings.proteinGoal, settings.fatGoal,
    settings.carbsGoal, settings.waterGoal, settings.weightGoal, settings.initialWeight,
  ]);

  const latestWeight = getLatestWeight();

  const handleGoalChange = (e) => setGoals(p => ({ ...p, [e.target.name]: Number(e.target.value) }));

  const saveGoals = async () => {
    await updateSettings(goals);
    setGoalsSaved(true);
    setTimeout(() => setGoalsSaved(false), 2000);
  };

  const handleAddWeight = async () => {
    if (!weightInput) return;
    setWeightSaving(true);
    try { await addWeight({ weight: Number(weightInput), date: weightDate }); setWeightInput(''); }
    finally { setWeightSaving(false); }
  };

  const handleApplyCalc = (result) => {
    setGoals(p => ({ ...p, calorieGoal: result.calories, proteinGoal: result.protein, fatGoal: result.fat, carbsGoal: result.carbs }));
    setShowCalc(false);
    // Scroll to goals section
    setTimeout(() => document.getElementById('goals-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleFullReset = async () => {
    setResetting(true);
    try {
      // 1. Clear all meals on server
      await clearAllMeals();
      // 2. Clear weight history
      await clearWeightHistory();
      // 3. Reset settings to defaults
      await updateSettings({
        calorieGoal: 2000, proteinGoal: 150, fatGoal: 65, carbsGoal: 250,
        waterGoal: 2000, weightGoal: 0, initialWeight: 0,
        name: '', showWaterTracker: true, showWeightTracker: true,
        nightWarning: true, nightWarningHour: 21,
        gender: 'male', age: 0, height: 0, activityLevel: 'moderate',
      });
      // 4. Clear all localStorage fa_* keys (except fa_theme — user preference should persist)
      Object.keys(localStorage)
        .filter(k => k.startsWith('fa_') && k !== 'fa_theme')
        .forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();
    } finally {
      setResetting(false);
      // Reload to re-trigger onboarding and fresh state
      window.location.reload();
    }
  };

  const tg = window.Telegram?.WebApp;
  const user = tg?.initDataUnsafe?.user;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Настройки</h1>

      {user && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Профиль</h2>
          <div className={styles.profileRow}>
            {user.photo_url && <img className={styles.avatar} src={user.photo_url} alt="avatar" />}
            <div>
              <p className={styles.profileName}>{user.first_name} {user.last_name || ''}</p>
              {user.username && <p className={styles.profileUsername}>@{user.username}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Trackers visibility */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Трекеры на главном экране</h2>
        <Toggle
          label="Трекер воды 💧"
          hint="Показывать на главном экране"
          value={settings.showWaterTracker}
          onChange={v => updateSettings({ showWaterTracker: v })}
        />
        <div className={styles.divider} />
        <Toggle
          label="Трекер веса ⚖️"
          hint="Показывать на главном экране"
          value={settings.showWeightTracker}
          onChange={v => updateSettings({ showWeightTracker: v })}
        />
        <div className={styles.divider} />
        {/* Night warning — custom row with hour selector */}
        <div className={styles.toggleRow}>
          <div style={{ flex: 1 }}>
            <p className={styles.toggleLabel}>🌙 Позднее питание</p>
            <p className={styles.toggleHint}>Предупреждать если еда добавлена после:</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <select
                className={styles.nightHourSelect}
                value={settings.nightWarningHour ?? 21}
                onChange={e => updateSettings({ nightWarningHour: Number(e.target.value) })}
                disabled={settings.nightWarning === false}
              >
                {[18,19,20,21,22,23].map(h => (
                  <option key={h} value={h}>{h}:00</option>
                ))}
              </select>
            </div>
          </div>
          <label className={styles.toggle}>
            <input type="checkbox" checked={settings.nightWarning !== false}
              onChange={e => updateSettings({ nightWarning: e.target.checked })} />
            <span className={styles.toggleSlider} />
          </label>
        </div>
      </div>

      {/* TDEE Calculator */}
      <div className={styles.card}>
        <div className={styles.historyHeader}>
          <h2 className={styles.cardTitle} style={{ margin: 0 }}>🧮 Рассчитать норму КБЖУ</h2>
          <button className={styles.historyToggleBtn} onClick={() => setShowCalc(v => !v)}>
            {showCalc ? 'Скрыть' : 'Показать'}
          </button>
        </div>
        {showCalc && <div style={{ marginTop: 14 }}><TDEECalculator onApply={handleApplyCalc} /></div>}
      </div>

      {/* Goals */}
      <div id="goals-section" className={styles.card}>
        <div className={styles.historyHeader}>
          <h2 className={styles.cardTitle} style={{ margin: 0 }}>🎯 Мои цели</h2>
          <button className={styles.historyToggleBtn} onClick={() => setGoalsOpen(v => !v)}>
            {goalsOpen ? 'Скрыть' : 'Показать'}
          </button>
        </div>
        {goalsOpen && (
          <>
            <div className={styles.fieldsGrid} style={{ marginTop: 14 }}>
              <NumberField label="Калории" name="calorieGoal" value={goals.calorieGoal} onChange={handleGoalChange} unit="ккал" />
              <NumberField label="Белки" name="proteinGoal" value={goals.proteinGoal} onChange={handleGoalChange} unit="г" />
              <NumberField label="Жиры" name="fatGoal" value={goals.fatGoal} onChange={handleGoalChange} unit="г" />
              <NumberField label="Углеводы" name="carbsGoal" value={goals.carbsGoal} onChange={handleGoalChange} unit="г" />
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <NumberField label="Вода" name="waterGoal" value={goals.waterGoal} onChange={handleGoalChange} unit="мл" />
                </div>
                <button
                  type="button"
                  className={styles.autoCalcBtn}
                  onClick={() => setGoals(g => ({ ...g, waterGoal: calcSmartWaterGoal() }))}
                  title="Рассчитать по весу и активности"
                >🧮</button>
              </div>
              <NumberField label="Цель по весу" name="weightGoal" value={goals.weightGoal} onChange={handleGoalChange} unit="кг" />
              <NumberField label="Начальный вес" name="initialWeight" value={goals.initialWeight} onChange={handleGoalChange} unit="кг" />
            </div>
            <p className={styles.fieldHint}>Начальный вес — отправная точка для расчёта прогресса</p>
            <button className={styles.saveBtn} onClick={saveGoals} disabled={settingsLoading}>
              {goalsSaved ? '✓ Сохранено' : settingsLoading ? 'Сохранение...' : 'Сохранить цели'}
            </button>
          </>
        )}
      </div>

      {/* Weight records */}
      <div className={styles.card}>
        <div className={styles.historyHeader}>
          <h2 className={styles.cardTitle} style={{ margin: 0 }}>История веса</h2>
          <button className={styles.historyToggleBtn} onClick={() => setHistoryOpen(v => !v)}>
            {historyOpen ? 'Скрыть' : `Показать${weightRecords.length > 0 ? ` (${weightRecords.length})` : ''}`}
          </button>
        </div>
        <div className={styles.weightInputRow} style={{ marginTop: 12 }}>
          <input className={[styles.input, styles.weightInput].join(' ')} type="number" inputMode="decimal" step="0.1" min="20" max="500" value={weightInput} onChange={e => setWeightInput(e.target.value)} placeholder="Вес (кг)" />
          <input className={[styles.input, styles.dateInput].join(' ')} type="date" value={weightDate} onChange={e => setWeightDate(e.target.value)} />
          <button className={styles.addWeightBtn} onClick={handleAddWeight} disabled={!weightInput || weightSaving}>{weightSaving ? '…' : '+'}</button>
        </div>
        {historyOpen && (
          weightRecords.length === 0 ? (
            <p className={styles.emptyHint}>Записей ещё нет.</p>
          ) : (
            <>
              <div className={styles.weightList}>
                <div className={styles.weightListHeader}>
                  <span>Дата</span><span>Вес</span><span>Изм.</span><span />
                </div>
                {[...weightRecords]
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .map((r, idx, arr) => {
                    const prev = arr[idx + 1];
                    const diff = prev ? (r.weight - prev.weight) : null;
                    return (
                      <div key={r.id} className={styles.weightRecord}>
                        <span className={styles.weightRecordDate}>
                          {new Date(r.date + 'T12:00').toLocaleDateString('ru-RU', { day:'numeric', month:'short', year:'2-digit' })}
                        </span>
                        <span className={styles.weightRecordVal}>{r.weight} кг</span>
                        <span className={[styles.weightDiff, diff === null ? '' : diff < 0 ? styles.diffDown : diff > 0 ? styles.diffUp : styles.diffSame].join(' ')}>
                          {diff === null ? '—' : diff === 0 ? '±0' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}`}
                        </span>
                        <button className={styles.deleteRecordBtn} onClick={() => deleteWeight(r.id)}>✕</button>
                      </div>
                    );
                  })}
              </div>
              <div style={{ marginTop: 12 }}>
                {!confirmClear ? (
                  <button className={styles.clearHistoryBtn} onClick={() => setConfirmClear(true)}>
                    🗑 Очистить историю
                  </button>
                ) : (
                  <div className={styles.clearConfirmRow}>
                    <span className={styles.clearConfirmText}>Удалить все {weightRecords.length} записей?</span>
                    <button className={styles.clearConfirmYes} onClick={() => { clearWeightHistory(); setConfirmClear(false); setHistoryOpen(false); }}>Да</button>
                    <button className={styles.clearConfirmNo} onClick={() => setConfirmClear(false)}>Нет</button>
                  </div>
                )}
              </div>
            </>
          )
        )}
      </div>

      {/* CSV Export */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>📤 Экспорт данных</h2>
        <p className={styles.appInfo} style={{ marginBottom: 12 }}>
          Скачать весь дневник питания в формате CSV. Файл открывается в Excel, Google Sheets и других таблицах.
          {meals.length > 0 ? ` Записей: ${meals.length}.` : ' Пока нет записей.'}
        </p>
        <button
          className={styles.saveBtn}
          onClick={handleExportCSV}
          disabled={meals.length === 0}
        >
          📥 Скачать CSV
        </button>
      </div>

      {/* Achievements */}
      <div className={styles.card} style={{ cursor: 'pointer' }} onClick={() => navigate('/achievements')}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 className={styles.cardTitle} style={{ margin: 0 }}>🏆 Достижения</h2>
            <p className={styles.appInfo} style={{ margin: '4px 0 0' }}>Твои достижения и прогресс</p>
          </div>
          <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.3)' }}>›</span>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>О приложении</h2>
        <p className={styles.appInfo}>Food Abuser TMA v1.0</p>
        <p className={styles.appInfo}>Telegram Mini App для трекинга питания</p>
      </div>

      {/* Theme */}
      <div className={styles.card}>
        <div className={styles.historyHeader}>
          <h2 className={styles.cardTitle} style={{ margin: 0 }}>🎨 Тема оформления</h2>
          <button className={styles.historyToggleBtn} onClick={() => setThemeOpen(v => !v)}>
            {themeOpen ? 'Скрыть' : 'Показать'}
          </button>
        </div>
        {themeOpen && (
          <div className={styles.themeRow} style={{ marginTop: 14 }}>
            {[
              { key: 'dark',   label: 'Тёмная',    colors: ['#43cea2', '#6C63FF'] },
              { key: 'sunset', label: 'Золото',     colors: ['#F2C94C', '#F2994A'] },
              { key: 'ocean',  label: 'Океан',      colors: ['#00c6ff', '#0072ff'] },
              { key: 'purple', label: 'Неон',       colors: ['#b06aff', '#ff6aef'] },
            ].map(t => (
              <button
                key={t.key}
                className={[styles.themeBtn, theme === t.key ? styles.themeBtnActive : ''].join(' ')}
                onClick={() => setTheme(t.key)}
              >
                <div className={styles.themeSwatch}>
                  <div style={{ background: t.colors[0], flex: 1, borderRadius: '6px 0 0 6px' }} />
                  <div style={{ background: t.colors[1], flex: 1, borderRadius: '0 6px 6px 0' }} />
                </div>
                <span className={styles.themeLabel}>{t.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className={styles.dangerCard}>
        <h2 className={styles.dangerTitle}>⚠️ Опасная зона</h2>
        <p className={styles.dangerHint}>
          Полный сброс удалит все приёмы пищи, историю веса, достижения, воду и вернёт настройки к заводским значениям. Это действие необратимо.
        </p>
        {!confirmReset ? (
          <button className={styles.resetBtn} onClick={() => setConfirmReset(true)}>
            🗑 Сбросить все данные
          </button>
        ) : (
          <div className={styles.resetConfirmBox}>
            <p className={styles.resetConfirmText}>Вы уверены? Все данные будут удалены навсегда.</p>
            <div className={styles.resetConfirmRow}>
              <button
                className={styles.resetConfirmYes}
                onClick={handleFullReset}
                disabled={resetting}
              >
                {resetting ? 'Удаляю...' : 'Да, удалить всё'}
              </button>
              <button
                className={styles.resetConfirmNo}
                onClick={() => setConfirmReset(false)}
                disabled={resetting}
              >
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
