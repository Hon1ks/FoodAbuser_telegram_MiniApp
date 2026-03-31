# 🍔 FoodAbuser — Telegram Mini App

Трекер питания в виде Telegram Mini App. Позволяет вести дневник еды, считать КБЖУ, отслеживать вес и воду прямо внутри Telegram.

**Стек:** React 19 · Vite 8 · React Router DOM v7 · Recharts · Cloudflare Pages
**API:** Cloudflare Worker (отдельный репозиторий)

---

## 🚀 Быстрый старт после клонирования

### 1. Клонируй репозиторий

```bash
git clone https://github.com/goorbunoov22/FoodAbuser_telegram_MiniApp.git
cd FoodAbuser_telegram_MiniApp
```

### 2. Установи зависимости

```bash
npm install
```

### 3. Запусти сервер разработки

```bash
npm run dev
```

Открой браузер по адресу: **http://localhost:5173**

> Приложение работает и в обычном браузере — данные о Telegram-пользователе будут пустыми, но весь UI и функционал доступны для проверки.

---

## 📂 Структура проекта

```
src/
├── context/
│   ├── MealContext.jsx       # Приёмы пищи (CRUD)
│   └── SettingsContext.jsx   # Настройки, вес, вода
├── hooks/
│   └── useFavorites.js       # Избранные блюда (localStorage)
├── screens/
│   ├── HomeScreen.jsx        # Главная — сводка дня
│   ├── AddMealScreen.jsx     # Добавление еды + AI-анализ фото
│   ├── DiaryScreen.jsx       # Дневник по датам
│   ├── AnalyticsScreen.jsx   # Графики и статистика
│   └── SettingsScreen.jsx    # Профиль, цели, вес, TDEE
├── services/
│   └── api.js                # Запросы к Cloudflare Worker API
└── App.jsx                   # Роутинг
```

---

## ⚙️ Конфигурация API

Приложение обращается к Cloudflare Worker API. В режиме разработки запросы к `/api/*` проксируются через Vite на:

```
https://food-abuser-api.goorbunoov22.workers.dev
```

Настройка прокси — в `vite.config.js`. Если хочешь использовать свой API — замени URL там и в `src/services/api.js`.

---

## 🛠️ Доступные команды

| Команда           | Описание                                        |
|-------------------|-------------------------------------------------|
| `npm run dev`     | Запуск dev-сервера на localhost:5173            |
| `npm run build`   | Сборка продакшн-версии в папку `dist/`          |
| `npm run preview` | Предпросмотр собранной версии                   |
| `npm run lint`    | Проверка кода через ESLint                      |
| `npm run deploy`  | Сборка + деплой на Cloudflare Pages             |

---

## 🌐 Деплой на Cloudflare Pages

1. Установи [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
2. Авторизуйся: `wrangler login`
3. Задеплой: `npm run deploy`

Настройки деплоя — в `wrangler.toml`.

---

## ✨ Функциональность

- **Главная** — кольцевой прогресс КБЖУ на день, трекер воды с анимацией, трекер веса (Ring Dial)
- **Добавить** — ручной ввод или AI-анализ фотографии блюда (VLM Worker)
- **Дневник** — календарь с навигацией по месяцам, статистика дня, избранное
- **Аналитика** — графики калорий и макронутриентов за неделю/месяц/всё время
- **Настройки** — профиль Telegram, цели КБЖУ, калькулятор TDEE, история веса
