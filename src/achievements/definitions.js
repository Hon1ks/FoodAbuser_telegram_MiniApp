// Achievement definitions — add more here as the system grows
export const ACHIEVEMENTS = [
  // ── Приёмы пищи ────────────────────────────────────────────────────────
  {
    key: 'meal_count_5',
    type: 'meal_count',
    threshold: 5,
    title: 'Новичок',
    icon: '🌱',
    desc: 'Добавлено 5 приёмов пищи',
    phrase: 'Первые шаги сделаны. Путь начинается здесь.',
  },
  {
    key: 'meal_count_10',
    type: 'meal_count',
    threshold: 10,
    title: 'Следопыт',
    icon: '🔍',
    desc: 'Добавлено 10 приёмов пищи',
    phrase: 'Ты уже знаешь дорогу. Теперь не сворачивай.',
  },
  {
    key: 'meal_count_15',
    type: 'meal_count',
    threshold: 15,
    title: 'Наблюдатель',
    icon: '👁️',
    desc: 'Добавлено 15 приёмов пищи',
    phrase: 'Видишь паттерны там, где другие видят просто еду.',
  },
  {
    key: 'meal_count_20',
    type: 'meal_count',
    threshold: 20,
    title: 'Аналитик',
    icon: '📊',
    desc: 'Добавлено 20 приёмов пищи',
    phrase: 'Данные — это сила. Ты уже на полпути к мастерству.',
  },
  {
    key: 'meal_count_25',
    type: 'meal_count',
    threshold: 25,
    title: 'Охотник за едой',
    icon: '🏹',
    desc: 'Добавлено 25 приёмов пищи',
    phrase: 'Ни один приём пищи не ускользнёт от твоего внимания.',
  },

  // ── Цели по калориям ───────────────────────────────────────────────────
  {
    key: 'calorie_1',
    type: 'calorie_goal',
    threshold: 1,
    title: 'В цель',
    icon: '🎯',
    desc: 'Калории в норме ±5% (1 раз)',
    phrase: 'Первое попадание. Теперь ты знаешь, каково это.',
  },
  {
    key: 'calorie_7',
    type: 'calorie_goal',
    threshold: 7,
    title: 'Снайпер',
    icon: '🎯',
    desc: 'Калории в норме ±5% (7 дней подряд)',
    phrase: 'Семь дней точности. Случайность? Навряд ли.',
  },
  {
    key: 'calorie_30',
    type: 'calorie_goal',
    threshold: 30,
    title: 'Киборг',
    icon: '🤖',
    desc: 'Калории в норме ±5% (30 дней)',
    phrase: 'Ты работаешь как машина. Это уже не дисциплина — это ты.',
  },

  // ── Вода ───────────────────────────────────────────────────────────────
  {
    key: 'water_mage',
    type: 'water',
    threshold: 10,
    title: 'Маг воды',
    icon: '💧',
    desc: 'Норма воды 10 дней подряд',
    phrase: 'Вода слушается тебя. Ты управляешь потоком.',
  },
  {
    key: 'water_poseidon',
    type: 'water',
    threshold: 200,
    title: 'Посейдон',
    icon: '🌊',
    desc: 'Выпито 200% нормы воды за день',
    phrase: 'Ты — повелитель морей. Волны склоняются перед тобой.',
  },

  // ── Завтрак ────────────────────────────────────────────────────────────
  {
    key: 'breakfast_early',
    type: 'breakfast',
    threshold: 7,
    title: 'Ранняя пташка',
    icon: '🌅',
    desc: 'Завтрак до 9:00 — семь дней подряд',
    phrase: 'Рассвет — твой союзник. Пока все спят, ты уже побеждаешь.',
  },
];
