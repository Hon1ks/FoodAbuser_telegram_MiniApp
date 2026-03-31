import { NavLink } from 'react-router-dom';
import { Home, BookOpen, PlusCircle, BarChart2, Settings } from 'lucide-react';
import styles from './BottomNav.module.css';

const tabs = [
  { to: '/', icon: Home, label: 'Главная' },
  { to: '/diary', icon: BookOpen, label: 'Дневник' },
  { to: '/add', icon: PlusCircle, label: 'Добавить', accent: true },
  { to: '/analytics', icon: BarChart2, label: 'Аналитика' },
  { to: '/settings', icon: Settings, label: 'Настройки' },
];

export default function BottomNav() {
  return (
    <nav className={styles.nav}>
      {tabs.map(({ to, icon: Icon, label, accent }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            [styles.tab, isActive ? styles.active : '', accent ? styles.accent : ''].join(' ')
          }
        >
          <Icon size={accent ? 28 : 22} strokeWidth={accent ? 2.5 : 1.8} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
