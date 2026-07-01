import crypto from 'crypto';
import { pool } from './db';

// --- TELEGRAM BOT INTEGRATSIYASI ---
// Ushbu modul haqiqiy Telegram Bot API bilan ishlaydi (long polling orqali).
// Kerakli sozlamalar .env faylida:
//   TELEGRAM_BOT_TOKEN=123456:ABC-DEF...   (BotFather'dan olinadi)
//   TELEGRAM_ADMIN_CHAT_ID=123456789        (adminga xabar yuboriladigan chat ID)
//
// Agar TELEGRAM_BOT_TOKEN o'rnatilmagan bo'lsa, bot ishga tushmaydi va
// ilova xatosiz davom etadi (faqat "Sahifaga qaytish" avtomatik kirish yo'li ishlaydi).

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const API_BASE = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : '';

let pollingOffset = 0;
let isRunning = false;

async function callTelegramApi(method: string, params: Record<string, any>) {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (err) {
    console.error(`[TELEGRAM] ${method} chaqiruvida xatolik:`, err);
    return null;
  }
}

export async function sendTelegramMessage(chatId: string | number, text: string, replyMarkup?: any) {
  if (!chatId) return;
  await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

// IP manzil orqali taxminiy joylashuvni aniqlaydi (bepul, kalit talab qilmaydigan
// ip-api.com xizmati orqali). Faqat PUBLIC IP'lar uchun ishlaydi — 127.0.0.1 yoki
// lokal tarmoq manzillari (masalan development muhitida) natija bermaydi.
async function lookupIpLocation(ip: string): Promise<{ city?: string; country?: string; lat?: number; lon?: number; mapsUrl?: string } | null> {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return null;
  }
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city,lat,lon`);
    const data = await res.json();
    if (data.status !== 'success') return null;
    const mapsUrl = `https://www.google.com/maps?q=${data.lat},${data.lon}`;
    return { city: data.city, country: data.country, lat: data.lat, lon: data.lon, mapsUrl };
  } catch (err) {
    console.error('[GEO] IP joylashuvini aniqlashda xatolik:', err);
    return null;
  }
}

// Adminga yangi ro'yxatdan o'tish haqida xabar yuboradi (IP manzili va joylashuv bilan birga)
export async function notifyAdminNewUser(details: {
  username: string;
  firstName: string;
  lastName: string;
  phone: string;
  ip: string;
  source: 'form' | 'bot';
}) {
  if (!ADMIN_CHAT_ID) return;
  const { username, firstName, lastName, phone, ip, source } = details;
  const sourceLabel = source === 'bot' ? 'Telegram bot orqali' : 'Ro\'yxatdan o\'tish formasi orqali';

  const location = await lookupIpLocation(ip);
  const locationLine = location
    ? `📍 Joylashuv: ${location.city || ''}${location.city && location.country ? ', ' : ''}${location.country || ''} — <a href="${location.mapsUrl}">Google Maps'da ko'rish</a>`
    : '📍 Joylashuv: aniqlab bo\'lmadi (lokal/noma\'lum IP)';

  const text =
    `🆕 <b>Yangi foydalanuvchi ro'yxatdan o'tdi</b>\n\n` +
    `👤 Ism: ${firstName} ${lastName}\n` +
    `🔑 Username: <code>${username}</code>\n` +
    `📱 Telefon: ${phone}\n` +
    `🌐 IP manzil: <code>${ip}</code>\n` +
    `${locationLine}\n` +
    `📥 Manba: ${sourceLabel}`;
  await sendTelegramMessage(ADMIN_CHAT_ID, text);
}

