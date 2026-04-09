/**
 * vlm-foodabuser-tg-miniapp
 * Food analysis via Gemini 2.5 Flash — supports photo (base64) and text description
 * Secrets required: GEMINI_API_KEY, TELEGRAM_BOT_TOKEN
 * KV binding required: AI_USAGE (for rate limiting)
 */

const GEMINI_MODEL = 'gemini-2.5-flash';
const AI_DAILY_LIMIT = 10;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Telegram-Init-Data, X-Dev-User-Id',
};

const JSON_SCHEMA = `{
  "items": [
    {
      "name": "название на английском (lowercase, snake_case)",
      "ru_name": "название на русском",
      "confidence": 0.85,
      "grams": 150,
      "calories": 220,
      "protein": 25.5,
      "fat": 8.2,
      "carbs": 12.0
    }
  ]
}`;

const RULES = `ПРАВИЛА:
1. Анализируй ТОЛЬКО еду
2. Для каждого блюда/ингредиента:
   - name: английское название, snake_case
   - ru_name: русское название
   - confidence: уверенность 0.70–0.98
   - grams: реалистичный вес порции в граммах
   - calories/protein/fat/carbs: НА УКАЗАННЫЙ ВЕС (не на 100г!)
3. Составные блюда раздели на компоненты
4. КБЖУ по стандартным нутриционным таблицам
5. ТОЛЬКО валидный JSON, никакого текста вокруг`;

const ADVICE_SCHEMA = `{
  "tips": [
    { "emoji": "💪", "title": "Заголовок", "text": "Конкретный совет 1-2 предложения" }
  ]
}`;

const ADVICE_PROMPT = (summary) => `Ты нутрициолог. Проанализируй данные питания за 7 дней и дай 3 конкретных практических совета на русском языке. Будь краток и конкретен, не общайся, только советы.

Данные пользователя:
${summary}

Верни ТОЛЬКО валидный JSON без текста вокруг:
${ADVICE_SCHEMA}`;

const IMAGE_PROMPT = `Ты нутриционист-эксперт. Проанализируй фото еды и верни ТОЛЬКО JSON.\n\nФОРМАТ:\n${JSON_SCHEMA}\n\n${RULES}`;
const TEXT_PROMPT = `Ты нутриционист-эксперт. Пользователь описал блюдо текстом. Определи состав и рассчитай КБЖУ, верни ТОЛЬКО JSON.\n\nФОРМАТ:\n${JSON_SCHEMA}\n\n${RULES}`;
const IMAGE_HINT_PROMPT = (hint) => `Ты нутриционист-эксперт. Проанализируй фото еды и верни ТОЛЬКО JSON.\nПользователь добавил комментарий к фото: "${hint}"\nИспользуй комментарий для уточнения порции, состава или названия.\n\nФОРМАТ:\n${JSON_SCHEMA}\n\n${RULES}`;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// ── Telegram initData validation (HMAC-SHA256) ───────────────────────────
async function extractUserId(initData, botToken) {
  if (!initData || !botToken) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');

    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const enc = new TextEncoder();
    const webAppDataKey = await crypto.subtle.importKey(
      'raw', enc.encode('WebAppData'),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const secretKeyBytes = await crypto.subtle.sign('HMAC', webAppDataKey, enc.encode(botToken));
    const hmacKey = await crypto.subtle.importKey(
      'raw', secretKeyBytes,
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sigBytes = await crypto.subtle.sign('HMAC', hmacKey, enc.encode(dataCheckString));
    const sig = Array.from(new Uint8Array(sigBytes)).map(b => b.toString(16).padStart(2, '0')).join('');

    if (sig !== hash) return null;

    const userJson = params.get('user');
    if (!userJson) return null;
    return JSON.parse(userJson)?.id?.toString() || null;
  } catch {
    return null;
  }
}

// ── Rate limiting via KV ────────────────────────────────────────────────
async function checkRateLimit(kv, userId) {
  if (!kv) return { allowed: true, remaining: AI_DAILY_LIMIT, used: 0 }; // KV not configured → allow

  const today = new Date().toISOString().split('T')[0]; // server-side date (tamper-proof!)
  const key = `ai_rate:${userId}:${today}`;
  const used = parseInt(await kv.get(key) || '0', 10);

  if (used >= AI_DAILY_LIMIT) {
    return { allowed: false, remaining: 0, used };
  }

  await kv.put(key, String(used + 1), { expirationTtl: 172800 }); // expire in 2 days
  return { allowed: true, remaining: AI_DAILY_LIMIT - used - 1, used: used + 1 };
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const QWEN_MODEL = 'meta-llama/llama-3.2-11b-vision-instruct:free';

// ── OpenRouter (OpenAI-compatible) call ─────────────────────────────────────
async function callOpenRouter(image, text, mimeType, apiKey) {
  const content = [];

  // Build prompt text
  let promptText;
  if (image && text) promptText = IMAGE_HINT_PROMPT(text);
  else if (text)      promptText = `${TEXT_PROMPT}\nОписание блюда от пользователя: "${text}"`;
  else                promptText = IMAGE_PROMPT;

  content.push({ type: 'text', text: promptText });

  if (image) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${mimeType};base64,${image}` },
    });
  }

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://food-abuser-tma.pages.dev',
      'X-Title': 'Food Abuser',
    },
    body: JSON.stringify({
      model: QWEN_MODEL,
      messages: [{ role: 'user', content }],
      temperature: 0.2,
      max_tokens: 4096,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `OpenRouter ${res.status}`);
  const modelText = data.choices?.[0]?.message?.content;
  if (!modelText) throw new Error('Empty OpenRouter response');
  return modelText;
}

// ── Gemini call ─────────────────────────────────────────────────────────────
async function callGemini(parts, env) {
  const payload = {
    contents: [{ parts }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 4096, responseMimeType: 'application/json' },
  };

  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 2000));
    res = await fetch(`${GEMINI_URL}?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.status !== 429) break;
    console.warn(`⚠️ Gemini 429, retry ${attempt + 1}/2`);
  }

  if (!res.ok) {
    const errText = await res.text();
    console.error('❌ Gemini error:', res.status, errText.substring(0, 200));
    if (res.status === 429) throw Object.assign(new Error('ИИ перегружен, попробуй через минуту'), { status: 429 });
    throw new Error(`Gemini API error: ${res.status}`);
  }

  const data = await res.json();
  // Gemini 2.5 Flash (thinking model) may return multiple parts:
  // responseParts[0] = {thought: true, text: "..."} — skip this
  // responseParts[1] = {text: "{...JSON...}"}        — this is the actual response
  const responseParts = data.candidates?.[0]?.content?.parts || [];
  const modelText = responseParts.find(p => !p.thought)?.text || responseParts[responseParts.length - 1]?.text;
  if (!modelText) throw new Error('Empty Gemini response');
  return modelText;
}

