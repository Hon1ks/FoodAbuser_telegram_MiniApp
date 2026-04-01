import { useNavigate } from 'react-router-dom';
import { useAchievements, computeWaterStreak, computeBreakfastStreak, computeCalorieGoalStats } from '../context/AchievementsContext';
import { ACHIEVEMENTS } from '../achievements/definitions';
import { useMeals } from '../context/MealContext';
import { useSettings } from '../context/SettingsContext';
import styles from './AchievementsScreen.module.css';

const CATEGORY_LABELS = {
  meal_count:   '🍽️ Приёмы пищи',
  calorie_goal: '🎯 Цели по калориям',
  water:        '💧 Вода',
  breakfast:    '🌅 Завтрак',
};

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Compute progress percentage and label for any achievement type */
function getProgressData(achievement, ctx) {
  const { totalMeals, waterGoal, waterStreak, breakfastStreak, calHitDays, calStreak } = ctx;

  if (achievement.type === 'meal_count') {
    const cur = Math.min(totalMeals, achievement.threshold);
    return {
      pct: Math.min((totalMeals / achievement.threshold) * 100, 100),
      label: `${cur} / ${achievement.threshold} приёмов`,
    };
  }

  if (achievement.type === 'calorie_goal') {
    if (achievement.key === 'calorie_1') {
      return {
        pct: calHitDays >= 1 ? 100 : 0,
        label: `${Math.min(calHitDays, 1)} / 1 раз`,
      };
    }
    if (achievement.key === 'calorie_7') {
      return {
        pct: Math.min((calStreak / 7) * 100, 100),
        label: `${calStreak} / 7 дней подряд`,
      };
    }
    if (achievement.key === 'calorie_30') {
      return {
        pct: Math.min((calHitDays / 30) * 100, 100),
        label: `${calHitDays} / 30 дней`,
      };
    }
  }

  if (achievement.type === 'water') {
    if (achievement.key === 'water_mage') {
      return {
        pct: Math.min((waterStreak / achievement.threshold) * 100, 100),
        label: `${waterStreak} / ${achievement.threshold} дней подряд`,
      };
    }
    if (achievement.key === 'water_poseidon') {
      return { pct: 0, label: 'Выпейте 200% нормы за день' };
    }
  }

  if (achievement.type === 'breakfast') {
    return {
      pct: Math.min((breakfastStreak / achievement.threshold) * 100, 100),
      label: `${breakfastStreak} / ${achievement.threshold} дней подряд`,
    };
  }

  return { pct: 0, label: '' };
}

function AchievementCard({ achievement, unlockedData, progressCtx }) {
  const isUnlocked = !!unlockedData;
  const { pct, label } = isUnlocked ? { pct: 100, label: '' } : getProgressData(achievement, progressCtx);

  return (
    <div className={[styles.card, isUnlocked ? styles.cardUnlocked : styles.cardLocked].join(' ')}>
      {isUnlocked && <div className={styles.cardGlow} />}
      <div className={[styles.iconWrap, isUnlocked ? styles.iconWrapUnlocked : ''].join(' ')}>
        <span className={styles.icon}>{isUnlocked ? achievement.icon : '🔒'}</span>
      </div>
      <div className={styles.cardBody}>
        <span className={[styles.cardTitle, isUnlocked ? styles.cardTitleUnlocked : ''].join(' ')}>
          {achievement.title}
        </span>
        <span className={styles.cardDesc}>{achievement.desc}</span>
        {isUnlocked ? (
          <>
            {achievement.phrase && (
              <span className={styles.cardPhrase}>«{achievement.phrase}»</span>
            )}
            <span className={styles.cardDate}>✓ {fmtDate(unlockedData.unlockedAt)}</span>
          </>
        ) : (
          <>
            <div className={styles.cardProgressBar}>
              <div className={styles.cardProgressFill} style={{ width: `${pct}%` }} />
            </div>
            {label && <span className={styles.cardProgressLabel}>{label}</span>}
          </>
        )}
      </div>
    </div>
  );
}

export default function AchievementsScreen() {
  const navigate = useNavigate();
  const { unlocked } = useAchievements();
  const { meals } = useMeals();
  const { settings } = useSettings();

  const totalMeals = meals.length;
  const waterGoal = settings.waterGoal || 2000;

  // Compute progress context once (read localStorage here, not in each card)
  const waterStreak = computeWaterStreak(waterGoal);
  const breakfastStreak = computeBreakfastStreak();
  const { hitDays: calHitDays, streak: calStreak } = computeCalorieGoalStats(meals, settings.calorieGoal);

  const progressCtx = { totalMeals, waterGoal, waterStreak, breakfastStreak, calHitDays, calStreak };

  const unlockedCount = ACHIEVEMENTS.filter(a => unlocked[a.key]).length;
  const totalCount = ACHIEVEMENTS.length;
  const overallPct = Math.round((unlockedCount / totalCount) * 100);

  // Group by type preserving definition order
  const categories = [...new Set(ACHIEVEMENTS.map(a => a.type))];

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>← Назад</button>
        <h1 className={styles.title}>Достижения</h1>
      </div>

      {/* Summary */}
      <div className={styles.summary}>
        <div className={styles.summaryTop}>
          <span className={styles.summaryText}>
            <span className={styles.summaryCount}>{unlockedCount}</span>
            <span className={styles.summaryTotal}> / {totalCount}</span>
          </span>
          <span className={styles.summaryPct}>{overallPct}%</span>
        </div>
        <div className={styles.summaryBar}>
          <div className={styles.summaryBarFill} style={{ width: `${overallPct}%` }} />
        </div>
        <span className={styles.summaryLabel}>ачивок получено</span>
      </div>

      {/* Categories */}
      {categories.map(cat => {
        const catAchievements = ACHIEVEMENTS.filter(a => a.type === cat);
        const catUnlocked = catAchievements.filter(a => unlocked[a.key]).length;
        return (
          <div key={cat} className={styles.category}>
            <div className={styles.categoryHeader}>
              <span className={styles.categoryLabel}>{CATEGORY_LABELS[cat] ?? cat}</span>
              <span className={styles.categoryCount}>{catUnlocked}/{catAchievements.length}</span>
            </div>
            <div className={styles.grid}>
              {catAchievements.map(a => (
                <AchievementCard
                  key={a.key}
                  achievement={a}
                  unlockedData={unlocked[a.key] ?? null}
                  progressCtx={progressCtx}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
