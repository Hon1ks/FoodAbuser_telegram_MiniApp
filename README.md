# 🍔 Food Abuser — Telegram Mini App

Трекер питания внутри Telegram. Дневник еды, подсчёт КБЖУ, трекеры воды и веса, AI-анализ блюд по фото или тексту — всё прямо в мессенджере.

---

## 🧱 Стек

### Frontend
| Технология | Роль |
|---|---|
| React 19 | UI-фреймворк |
| Vite 8 | Сборщик |
| React Router DOM v7 | Навигация (SPA) |
| Recharts | Графики аналитики |
| CSS Modules | Изолированные стили |
| Cloudflare Pages | Хостинг |

### Backend — 2 Cloudflare Workers
| Worker | Роль |
|---|---|
| `food-abuser-api` | Основной API: данные пользователей, аналитика, фидбек, вебхук бота |
| `vlm-foodabuser-tg-miniapp` | VLM-сервис: анализ еды через Gemini 2.5 Flash |

### Хранилище
| KV Namespace | Содержимое |
|---|---|
| `FOOD_ABUSER_DB` | Приёмы пищи, настройки, вес, вода, аналитика, фидбек |
| `AI_USAGE` | Серверный rate-limit AI запросов (10/день на пользователя) |

### Авторизация
Telegram WebApp `initData` — HMAC-SHA256 валидация на сервере. Никаких паролей.

---

## 🗂 Структура проекта

```
food-abuser-tma/          ← React фронтенд (Cloudflare Pages)
├── src/
│   ├── context/
│   │   ├── MealContext.jsx        # CRUD приёмов пищи
│   │   └── SettingsContext.jsx    # Настройки, вес, вода, темы
│   ├── hooks/
│   │   └── useFavorites.js        # Избранные блюда (localStorage)
│   ├── screens/
│   │   ├── HomeScreen.jsx         # Главная — сводка дня
│   │   ├── AddMealScreen.jsx      # Добавление еды + AI-анализ
│   │   ├── DiaryScreen.jsx        # Дневник по датам
│   │   ├── AnalyticsScreen.jsx    # Графики и статистика
│   │   ├── SettingsScreen.jsx     # Профиль, цели, темы, фидбек
│   │   ├── AchievementsScreen.jsx # Достижения
│   │   ├── AdminScreen.jsx        # Панель администратора
│   │   └── OnboardingScreen.jsx   # Онбординг при первом запуске
│   ├── services/
│   │   └── api.js                 # Все запросы к Workers
│   └── App.jsx                    # Роутинг + аналитика открытий

food-abuser-api/          ← Cloudflare Worker (основной API)
└── worker.js

vlm-foodabuser-tg-miniapp/ ← Cloudflare Worker (AI анализ)
└── worker.js
```

---

## ✨ Функциональность

### Экраны
- **Главная** — кольцевой прогресс КБЖУ, трекер воды, виджет веса (Ring Dial с анимацией)
- **Добавить** — ручной ввод или AI-анализ фото/текста, пред-загрузка подсказки к фото
- **Дневник** — календарь с навигацией, сводка дня, избранные блюда
- **Аналитика** — графики калорий и макронутриентов за неделю / месяц / всё время
- **Настройки** — профиль Telegram, цели КБЖУ, калькулятор TDEE, история веса, темы, фидбек, экспорт CSV
- **Достижения** — геймификация: стрики, рекорды, ранние завтраки и т.д.
- **Онбординг** — приветствие и базовая настройка при первом запуске

### AI-анализ блюд
- Фото → Gemini 2.5 Flash → КБЖУ + список ингредиентов
- Текстовое описание → КБЖУ
- Опциональная подсказка перед отправкой фото (улучшает точность)
- Анимированный прогресс-бар во время анализа (0 → 95% с easing)
- Rate-limit: **10 запросов в день на пользователя** (серверная проверка по Telegram ID, нельзя обойти сменой времени)
- Retry при 429 от Gemini (3 попытки с паузой)

### Темы оформления
| Тема | Акценты |
|---|---|
| Тёмная (по умолчанию) | Зелёный + фиолетовый |
| Золото | Жёлтый + оранжевый |
| Океан | Голубой + синий |
| Неон | Фиолетовый + розовый |
| Кибер | Neon-зелёный + голубой (ультра-тёмный фон) |
| Кримсон | Красный + оранжевый |

### Аналитика и админка
- Трекинг открытий, сессий (heartbeat 60с), AI-использований — по Telegram ID
- Фидбек-форма в настройках
- Панель администратора (`/admin`) — только через Telegram ID администратора:
  - Таблица пользователей: открытия, время в приложении, AI-запросы
  - Отзывы пользователей
  - График открытий за 14 дней

### Telegram-бот
- `/start` — кнопка запуска приложения
- `/admin` — кнопка открытия админ-панели (только для администратора)

---

## 🚀 Быстрый старт

```bash
git clone https://github.com/Hon1ks/FoodAbuser_telegram_MiniApp.git
cd FoodAbuser_telegram_MiniApp
npm install
npm run dev
```

Открой **http://localhost:5173** — приложение работает в браузере (данные Telegram пустые, но весь UI доступен).

---

## 🛠 Команды

| Команда | Описание |
|---|---|
| `npm run dev` | Dev-сервер на localhost:5173 |
| `npm run build` | Сборка в `dist/` |
| `npm run preview` | Предпросмотр сборки |
| `npm run lint` | ESLint |
| `npm run deploy` | Сборка + деплой на Cloudflare Pages |

---

## ⚙️ Переменные окружения

### `food-abuser-api` Worker
| Переменная | Описание |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Токен бота (авторизация + вебхук) |
| `ADMIN_TELEGRAM_ID` | Telegram ID администратора |
| `APP_URL` | URL фронтенда (для кнопок бота) |
| `ADMIN_SECRET` | Опционально: отдельный секрет для `/admin` |

### `vlm-foodabuser-tg-miniapp` Worker
| Переменная | Описание |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio API ключ |
| `TELEGRAM_BOT_TOKEN` | Для валидации initData |

---

## 🌐 Деплой

```bash
# Фронтенд
npm run build
npx wrangler pages deploy dist --project-name=food-abuser-tma

# API Worker
cd food-abuser-api && npx wrangler deploy

# VLM Worker
cd vlm-foodabuser-tg-miniapp && npx wrangler deploy
```

Зарегистрировать вебхук бота:
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://food-abuser-api.<account>.workers.dev/webhook
```
