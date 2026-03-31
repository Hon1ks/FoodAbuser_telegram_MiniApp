import { useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import styles from './OnboardingScreen.module.css';

const ACTIVITY = [
  { value: 'sedentary',   label: 'Сидячий',       hint: 'Офис, почти без движения' },
  { value: 'light',       label: 'Лёгкий',         hint: '1–3 тренировки в неделю' },
  { value: 'moderate',    label: 'Умеренный',       hint: '3–5 тренировок в неделю' },
  { value: 'active',      label: 'Активный',        hint: '6–7 тренировок в неделю' },
  { value: 'very_active', label: 'Очень активный',  hint: 'Тяжёлый труд + спорт' },
];

function calcGoals({ gender, age, height, weight, activity, goal }) {
  const w = Number(weight);
  const h = Number(height);
  const a = Number(age);
  if (!w || !h || !a) return null;

  const bmr = gender === 'male'
    ? 10 * w + 6.25 * h - 5 * a + 5
    : 10 * w + 6.25 * h - 5 * a - 161;

  const mult = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
  const tdee = bmr * (mult[activity] || 1.375);
  const cal  = Math.round(goal === 'lose' ? tdee * 0.85 : goal === 'gain' ? tdee * 1.1 : tdee);

  const protein = Math.round(w * 1.8);
  const fat     = Math.round((cal * 0.28) / 9);
  const carbs   = Math.round((cal - protein * 4 - fat * 9) / 4);

  const mlPerKg = { sedentary: 30, light: 33, moderate: 36, active: 39, very_active: 42 };
  const water = Math.round(((mlPerKg[activity] || 33) * w + (gender === 'male' ? 300 : 0)) / 50) * 50;

  return { calorieGoal: cal, proteinGoal: protein, fatGoal: fat, carbsGoal: Math.max(carbs, 0), waterGoal: water };
}

export default function OnboardingScreen({ onComplete }) {
  const { updateSettings, addWeight } = useSettings();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [animDir, setAnimDir] = useState('right');
  const [d, setD] = useState({
    name: '', gender: 'male', age: '', height: '', weight: '',
    weightGoal: '', activity: 'moderate', goal: 'maintain',
  });
  const upd = (k, v) => setD(p => ({ ...p, [k]: v }));
  const goals = calcGoals(d);

  const handleFinish = async () => {
    setSaving(true);
    try {
      await updateSettings({
        name: d.name,
        gender: d.gender,
        age: Number(d.age) || 0,
        height: Number(d.height) || 0,
        activityLevel: d.activity,
        initialWeight: Number(d.weight) || 0,
        weightGoal: Number(d.weightGoal) || 0,
        ...(goals || {}),
      });
      if (d.weight) await addWeight({ weight: Number(d.weight) });
    } catch { /* ignore errors, user can fix in settings */ }
    setSaving(false);
    onComplete();
  };

  const STEPS = [
    /* ── Step 0: App intro + name + gender ── */
    <div key="s0" className={styles.stepWrap}>
      <div className={styles.heroIcon}>🍔</div>
      <h1 className={styles.heroTitle}>Food Abuser</h1>
      <p className={styles.heroSub}>Твой персональный трекер питания прямо в Telegram</p>
      <div className={styles.featureList}>
        {[
          ['🔥', 'Считай КБЖУ', 'Записывай еду вручную или через фото с AI-анализом'],
          ['💧', 'Трекер воды',  'Следи за дневной нормой воды с умным расчётом'],
          ['⚖️', 'Контроль веса', 'Отслеживай прогресс от начального до целевого веса'],
          ['📊', 'Аналитика',    'Графики по дням, неделям и сравнение периодов'],
        ].map(([icon, title, desc]) => (
          <div key={title} className={styles.featureItem}>
            <span className={styles.featureIcon}>{icon}</span>
            <div>
              <div className={styles.featureTitle}>{title}</div>
              <div className={styles.featureDesc}>{desc}</div>
            </div>
          </div>
        ))}
      </div>
      <div className={styles.divider} />
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Как тебя зовут? (необязательно)</label>
        <input className={styles.input} type="text" placeholder="Имя" value={d.name}
          onChange={e => upd('name', e.target.value)} />
      </div>
      <div className={styles.genderRow}>
        {[['male','♂ Мужчина'],['female','♀ Женщина']].map(([v, l]) => (
          <button key={v} type="button"
            className={[styles.genderBtn, d.gender === v ? styles.genderActive : ''].join(' ')}
            onClick={() => upd('gender', v)}>{l}</button>
        ))}
      </div>
    </div>,

    /* ── Step 1: Body params ── */
    <div key="s1" className={styles.stepWrap}>
      <h2 className={styles.stepTitle}>Твои параметры</h2>
      <div className={styles.triRow}>
        {[['age','Возраст','лет',10,100],['height','Рост','см',100,250],['weight','Вес','кг',30,300]].map(([k,l,u,mn,mx]) => (
          <div key={k} className={styles.triField}>
            <label className={styles.fieldLabel}>{l}</label>
            <div className={styles.inputWrap}>
              <input className={styles.input} type="number" min={mn} max={mx} placeholder={u}
                value={d[k]} onChange={e => upd(k, e.target.value)} />
              <span className={styles.unit}>{u}</span>
            </div>
          </div>
        ))}
      </div>
      <div className={styles.field} style={{ marginTop: 14 }}>
        <label className={styles.fieldLabel}>Цель по весу (необязательно)</label>
        <div className={styles.inputWrap}>
          <input className={styles.input} type="number" min="30" max="300" placeholder="кг"
            value={d.weightGoal} onChange={e => upd('weightGoal', e.target.value)} />
          <span className={styles.unit}>кг</span>
        </div>
      </div>
      <div className={styles.goalRow}>
        {[['lose','🔻 Похудеть'],['maintain','⚖️ Поддержать'],['gain','🔺 Набрать']].map(([v,l]) => (
          <button key={v} type="button"
            className={[styles.goalBtn, d.goal === v ? styles.goalActive : ''].join(' ')}
            onClick={() => upd('goal', v)}>{l}</button>
        ))}
      </div>
    </div>,

    /* ── Step 2: Activity ── */
    <div key="s2" className={styles.stepWrap}>
      <h2 className={styles.stepTitle}>Уровень активности</h2>
      <div className={styles.activityList}>
        {ACTIVITY.map(({ value, label, hint }) => (
          <button key={value} type="button"
            className={[styles.activityBtn, d.activity === value ? styles.activityActive : ''].join(' ')}
            onClick={() => upd('activity', value)}>
            <span className={styles.activityLabel}>{label}</span>
            <span className={styles.activityHint}>{hint}</span>
          </button>
        ))}
      </div>
    </div>,

    /* ── Step 3: Review ── */
    <div key="s3" className={styles.stepWrap}>
      <h2 className={styles.stepTitle}>Готово! ✨</h2>
      <p className={styles.heroSub}>Вот что я рассчитал для тебя:</p>
      {goals ? (
        <div className={styles.reviewGrid}>
          {[
            ['🔥 Калории',   goals.calorieGoal, 'ккал/день'],
            ['💪 Белки',     goals.proteinGoal, 'г/день'],
            ['🥑 Жиры',      goals.fatGoal,     'г/день'],
            ['🍞 Углеводы',  goals.carbsGoal,   'г/день'],
            ['💧 Вода',      goals.waterGoal,   'мл/день'],
          ].map(([l, v, u]) => (
            <div key={l} className={styles.reviewChip}>
              <span className={styles.reviewLabel}>{l}</span>
              <span className={styles.reviewVal}>{v}</span>
              <span className={styles.reviewUnit}>{u}</span>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
          Введи параметры на шаге 2 для авто-расчёта. Цели можно изменить в Настройках.
        </p>
      )}
    </div>,
  ];

  return (
    <div className={styles.container}>
      {/* Progress dots */}
      <div className={styles.dots}>
        {STEPS.map((_, i) => (
          <div key={i} className={[
            styles.dot,
            i === step ? styles.dotActive : i < step ? styles.dotDone : '',
          ].join(' ')} />
        ))}
      </div>

      {/* Step content */}
      <div className={styles.stepArea}>
        <div key={step} className={[styles.slideAnim, animDir === 'right' ? styles.fromRight : styles.fromLeft].join(' ')}>
          {STEPS[step]}
        </div>
      </div>

      {/* Navigation */}
      <div className={styles.navRow}>
        {step > 0
          ? <button className={styles.backBtn} onClick={() => { setAnimDir('left'); setStep(s => s - 1); }}>← Назад</button>
          : <button className={styles.skipBtn} onClick={onComplete}>Пропустить</button>
        }
        {step < STEPS.length - 1
          ? <button className={styles.nextBtn} onClick={() => { setAnimDir('right'); setStep(s => s + 1); }}>Далее →</button>
          : <button className={styles.finishBtn} onClick={handleFinish} disabled={saving}>
              {saving ? 'Сохраняем...' : 'Начать! 🚀'}
            </button>
        }
      </div>

      {step > 0 && (
        <button className={styles.skipInline} onClick={onComplete}>Пропустить</button>
      )}
    </div>
  );
}
