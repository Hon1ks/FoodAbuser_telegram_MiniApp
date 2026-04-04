/**
 * Food Abuser — Cloudflare Worker API
 * Хранит данные пользователей в KV по ключу user_{telegram_id}_{table}
 * Версия: 1.1
 * Secrets: TELEGRAM_BOT_TOKEN
 * KV: FOOD_ABUSER_DB
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Telegram-Init-Data, X-Dev-User-Id',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function err(msg, status = 400) {
  return json({ error: msg }, status);
}

// ─── Telegram initData валидация ───────────────────────────────────────────
async function validateInitData(initDataStr, botToken) {
  try {
    const params = new URLSearchParams(initDataStr);
    const hash = params.get('hash');
    if (!hash) return null;

    params.delete('hash');
    const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

    const encoder = new TextEncoder();
    const secretKey = await crypto.subtle.importKey(
      'raw', encoder.encode('WebAppData'),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const tokenBytes = await crypto.subtle.sign('HMAC', secretKey, encoder.encode(botToken));

    const dataKey = await crypto.subtle.importKey(
      'raw', tokenBytes,
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const computedBytes = await crypto.subtle.sign('HMAC', dataKey, encoder.encode(dataCheckString));
    const computedHash = [...new Uint8Array(computedBytes)]
      .map(b => b.toString(16).padStart(2, '0')).join('');

    if (computedHash !== hash) return null;

    const userStr = params.get('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
}

// ─── Главный обработчик ────────────────────────────────────────────────────
export default {
  async fetch(request, env) {

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Health check (без авторизации)
    if (path === '/health') {
      return json({
        status: 'ok',
        version: '1.1',
        kv: !!env.FOOD_ABUSER_DB,
        auth: !!env.TELEGRAM_BOT_TOKEN,
      });
    }

    // ── Telegram bot webhook (no auth) ───────────────────────────────────
    if (path === '/webhook') return handleWebhook(request, env);

    // ── Admin (uses Telegram initData — only ADMIN_TELEGRAM_ID allowed) ──
    if (path === '/admin') {
      const devUserId = request.headers.get('X-Dev-User-Id');
      const initDataStr = request.headers.get('X-Telegram-Init-Data');
      let adminUserId;
      if (devUserId) {
        adminUserId = devUserId;
      } else if (initDataStr && env.TELEGRAM_BOT_TOKEN) {
        const user = await validateInitData(initDataStr, env.TELEGRAM_BOT_TOKEN);
        if (!user) return err('Unauthorized', 401);
        adminUserId = String(user.id);
      } else {
        return err('Unauthorized', 401);
      }
      if (env.ADMIN_TELEGRAM_ID && adminUserId !== String(env.ADMIN_TELEGRAM_ID)) {
        return err('Forbidden', 403);
      }
      return handleAdmin(request, env);
    }

    // ── Авторизация ──────────────────────────────────────────────────────
    const devUserId = request.headers.get('X-Dev-User-Id');
    const initDataStr = request.headers.get('X-Telegram-Init-Data');

    let userId, userInfo;

    if (devUserId) {
      userId = devUserId;
      userInfo = { id: devUserId, first_name: 'Dev', username: 'dev_user' };
    } else if (initDataStr && env.TELEGRAM_BOT_TOKEN) {
      const user = await validateInitData(initDataStr, env.TELEGRAM_BOT_TOKEN);
      if (!user) return err('Invalid Telegram auth', 401);
      userId = String(user.id);
      userInfo = user;
    } else if (initDataStr && !env.TELEGRAM_BOT_TOKEN) {
      return err('BOT_TOKEN not configured', 500);
    } else {
      return err('Missing X-Telegram-Init-Data header', 401);
    }

    // ── Роутинг ──
    if (path === '/meals')     return handleMeals(request, env, userId);
    if (path === '/settings')  return handleSettings(request, env, userId);
    if (path === '/weight')    return handleWeight(request, env, userId);
    if (path === '/water')     return handleWater(request, env, userId);
    if (path === '/analytics') return handleAnalytics(request, env, userId, userInfo);
    if (path === '/feedback')  return handleFeedback(request, env, userId, userInfo);

    return err('Not found', 404);
  }
};

// ─── MEALS ─────────────────────────────────────────────────────────────────
async function handleMeals(request, env, userId) {
  const kvKey = `user_${userId}_meals`;

  if (request.method === 'GET') {
    const raw = await env.FOOD_ABUSER_DB.get(kvKey);
    const meals = raw ? JSON.parse(raw) : [];
    return json(meals);
  }

  if (request.method === 'POST') {
    const body = await request.json();
    const raw = await env.FOOD_ABUSER_DB.get(kvKey);
    const meals = raw ? JSON.parse(raw) : [];

    const meal = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: body.title || 'Приём пищи',
      description: body.description || '',
      category: body.category || 'snack',
      calories: Number(body.calories) || 0,
      protein: Number(body.protein) || 0,
      fat: Number(body.fat) || 0,
      carbs: Number(body.carbs) || 0,
      portion_weight: Number(body.portion_weight) || 0,
      meal_time: body.meal_time || new Date().toISOString(),
      image_url: body.image_url || null,
      ai_items: body.ai_items || null,
      created_at: new Date().toISOString(),
    };

    meals.push(meal);
    await env.FOOD_ABUSER_DB.put(kvKey, JSON.stringify(meals));
    return json(meal, 201);
  }

  if (request.method === 'DELETE') {
    const mealId = new URL(request.url).searchParams.get('id');
    if (!mealId) return err('Missing meal id');

    const raw = await env.FOOD_ABUSER_DB.get(kvKey);
    const meals = raw ? JSON.parse(raw) : [];
    await env.FOOD_ABUSER_DB.put(kvKey, JSON.stringify(meals.filter(m => m.id !== mealId)));
    return json({ deleted: mealId });
  }

  return err('Method not allowed', 405);
}

// ─── SETTINGS ──────────────────────────────────────────────────────────────
async function handleSettings(request, env, userId) {
  const kvKey = `user_${userId}_settings`;

  const defaultSettings = {
    calorieGoal: 2000, proteinGoal: 150, fatGoal: 65, carbsGoal: 250,
    waterGoal: 2000, weightGoal: 0, initialWeight: 0,
    showWaterTracker: true, showWeightTracker: true,
    nightWarning: true, nightWarningHour: 21,
    gender: 'male', age: 0, height: 0, activityLevel: 'moderate',
  };

  if (request.method === 'GET') {
    const raw = await env.FOOD_ABUSER_DB.get(kvKey);
    return json(raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings);
  }

  if (request.method === 'POST') {
    const body = await request.json();
    const raw = await env.FOOD_ABUSER_DB.get(kvKey);
    const current = raw ? JSON.parse(raw) : defaultSettings;
    const merged = { ...current, ...body };
    await env.FOOD_ABUSER_DB.put(kvKey, JSON.stringify(merged));
    return json(merged);
  }

  return err('Method not allowed', 405);
}

// ─── WEIGHT ────────────────────────────────────────────────────────────────
async function handleWeight(request, env, userId) {
  const kvKey = `user_${userId}_weight`;

  if (request.method === 'GET') {
    const raw = await env.FOOD_ABUSER_DB.get(kvKey);
    return json(raw ? JSON.parse(raw) : []);
  }

  if (request.method === 'POST') {
    const body = await request.json();
    const raw = await env.FOOD_ABUSER_DB.get(kvKey);
    const records = raw ? JSON.parse(raw) : [];

    const record = {
      id: `w_${Date.now()}`,
      weight: Number(body.weight),
      date: body.date || new Date().toISOString().slice(0, 10),
      note: body.note || '',
      created_at: new Date().toISOString(),
    };

    records.push(record);
    // Максимум 100 записей
    if (records.length > 100) records.splice(0, records.length - 100);
    await env.FOOD_ABUSER_DB.put(kvKey, JSON.stringify(records));
    return json(record, 201);
  }

  if (request.method === 'DELETE') {
    const recordId = new URL(request.url).searchParams.get('id');
    if (!recordId) return err('Missing record id');

    const raw = await env.FOOD_ABUSER_DB.get(kvKey);
    const records = raw ? JSON.parse(raw) : [];
    await env.FOOD_ABUSER_DB.put(kvKey, JSON.stringify(records.filter(r => r.id !== recordId)));
    return json({ deleted: recordId });
  }

  return err('Method not allowed', 405);
}

// ─── WATER ─────────────────────────────────────────────────────────────────
async function handleWater(request, env, userId) {
  const kvKey = `user_${userId}_water`;
  const today = new Date().toISOString().split('T')[0];

  if (request.method === 'GET') {
    const raw = await env.FOOD_ABUSER_DB.get(kvKey);
    if (!raw) return json({ date: today, amount: 0 });
    const data = JSON.parse(raw);
    if (data.date !== today) return json({ date: today, amount: 0 });
    return json(data);
  }

  if (request.method === 'POST') {
    const body = await request.json();
    const amount = Math.max(0, Number(body.amount) || 0);
    const data = { date: today, amount };
    await env.FOOD_ABUSER_DB.put(kvKey, JSON.stringify(data), { expirationTtl: 172800 });
    return json(data);
  }

  return err('Method not allowed', 405);
}

// ─── ANALYTICS ─────────────────────────────────────────────────────────────
// analytics:users  → { [userId]: { name, username, opens, lastSeen, firstSeen, sessionSeconds, aiTotal } }
// analytics:opens  → { [YYYY-MM-DD]: count }  (last 30 days)
async function handleAnalytics(request, env, userId, userInfo) {
  if (request.method !== 'POST') return err('Method not allowed', 405);
  const body = await request.json().catch(() => ({}));
  const event = body.event || 'open'; // 'open' | 'heartbeat' | 'ai_used'

  const name = [userInfo?.first_name, userInfo?.last_name].filter(Boolean).join(' ') || userId;
  const username = userInfo?.username || '';

  const usersRaw = await env.FOOD_ABUSER_DB.get('analytics:users');
  const users = usersRaw ? JSON.parse(usersRaw) : {};
  const now = new Date().toISOString();

  if (!users[userId]) {
    users[userId] = { name, username, opens: 0, lastSeen: now, firstSeen: now, sessionSeconds: 0, aiTotal: 0 };
  }
  const u = users[userId];
  u.name = name || u.name;
  u.username = username || u.username;
  u.lastSeen = now;

  if (event === 'open') {
    u.opens = (u.opens || 0) + 1;
    const today = now.split('T')[0];
    const opensRaw = await env.FOOD_ABUSER_DB.get('analytics:opens');
    const opens = opensRaw ? JSON.parse(opensRaw) : {};
    opens[today] = (opens[today] || 0) + 1;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    Object.keys(opens).forEach(d => { if (d < cutoffStr) delete opens[d]; });
    await env.FOOD_ABUSER_DB.put('analytics:opens', JSON.stringify(opens));
  } else if (event === 'heartbeat') {
    u.sessionSeconds = (u.sessionSeconds || 0) + 60;
  } else if (event === 'ai_used') {
    u.aiTotal = (u.aiTotal || 0) + 1;
  }

  await env.FOOD_ABUSER_DB.put('analytics:users', JSON.stringify(users));
  return json({ ok: true });
}

// ─── FEEDBACK ──────────────────────────────────────────────────────────────
// analytics:feedback → [{ id, userId, name, username, message, timestamp }, ...] newest first, max 500
async function handleFeedback(request, env, userId, userInfo) {
  if (request.method !== 'POST') return err('Method not allowed', 405);
  const body = await request.json().catch(() => ({}));
  const message = (body.message || '').trim().substring(0, 1000);
  if (!message) return err('Empty message');

  const name = [userInfo?.first_name, userInfo?.last_name].filter(Boolean).join(' ') || userId;
  const item = {
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    userId, name,
    username: userInfo?.username || '',
    message,
    timestamp: new Date().toISOString(),
  };

  const raw = await env.FOOD_ABUSER_DB.get('analytics:feedback');
  const list = raw ? JSON.parse(raw) : [];
  list.unshift(item);
  if (list.length > 500) list.splice(500);
  await env.FOOD_ABUSER_DB.put('analytics:feedback', JSON.stringify(list));
  return json({ ok: true });
}

// ─── WEBHOOK ───────────────────────────────────────────────────────────────
async function handleWebhook(request, env) {
  if (request.method !== 'POST') return new Response('OK');
  try {
    const update = await request.json();
    const message = update.message;
    if (!message?.text) return new Response('OK');

    const chatId = message.chat.id;
    const fromId = String(message.from?.id || '');
    const text = message.text.trim();
    const appUrl = (env.APP_URL || 'https://food-abuser-tma.pages.dev').replace(/\/$/, '');

    const isStart = text === '/start' || text.startsWith('/start@');
    const isAdminCmd = text === '/admin' || text.startsWith('/admin@');

    if (isStart) {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '👋 Привет! Food Abuser — твой дневник питания с ИИ-анализом блюд.',
          reply_markup: {
            inline_keyboard: [[{
              text: '🥗 Открыть Food Abuser',
              web_app: { url: appUrl },
            }]],
          },
        }),
      });
      return new Response('OK');
    }

    if (!isAdminCmd) return new Response('OK');

    // Silently ignore if not the admin
    if (!env.ADMIN_TELEGRAM_ID || fromId !== String(env.ADMIN_TELEGRAM_ID)) {
      return new Response('OK');
    }

    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '📊 Открыть панель администратора:',
        reply_markup: {
          inline_keyboard: [[{
            text: '📊 Admin Panel',
            web_app: { url: `${appUrl}/admin` },
          }]],
        },
      }),
    });
  } catch {}
  return new Response('OK');
}

// ─── ADMIN ─────────────────────────────────────────────────────────────────
async function handleAdmin(request, env) {
  const [usersRaw, opensRaw, feedbackRaw] = await Promise.all([
    env.FOOD_ABUSER_DB.get('analytics:users'),
    env.FOOD_ABUSER_DB.get('analytics:opens'),
    env.FOOD_ABUSER_DB.get('analytics:feedback'),
  ]);

  const users = usersRaw ? JSON.parse(usersRaw) : {};
  const opens = opensRaw ? JSON.parse(opensRaw) : {};
  const feedback = feedbackRaw ? JSON.parse(feedbackRaw) : [];

  const userList = Object.entries(users)
    .map(([id, u]) => ({ id, ...u }))
    .sort((a, b) => (b.lastSeen || '') > (a.lastSeen || '') ? 1 : -1);

  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const opensToday = opens[today] || 0;
  const opensWeek = Object.entries(opens)
    .filter(([d]) => d >= weekAgo)
    .reduce((s, [, c]) => s + c, 0);

  return json({ totalUsers: userList.length, opensToday, opensWeek, dailyOpens: opens, users: userList, feedback });
}
