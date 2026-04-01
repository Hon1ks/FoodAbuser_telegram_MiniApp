import { useEffect, useRef } from 'react';
import { useAchievements } from '../context/AchievementsContext';
import styles from './AchievementToast.module.css';

export default function AchievementToast() {
  const { activeToast, dismissToast } = useAchievements();
  const timerRef = useRef(null);

  useEffect(() => {
    if (!activeToast) return;
    timerRef.current = setTimeout(dismissToast, 3500);
    return () => clearTimeout(timerRef.current);
  }, [activeToast, dismissToast]);

  if (!activeToast) return null;

  return (
    <div className={styles.toast} onClick={dismissToast}>
      <div className={styles.shine} />
      <div className={styles.iconWrap}>
        <span className={styles.icon}>{activeToast.icon}</span>
      </div>
      <div className={styles.body}>
        <span className={styles.label}>✨ Достижение получено!</span>
        <span className={styles.title}>{activeToast.title}</span>
        {activeToast.phrase && <span className={styles.phrase}>«{activeToast.phrase}»</span>}
      </div>
    </div>
  );
}