function parseModelJson(text) {
  // Qwen3 prepends <think>...</think> reasoning block — strip it
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : stripped);
}

function validateItems(items) {
  return items.map((item, idx) => {
    if (!item.name) throw new Error(`Item ${idx}: missing name`);
    if (typeof item.calories !== 'number') throw new Error(`Item ${idx}: calories must be number`);
    return {
      name: String(item.name).toLowerCase().replace(/\s+/g, '_'),
      ru_name: item.ru_name || item.name,
      confidence: Math.min(Math.max(Number(item.confidence) || 0.80, 0), 1),
      grams: Math.max(Math.round(Number(item.grams) || 100), 1),
      calories: Math.max(Math.round(Number(item.calories) || 0), 0),
      protein: Math.max(Math.round((Number(item.protein) || 0) * 10) / 10, 0),
      fat: Math.max(Math.round((Number(item.fat) || 0) * 10) / 10, 0),
      carbs: Math.max(Math.round((Number(item.carbs) || 0) * 10) / 10, 0),
    };
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

    if (request.method === 'GET') {
      const url = new URL(request.url);
      // /rate — returns current usage for the user (for cross-device sync)
      if (url.pathname === '/rate' || url.searchParams.get('rate') === '1') {
        const devUserId = request.headers.get('X-Dev-User-Id');
        const initData  = request.headers.get('X-Telegram-Init-Data');
        let userId = devUserId || null;
        if (!userId && initData && env.TELEGRAM_BOT_TOKEN) {
          userId = await extractUserId(initData, env.TELEGRAM_BOT_TOKEN);
        }
        if (!userId) userId = `ip:${request.headers.get('CF-Connecting-IP') || 'unknown'}`;

        if (env.AI_USAGE) {
          const today = new Date().toISOString().split('T')[0];
          const used = parseInt(await env.AI_USAGE.get(`ai_rate:${userId}:${today}`) || '0', 10);
          return jsonResponse({ remaining: Math.max(0, AI_DAILY_LIMIT - used), used, limit: AI_DAILY_LIMIT });
        }
        return jsonResponse({ remaining: AI_DAILY_LIMIT, used: 0, limit: AI_DAILY_LIMIT });
      }
      return jsonResponse({ status: 'ok', version: '3.4', models: [GEMINI_MODEL, QWEN_MODEL], hasGemini: !!env.GEMINI_API_KEY, hasQwen: !!env.OPENROUTER_API_KEY });
    }

    if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

    try {
      // ── Rate limiting ─────────────────────────────────────────────────
      const devUserId = request.headers.get('X-Dev-User-Id');
      const initData  = request.headers.get('X-Telegram-Init-Data');

      let userId = devUserId || null;
      if (!userId && initData && env.TELEGRAM_BOT_TOKEN) {
        userId = await extractUserId(initData, env.TELEGRAM_BOT_TOKEN);
      }
      if (!userId) userId = `ip:${request.headers.get('CF-Connecting-IP') || 'unknown'}`;

      const rateLimit = await checkRateLimit(env.AI_USAGE, userId);
      if (!rateLimit.allowed) {
        return jsonResponse({
          error: 'rate_limit_exceeded',
          message: `Дневной лимит AI исчерпан (${AI_DAILY_LIMIT}/${AI_DAILY_LIMIT}). Попробуй завтра.`,
          remaining: 0, limit: AI_DAILY_LIMIT,
        }, 429);
      }
      // ─────────────────────────────────────────────────────────────────

      const body = await request.json();
      const { image, text, mime_type = 'image/jpeg', model = 'gemini', mode = 'analyze' } = body;

      if (!image && !text) {
        return jsonResponse({ error: 'Provide either "image" (base64) or "text" (description)' }, 400);
      }

      console.log(`🤖 Model: ${model}, mode: ${mode}, image: ${!!image}, text: ${!!text}`);

      // ── Advice mode — returns structured tips, not food items ─────────────
      if (mode === 'advice') {
        if (!env.GEMINI_API_KEY) return jsonResponse({ error: 'GEMINI_API_KEY not configured' }, 500);
        const parts = [{ text: ADVICE_PROMPT(text) }];
        let adviceText;
        try { adviceText = await callGemini(parts, env); }
        catch (e) {
          if (e.status === 429) return jsonResponse({ error: 'ai_overloaded', message: 'ИИ перегружен, попробуй позже' }, 429);
          throw e;
        }
        let parsed;
        try { parsed = parseModelJson(adviceText); } catch { parsed = { tips: [] }; }
        return jsonResponse({ tips: parsed.tips || [], ai_remaining: rateLimit.remaining });
      }

      let modelText;

      if (model === 'qwen') {
        // ── OpenRouter / Qwen ─────────────────────────────────────────
        if (!env.OPENROUTER_API_KEY) return jsonResponse({ error: 'OPENROUTER_API_KEY not configured' }, 500);
        modelText = await callOpenRouter(image, text, mime_type, env.OPENROUTER_API_KEY);

      } else {
        // ── Gemini (default) ──────────────────────────────────────────
        if (!env.GEMINI_API_KEY) return jsonResponse({ error: 'GEMINI_API_KEY not configured' }, 500);

        let parts;
        if (image && text) {
          parts = [{ text: IMAGE_HINT_PROMPT(text) }, { inline_data: { mime_type, data: image } }];
        } else if (text) {
          parts = [{ text: TEXT_PROMPT }, { text: `Описание блюда от пользователя: "${text}"` }];
        } else {
          parts = [{ text: IMAGE_PROMPT }, { inline_data: { mime_type, data: image } }];
        }

        try {
          modelText = await callGemini(parts, env);
        } catch (e) {
          if (e.status === 429) return jsonResponse({ error: 'ai_overloaded', message: 'ИИ перегружен, попробуй через минуту' }, 429);
          throw e;
        }
      }

      console.log('📝 Model output (first 200):', modelText.substring(0, 200));

      let parsed;
      try { parsed = parseModelJson(modelText); }
      catch (e) { return jsonResponse({ error: 'JSON parse failed', raw: modelText.substring(0, 200) }, 500); }

      if (!parsed.items || !Array.isArray(parsed.items)) throw new Error('Missing items array in response');
      if (parsed.items.length === 0) return jsonResponse({ items: [], total: { calories:0, protein:0, fat:0, carbs:0 } });

      const items = validateItems(parsed.items);
      const total = items.reduce(
        (acc, i) => ({ calories: acc.calories + i.calories, protein: Math.round((acc.protein + i.protein) * 10) / 10, fat: Math.round((acc.fat + i.fat) * 10) / 10, carbs: Math.round((acc.carbs + i.carbs) * 10) / 10 }),
        { calories: 0, protein: 0, fat: 0, carbs: 0 }
      );

      console.log(`✅ Done [${model}]: ${items.length} items, ${total.calories} kcal, remaining: ${rateLimit.remaining}`);
      return jsonResponse({ items, total, ai_remaining: rateLimit.remaining, ai_limit: AI_DAILY_LIMIT, model_used: model });

    } catch (error) {
      console.error('❌ Worker error:', error.message);
      return jsonResponse({ error: error.message }, 500);
    }
  },
};