async function handleStartCommand(chatId: number, payloadRaw: string, fromUsername?: string) {
  try {
    // payloadRaw endi qisqa, tasodifiy token (register-init'da yaratilgan).
    // Bazadan shu tokenga mos username'ni topamiz.
    const { rows: tokenRows } = await pool.query(
      'SELECT username, used FROM registration_start_tokens WHERE token = $1',
      [payloadRaw]
    );
    const tokenRow = tokenRows[0];

    if (!tokenRow) {
      await sendTelegramMessage(chatId, 'Havola noto\'g\'ri yoki muddati o\'tgan. Iltimos, saytda formani qaytadan to\'ldiring.');
      return;
    }

    const username = tokenRow.username;

    // Foydalanuvchini bazadan (parol va IP bilan birga) olamiz
    const { rows } = await pool.query(
      'SELECT username, password, first_name, last_name, phone, last_login_ip FROM users WHERE username = $1',
      [username]
    );
    if (rows.length === 0) {
      await sendTelegramMessage(chatId, 'Hisob topilmadi. Iltimos, saytda ro\'yxatdan o\'tish formasini qaytadan to\'ldiring.');
      return;
    }
    const user = rows[0];
    const { password, last_login_ip: ip } = user;

    // Tokenni bir martalik qilib belgilaymiz (qayta ishlatilmasin)
    await pool.query('UPDATE registration_start_tokens SET used = true WHERE token = $1', [payloadRaw]);

    // Haqiqiy Telegram chat ID'ni bazaga yozib qo'yamiz (keyingi bildirishnomalar uchun)
    await pool.query('UPDATE users SET telegram_chat_id = $1 WHERE username = $2', [String(chatId), username]);

    // Bir martalik "avtomatik kirish" tokeni — sayt shu token orqali parolsiz login qiladi
    const loginToken = crypto.randomBytes(24).toString('hex');
    await pool.query('INSERT INTO auto_login_tokens (token, username) VALUES ($1, $2)', [loginToken, username]);

    const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
    const autoLoginUrl = appUrl ? `${appUrl}/?auto_login=${loginToken}` : null;

    await sendTelegramMessage(
      chatId,
      `✅ <b>Ro'yxatdan o'tish yakunlandi!</b>\n\n` +
      `Kirish ma'lumotlaringiz:\n` +
      `👤 Username: <code>${username}</code>\n` +
      `🔑 Parol: <code>${password}</code>\n\n` +
      `Ushbu ma'lumotlarni saqlab qo'ying. Pastdagi tugma orqali bir bosishda, parolsiz hisobingizga kirishingiz mumkin.`,
      autoLoginUrl ? { inline_keyboard: [[{ text: '🔐 Avtomatik kirish', url: autoLoginUrl }]] } : undefined
    );

    // Bot orqali muvaffaqiyatli ulanganini adminga ham xabar beramiz
    if (ADMIN_CHAT_ID) {
      const location = await lookupIpLocation(ip);
      const locationLine = location
        ? `📍 Joylashuv: ${location.city || ''}${location.city && location.country ? ', ' : ''}${location.country || ''} — <a href="${location.mapsUrl}">Google Maps'da ko'rish</a>\n`
        : '';
      await sendTelegramMessage(
        ADMIN_CHAT_ID,
        `🤖 <b>Foydalanuvchi botga ulandi</b>\n\n` +
        `👤 ${user.first_name} ${user.last_name} (<code>${username}</code>)\n` +
        `📱 ${user.phone}\n` +
        `🌐 IP: <code>${ip || 'noma\'lum'}</code>\n` +
        locationLine +
        `💬 Telegram chat ID: <code>${chatId}</code>${fromUsername ? ` (@${fromUsername})` : ''}`
      );
    }
  } catch (err) {
    console.error('[TELEGRAM] /start payload xatolik:', err);
    await sendTelegramMessage(chatId, 'Xatolik yuz berdi. Iltimos, saytdan qaytadan urinib ko\'ring.');
  }
}

async function pollUpdates() {
  if (!API_BASE) return;
  const data = await callTelegramApi('getUpdates', {
    offset: pollingOffset,
    timeout: 25,
    allowed_updates: ['message'],
  });

  if (data && data.ok && Array.isArray(data.result)) {
    for (const update of data.result) {
      pollingOffset = update.update_id + 1;
      const msg = update.message;
      if (!msg || !msg.text) continue;

      if (msg.text.startsWith('/start')) {
        const parts = msg.text.split(' ');
        const payload = parts[1];
        if (payload) {
          await handleStartCommand(msg.chat.id, payload, msg.from?.username);
        } else {
          await sendTelegramMessage(msg.chat.id, 'Salom! Ro\'yxatdan o\'tish uchun saytdagi "Telegram orqali ro\'yxatdan o\'tish" havolasidan foydalaning.');
        }
      }
    }
  }
}

export async function startTelegramBot() {
  if (!BOT_TOKEN) {
    console.log('[TELEGRAM] TELEGRAM_BOT_TOKEN topilmadi — bot ishga tushmadi (simulyatsiyasiz rejim).');
    return;
  }
  if (isRunning) return;
  isRunning = true;
  console.log('[TELEGRAM] Bot long-polling rejimida ishga tushdi.');

  // Uzluksiz polling tsikli — server ishlagan davomida fon rejimida ishlaydi
  (async function loop() {
    while (isRunning) {
      try {
        await pollUpdates();
      } catch (err) {
        console.error('[TELEGRAM] Polling xatolik:', err);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  })();
}

export function stopTelegramBot() {
  isRunning = false;
}
