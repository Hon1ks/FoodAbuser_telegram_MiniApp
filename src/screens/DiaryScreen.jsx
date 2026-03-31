import { useState, useMemo } from 'react';
import { useMeals } from '../context/MealContext';
import { useFavorites } from '../hooks/useFavorites';
import styles from './DiaryScreen.module.css';

const CATEGORY_LABELS = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
  other: 'Прочее',
};

function toLocalDate(date) {
  return date.toLocaleDateString('sv-SE'); // yyyy-mm-dd
}

function buildCalendarDays(year, month) {
  const first = new Date(year, month, 1).getDay(); // 0=Sun
  const startDow = (first === 0 ? 6 : first - 1); // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

export default function DiaryScreen() {
  const { meals, deleteMeal, loading } = useMeals();
  const { addFavorite } = useFavorites();
  const [selected, setSelected] = useState(() => toLocalDate(new Date()));
  const [starredId, setStarredId] = useState(null); // brief confirmation

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const calDays = useMemo(() => buildCalendarDays(viewYear, viewMonth), [viewYear, viewMonth]);

  // Dates that have meals
  const datesWithMeals = useMemo(() => new Set(meals.map((m) => m.date)), [meals]);

  const selectedMeals = useMemo(
    () => meals.filter((m) => m.date === selected),
    [meals, selected]
  );

  const selectedStats = useMemo(
    () => selectedMeals.reduce((a, m) => ({
      calories: a.calories + (Number(m.calories) || 0),
      protein: a.protein + (Number(m.protein) || 0),
      fat: a.fat + (Number(m.fat) || 0),
      carbs: a.carbs + (Number(m.carbs) || 0),
    }), { calories: 0, protein: 0, fat: 0, carbs: 0 }),
    [selectedMeals]
  );

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  const today = toLocalDate(new Date());

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Дневник питания</h1>

      {/* Calendar */}
      <div className={styles.calendar}>
        <div className={styles.calHeader}>
          <button className={styles.navBtn} onClick={prevMonth}>‹</button>
          <span className={styles.monthLabel}>{monthLabel}</span>
          <button className={styles.navBtn} onClick={nextMonth}>›</button>
        </div>
        <div className={styles.weekDays}>
          {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => (
            <span key={d} className={styles.weekDay}>{d}</span>
          ))}
        </div>
        <div className={styles.daysGrid}>
          {calDays.map((day, i) => {
            if (!day) return <div key={`e-${i}`} />;
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const isSelected = dateStr === selected;
            const isToday = dateStr === today;
            const hasMeals = datesWithMeals.has(dateStr);
            return (
              <button
                key={dateStr}
                className={[
                  styles.dayBtn,
                  isSelected ? styles.daySelected : '',
                  isToday && !isSelected ? styles.dayToday : '',
                ].join(' ')}
                onClick={() => setSelected(dateStr)}
              >
                {day}
                {hasMeals && <span className={styles.dot} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected date summary */}
      {selectedMeals.length > 0 && (
        <div className={styles.statsRow}>
          <div className={styles.statChip}><span className={styles.statVal}>{Math.round(selectedStats.calories)}</span><span className={styles.statLabel}>ккал</span></div>
          <div className={styles.statChip}><span className={styles.statVal}>{Math.round(selectedStats.protein)}г</span><span className={styles.statLabel}>белки</span></div>
          <div className={styles.statChip}><span className={styles.statVal}>{Math.round(selectedStats.fat)}г</span><span className={styles.statLabel}>жиры</span></div>
          <div className={styles.statChip}><span className={styles.statVal}>{Math.round(selectedStats.carbs)}г</span><span className={styles.statLabel}>углеводы</span></div>
        </div>
      )}

      <h2 className={styles.sectionTitle}>
        {new Date(selected + 'T12:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
      </h2>

      {loading && <p className={styles.empty}>Загрузка...</p>}
      {!loading && selectedMeals.length === 0 && (
        <p className={styles.empty}>Нет записей за этот день</p>
      )}
      {selectedMeals.map((meal) => (
        <div key={meal.id} className={styles.mealCard}>
          <div className={styles.mealLeft}>
            <span className={styles.mealName}>{meal.name}</span>
            <span className={styles.mealMeta}>
              {CATEGORY_LABELS[meal.category] || meal.category}
              {meal.weight > 0 && ` · ${meal.weight}г`}
            </span>
            <span className={styles.mealMacros}>
              Б:{Math.round(meal.protein)} Ж:{Math.round(meal.fat)} У:{Math.round(meal.carbs)}
            </span>
          </div>
          <div className={styles.mealRight}>
            <span className={styles.mealCal}>{Math.round(meal.calories)} ккал</span>
            <div className={styles.mealActions}>
              <button
                className={[styles.starBtn, starredId === meal.id ? styles.starActive : ''].join(' ')}
                onClick={() => {
                  addFavorite(meal);
                  setStarredId(meal.id);
                  setTimeout(() => setStarredId(null), 1500);
                }}
              >
                {starredId === meal.id ? '★' : '☆'} Изб.
              </button>
              <button className={styles.deleteBtn} onClick={() => deleteMeal(meal.id)}>
                ✕ Удал.
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
