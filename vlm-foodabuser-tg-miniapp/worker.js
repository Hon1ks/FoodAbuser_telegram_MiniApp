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

function parseModelJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : text);
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
      return jsonResponse({ status: 'ok', version: '3.1', model: GEMINI_MODEL, hasApiKey: !!env.GEMINI_API_KEY });
    }

    if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

    try {
      if (!env.GEMINI_API_KEY) {
        return jsonResponse({ error: 'GEMINI_API_KEY not configured' }, 500);
      }

      // ── Rate limiting ─────────────────────────────────────────────────
      const devUserId = request.headers.get('X-Dev-User-Id');
      const initData  = request.headers.get('X-Telegram-Init-Data');

      let userId = devUserId || null;
      if (!userId && initData && env.TELEGRAM_BOT_TOKEN) {
        userId = await extractUserId(initData, env.TELEGRAM_BOT_TOKEN);
      }
      // Fallback: rate-limit by IP (weaker but still server-side)
      if (!userId) userId = `ip:${request.headers.get('CF-Connecting-IP') || 'unknown'}`;

      const rateLimit = await checkRateLimit(env.AI_USAGE, userId);
      if (!rateLimit.allowed) {
        return jsonResponse({
          error: 'rate_limit_exceeded',
          message: `Дневной лимит AI исчерпан (${AI_DAILY_LIMIT}/${AI_DAILY_LIMIT}). Попробуй завтра.`,
          remaining: 0,
          limit: AI_DAILY_LIMIT,
        }, 429);
      }
      // ─────────────────────────────────────────────────────────────────

      const body = await request.json();
      const { image, text, mime_type = 'image/jpeg' } = body;

      if (!image && !text) {
        return jsonResponse({ error: 'Provide either "image" (base64) or "text" (description)' }, 400);
      }

      // Build Gemini parts
      let parts;
      if (image && text) {
        // Photo + user hint: use hint to improve accuracy (portion size, dish name, etc.)
        console.log('📷+💬 Image+hint analysis, hint:', text.substring(0, 80));
        parts = [
          { text: IMAGE_HINT_PROMPT(text) },
          { inline_data: { mime_type, data: image } },
        ];
      } else if (text) {
        console.log('📝 Text analysis:', text.substring(0, 100));
        parts = [
          { text: TEXT_PROMPT },
          { text: `Описание блюда от пользователя: "${text}"` },
        ];
      } else {
        console.log('📷 Image analysis, base64 length:', image.length);
        parts = [
          { text: IMAGE_PROMPT },
          { inline_data: { mime_type, data: image } },
        ];
      }

      const geminiPayload = {
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      };

      // Retry up to 2 times on 429 (Gemini rate limit)
      let geminiRes;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 2000));
        geminiRes = await fetch(`${GEMINI_URL}?key=${env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiPayload),
        });
        if (geminiRes.status !== 429) break;
        console.warn(`⚠️ Gemini 429, retry ${attempt + 1}/2`);
      }

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        console.error('❌ Gemini error:', geminiRes.status, errText.substring(0, 200));
        if (geminiRes.status === 429) {
          return jsonResponse({ error: 'ai_overloaded', message: 'ИИ перегружен, попробуй через минуту' }, 429);
        }
        return jsonResponse({ error: `Gemini API error: ${geminiRes.status}`, details: errText.substring(0, 300) }, geminiRes.status);
      }

      const geminiData = await geminiRes.json();
      const modelText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!modelText) throw new Error('Empty Gemini response');

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

      console.log(`✅ Done: ${items.length} items, ${total.calories} kcal, remaining: ${rateLimit.remaining}`);
      return jsonResponse({ items, total, ai_remaining: rateLimit.remaining, ai_limit: AI_DAILY_LIMIT });

    } catch (error) {
      console.error('❌ Worker error:', error.message);
      return jsonResponse({ error: error.message }, 500);
    }
  },
};
