import { useState, useEffect, useCallback } from 'react';
import { getAdminStats, resetUserAiLimit } from '../services/api';
import styles from './AdminScreen.module.css';

function fmt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(seconds) {
  if (!seconds || seconds < 60) return '< 1 мин';
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}ч ${rm}м` : `${h}ч`;
}

function StatCard({ label, value, sub }) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statVal}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
      {sub && <span className={styles.statSub}>{sub}</span>}
    </div>
  );
}

export default function AdminScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('users'); // 'users' | 'feedback' | 'opens'
  const [resetting, setResetting] = useState({}); // { [userId]: 'loading' | 'done' }

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await getAdminStats();
      setData(res);
    } catch (e) {
      setError(e.message || 'Ошибка доступа');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleResetLimit = async (userId) => {
    setResetting(p => ({ ...p, [userId]: 'loading' }));
    try {
      await resetUserAiLimit(userId);
      setResetting(p => ({ ...p, [userId]: 'done' }));
      setTimeout(() => setResetting(p => { const n = { ...p }; delete n[userId]; return n; }), 2500);
    } catch {
      setResetting(p => { const n = { ...p }; delete n[userId]; return n; });
    }
  };

  if (loading) {
    return <div className={styles.center}><div className={styles.spinner} /></div>;
  }

  if (error) {
    return (
      <div className={styles.center}>
        <div className={styles.errorWrap}>
          <div className={styles.errorIcon}>⛔</div>
          <p className={styles.errorMsg}>{error.includes('403') || error.includes('401') ? 'Нет доступа' : error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const sortedOpens = Object.entries(data.dailyOpens || {})
    .sort(([a], [b]) => b > a ? 1 : -1)
    .slice(0, 14);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>📊 Admin Panel</h1>
        <button className={styles.refreshBtn} onClick={load} disabled={loading}>
          {loading ? '...' : '↻'}
        </button>
      </div>

      {/* Overview */}
      <div className={styles.statsRow}>
        <StatCard label="Пользователей" value={data.totalUsers} />
        <StatCard label="Открытий сегодня" value={data.opensToday} />
        <StatCard label="За неделю" value={data.opensWeek} />
        <StatCard label="Отзывов" value={data.feedback?.length || 0} />
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {[['users','👥 Пользователи'],['feedback','💬 Отзывы'],['opens','📅 Открытия']].map(([k,l]) => (
          <button key={k} className={[styles.tab, tab === k ? styles.tabActive : ''].join(' ')} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>

      {/* Users */}
      {tab === 'users' && (
        <div className={styles.section}>
          {data.users.length === 0 && <p className={styles.empty}>Нет данных</p>}
          {data.users.map(u => (
            <div key={u.id} className={styles.userCard}>
              <div className={styles.userTop}>
                <span className={styles.userName}>{u.name || u.id}</span>
                {u.username && <span className={styles.userHandle}>@{u.username}</span>}
              </div>
              <div className={styles.userMeta}>
                <span>🔁 {u.opens || 0} открытий</span>
                <span>⏱ {fmtDuration(u.sessionSeconds)}</span>
                <span>✨ {u.aiTotal || 0} AI</span>
              </div>
              <div className={styles.userDates}>
                <span>Первый: {fmt(u.firstSeen)}</span>
                <span>Последний: {fmt(u.lastSeen)}</span>
              </div>
              <button
                className={[
                  styles.resetLimitBtn,
                  resetting[u.id] === 'done' ? styles.resetLimitDone : '',
                ].join(' ')}
                onClick={() => handleResetLimit(u.id)}
                disabled={!!resetting[u.id]}
              >
                {resetting[u.id] === 'loading' ? '...' : resetting[u.id] === 'done' ? '✓ Сброшено' : '🔄 Сбросить лимит AI'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Feedback */}
      {tab === 'feedback' && (
        <div className={styles.section}>
          {data.feedback.length === 0 && <p className={styles.empty}>Отзывов пока нет</p>}
          {data.feedback.map(f => (
            <div key={f.id} className={styles.feedbackItem}>
              <div className={styles.feedbackMeta}>
                <span className={styles.feedbackName}>{f.name}</span>
                {f.username && <span className={styles.feedbackHandle}>@{f.username}</span>}
                <span className={styles.feedbackTime}>{fmt(f.timestamp)}</span>
              </div>
              <p className={styles.feedbackMsg}>{f.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Daily opens */}
      {tab === 'opens' && (
        <div className={styles.section}>
          {sortedOpens.length === 0 && <p className={styles.empty}>Нет данных</p>}
          {sortedOpens.map(([date, count]) => {
            const max = Math.max(...sortedOpens.map(([, c]) => c), 1);
            return (
              <div key={date} className={styles.opensRow}>
                <span className={styles.opensDate}>{date}</span>
                <div className={styles.opensBarWrap}>
                  <div className={styles.opensBar} style={{ width: `${(count / max) * 100}%` }} />
                </div>
                <span className={styles.opensCount}>{count}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
