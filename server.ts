import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { pool, testConnection } from './db';
import { startTelegramBot, notifyAdminNewUser } from './telegramBot';

dotenv.config();

// Initialize OpenAI SDK if API Key exists
const openaiApiKey = process.env.OPENAI_API_KEY;
let ai: OpenAI | null = null;
if (openaiApiKey && openaiApiKey !== 'MY_OPENAI_API_KEY') {
  try {
    ai = new OpenAI({ apiKey: openaiApiKey });
    console.log('OpenAI API successfully initialized.');
  } catch (error) {
    console.error('Failed to initialize OpenAI API:', error);
  }
} else {
  console.log('No valid OPENAI_API_KEY found, running AI in simulation mode.');
}

// Multer — fayllar endi diskka yozilmaydi, xotirada (buffer) ushlanadi va
// to'g'ridan-to'g'ri PostgreSQL'ga (BYTEA ustunga) saqlanadi. Bu ephemeral disk
// bilan hosting qilinganda (Render/Railway kabi) fayllar qayta ishga tushirilganda
// yo'qolib qolmasligini ta'minlaydi.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

// Ariza (application) topshirishda birga yuklanadigan hujjat turlari.
// Har biri ixtiyoriy — talaba nechta faylni yuklaganiga qarab saqlanadi.
const APPLICATION_DOC_FIELDS: { field: string; label: string }[] = [
  { field: 'passport', label: 'Pasport nusxasi' },
  { field: 'photo3x4', label: '3x4 rasm' },
  { field: 'birthCert', label: "Metrika (Tug'ilganlik guvohnomasi)" },
  { field: 'idCard', label: 'ID Karta' },
  { field: 'foreignPassport', label: 'Zagran pasport' },
  { field: 'attestat', label: '9-11 sinf attestati' },
];
const uploadApplicationDocs = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
}).fields(APPLICATION_DOC_FIELDS.map(f => ({ name: f.field, maxCount: 1 })));

// --- TYPES (frontendga yuboriladigan JSON shakli o'zgarishsiz qoladi) ---
interface University {
  id: string;
  name: string;
  country: string;
  logo: string;
  budget: number;
  ielts: number;
  gpa: number;
  grantInfo: string;
  programs: string[];
  description: string;
}

interface Application {
  id: string;
  username?: string;
  universityId: string;
  universityName: string;
  universityCountry?: string;
  program: string;
  status: string;
  date: string;
  fatherName?: string;
  fatherPhone?: string;
  motherName?: string;
  motherPhone?: string;
  contactEmail?: string;
  contactPhone?: string;
  history: { status: string; date: string; note: string }[];
  documents: { name: string; type: string; status: string; url?: string }[];
}

interface UserProfile {
  username: string;
  firstName: string;
  lastName: string;
  phone: string;
  budget: number | null;
  ielts_score: number | null;
  has_ielts: boolean | null;
  gpa: number | null;
  has_gpa: boolean | null;
  onboarding_completed: boolean;
  avatarUrl?: string;
  telegram_chat_id?: string;
  last_login_ip?: string;
  role?: 'student' | 'admin';
}

// --- DB YORDAMCHI FUNKSIYALARI ---
// MUAMMO (FIX): Ilgari bu ma'lumotlar Map() ichida (RAM'da) saqlanardi va
// server qayta ishga tushganda (masalan, deploy qilinganda) hammasi o'chib ketardi.
// Endi har bir funksiya to'g'ridan-to'g'ri PostgreSQL'ga murojaat qiladi.

async function getUserByUsername(username: string): Promise<(UserProfile & { password?: string }) | null> {
  const { rows } = await pool.query(
    `SELECT username, password, first_name AS "firstName", last_name AS "lastName", phone,
            budget, ielts_score::float8 AS ielts_score, has_ielts, gpa::float8 AS gpa, has_gpa, onboarding_completed,
            avatar_url AS "avatarUrl", telegram_chat_id, last_login_ip, role
     FROM users WHERE username = $1`,
    [username]
  );
  return rows[0] || null;
}

async function userExists(username: string): Promise<boolean> {
  const { rows } = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
  return rows.length > 0;
}

function mapUniversityRow(row: any): University {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    logo: row.logo,
    budget: row.budget,
    ielts: row.ielts !== null ? Number(row.ielts) : row.ielts,
    gpa: row.gpa !== null ? Number(row.gpa) : row.gpa,
    grantInfo: row.grant_info,
    programs: row.programs,
    description: row.description,
  };
}

async function getAllUniversities(): Promise<University[]> {
  const { rows } = await pool.query('SELECT * FROM universities ORDER BY id');
  return rows.map(mapUniversityRow);
}

async function getApplicationsForUser(username: string | null): Promise<Application[]> {
  const { rows: apps } = await pool.query(
    `SELECT id, username, university_id AS "universityId", university_name AS "universityName",
            university_country AS "universityCountry", program, status, date::text AS date,
            father_name AS "fatherName", father_phone AS "fatherPhone",
            mother_name AS "motherName", mother_phone AS "motherPhone",
            contact_email AS "contactEmail", contact_phone AS "contactPhone"
     FROM applications ${username ? 'WHERE username = $1' : ''} ORDER BY created_at DESC`,
    username ? [username] : []
  );

  const result: Application[] = [];
  for (const app of apps) {
    const { rows: history } = await pool.query(
      `SELECT status, date::text AS date, note FROM application_history WHERE application_id = $1 ORDER BY created_at DESC`,
      [app.id]
    );
    const { rows: docs } = await pool.query(
      `SELECT name, type, status, ('/api/application-documents/file/' || id) AS url
       FROM application_documents WHERE application_id = $1`,
      [app.id]
    );
    result.push({ ...app, history, documents: docs });
  }
  return result;
}

// --- SERVER ---

async function main() {
  // Ishga tushishdan oldin bazaga ulanishni tekshiramiz
  await testConnection();

  // Haqiqiy Telegram botni fon rejimida ishga tushiramiz (TELEGRAM_BOT_TOKEN bo'lsa)
  startTelegramBot().catch((e) => console.error('[TELEGRAM] Ishga tushmadi:', e));

  const app = express();

  // MUHIM: Hosting (Render/Railway/Nginx/Cloudflare va h.k.) orqasida ishlayotganda
  // Express standart holatda so'rovni yuborgan proxy'ning o'z manzilini (odatda 127.0.0.1)
  // qaytaradi, chunki u X-Forwarded-For header'iga ishonmaydi. `trust proxy`ni yoqish
  // orqali Express shu header'dan haqiqiy client IP'ni o'qiy boshlaydi.
  app.set('trust proxy', true);

  app.use(express.json());

  // Middleware to retrieve user from Bearer Token (Simulated Auth)
  const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
    }
    const token = authHeader.split(' ')[1];
    try {
      // In this simulation, the token is simply the username
      const profile = await getUserByUsername(token);
      if (!profile) {
        return res.status(401).json({ error: 'Noto\'g\'ri seans yoki foydalanuvchi topilmadi' });
      }
      delete (profile as any).password;
      (req as any).user = profile;
      next();
    } catch (err) {
      console.error('Auth middleware DB xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi (baza bilan bog\'lanishda)' });
    }
  };

  // --- API ENDPOINTS ---

  // POST /auth/register-init
  app.post('/api/auth/register-init', async (req: Request, res: Response) => {
    try {
      const { firstName, lastName, phone } = req.body;
      if (!firstName || !lastName || !phone) {
        return res.status(400).json({ error: 'Ism, Familiya va Telefon kiritilishi shart' });
      }

      const clientIp = req.ip || '127.0.0.1';

      const cleanFirstName = firstName.trim();
      const cleanLastName = lastName.trim();
      let baseUsername = (cleanFirstName + '_' + cleanLastName).toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (!baseUsername) baseUsername = 'user';

      // Prevent collision (bazadan tekshiramiz)
      let username = baseUsername;
      let counter = 1;
      while (await userExists(username)) {
        username = `${baseUsername}${counter}`;
        counter++;
      }

      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let password = '';
      for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      // Hisob darhol yaratiladi — bu "Sahifaga qaytish" orqali avtomatik kirish yo'lini ta'minlaydi.
      // Telegram bot orqali o'tilganda, bot shu username/parolni /start payload'idan o'qib,
      // telegram_chat_id ustunini haqiqiy chat ID bilan yangilaydi va foydalanuvchiga DM yuboradi.
      await pool.query(
        `INSERT INTO users (username, password, first_name, last_name, phone, onboarding_completed, last_login_ip, role)
         VALUES ($1,$2,$3,$4,$5,false,$6,'student')`,
        [username, password, cleanFirstName, cleanLastName, phone, clientIp]
      );

      // Bot /start bosqichida qayta izlashga hojat qolmasligi uchun qisqa,
      // xavfsiz token yaratamiz va bazaga saqlaymiz. MUHIM: Telegram deep-link
      // "start" parametri FAQAT [A-Za-z0-9_-] belgilariga va maks. 64 belgiga
      // ruxsat beradi — shuning uchun username/parol/IP'ni to'g'ridan-to'g'ri
      // (base64 JSON sifatida) linkka qo'yib bo'lmaydi, Telegram uni jimgina
      // tashlab yuborardi (bu avvalgi "Automatic start bermayapti" xatosining sababi edi).
      const startToken = crypto.randomBytes(16).toString('hex'); // 32 belgi, faqat 0-9a-f
      await pool.query(
        `INSERT INTO registration_start_tokens (token, username) VALUES ($1, $2)`,
        [startToken, username]
      );
      const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'Eduvisa_ai_bot';
      const telegramBotUrl = `https://t.me/${botUsername}?start=${startToken}`;

      // Admin darhol xabardor qilinadi (IP manzili bilan birga)
      notifyAdminNewUser({
        username,
        firstName: cleanFirstName,
        lastName: cleanLastName,
        phone,
        ip: clientIp,
        source: 'form',
      }).catch((e) => console.error('Admin notif xatolik:', e));

      // ESLATMA: parol frontend'ga qaytarilmaydi. Foydalanuvchi username va parolni
      // FAQAT Telegram bot orqali oladi (xavfsizlik uchun). Bot javobida "Avtomatik
      // kirish" tugmasi ham bo'ladi — u orqali parolsiz, bir bosishda hisobga kiradi.
      res.json({
        success: true,
        telegramUrl: telegramBotUrl,
      });
    } catch (err) {
      console.error('register-init xatolik:', err);
      res.status(500).json({ error: 'Ro\'yxatdan o\'tishda server xatoligi' });
    }
  });

  // POST /auth/login
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Username va Parol kiritilishi shart' });
      }

      const cleanUsername = username.trim().toLowerCase();
      const profile = await getUserByUsername(cleanUsername);

      if (!profile || profile.password !== password) {
        return res.status(401).json({ error: 'Username yoki parol noto\'g\'ri' });
      }

      const loginIp = req.ip || '127.0.0.1';
      await pool.query('UPDATE users SET last_login_ip = $1 WHERE username = $2', [loginIp, cleanUsername]);

      delete (profile as any).password;
      res.json({ success: true, token: profile.username, user: { ...profile, last_login_ip: loginIp } });
    } catch (err) {
      console.error('login xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi' });
    }
  });

  // POST /auth/auto-login — Telegram botdagi "Hisobga avtomatik kirish" tugmasi ishlatadigan
  // bir martalik token'ni haqiqiy sessiyaga almashtiradi (parol kiritish shart emas)
  app.post('/api/auth/auto-login', async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: 'Token kiritilishi shart' });
      }

      const { rows } = await pool.query(
        `SELECT username, used, created_at FROM auto_login_tokens WHERE token = $1`,
        [token]
      );
      const tokenRow = rows[0];
      if (!tokenRow) {
        return res.status(401).json({ error: 'Havola noto\'g\'ri yoki allaqachon ishlatilgan' });
      }
      if (tokenRow.used) {
        return res.status(401).json({ error: 'Ushbu havola allaqachon ishlatilgan' });
      }
      // 15 daqiqadan eski token'lar amal qilmaydi
      const ageMs = Date.now() - new Date(tokenRow.created_at).getTime();
      if (ageMs > 15 * 60 * 1000) {
        return res.status(401).json({ error: 'Havola muddati o\'tgan. Botdan qaytadan urinib ko\'ring.' });
      }

      const profile = await getUserByUsername(tokenRow.username);
      if (!profile) {
        return res.status(401).json({ error: 'Foydalanuvchi topilmadi' });
      }

      // Token bir martalik — darhol "ishlatilgan" deb belgilaymiz
      await pool.query('UPDATE auto_login_tokens SET used = true WHERE token = $1', [token]);

      const loginIp = req.ip || '127.0.0.1';
      await pool.query('UPDATE users SET last_login_ip = $1 WHERE username = $2', [loginIp, tokenRow.username]);

      delete (profile as any).password;
      res.json({ success: true, token: profile.username, user: { ...profile, last_login_ip: loginIp } });
    } catch (err) {
      console.error('auto-login xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi' });
    }
  });

  // POST /auth/refresh
  app.post('/api/auth/refresh', authMiddleware, (req: Request, res: Response) => {
    const user = (req as any).user;
    res.json({ success: true, token: user.username, user });
  });

  // GET /profile/onboarding-status
  app.get('/api/profile/onboarding-status', authMiddleware, (req: Request, res: Response) => {
    const user = (req as any).user;
    res.json({ onboarding_completed: user.onboarding_completed });
  });

  // POST /profile/onboarding
  app.post('/api/profile/onboarding', authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { budget, ielts_score, has_ielts, gpa, has_gpa } = req.body;

      const newBudget = budget !== undefined ? Number(budget) : null;
      const newIelts = ielts_score !== undefined ? Number(ielts_score) : null;
      const newHasIelts = has_ielts !== undefined ? Boolean(has_ielts) : null;
      const newGpa = gpa !== undefined ? Number(gpa) : null;
      const newHasGpa = has_gpa !== undefined ? Boolean(has_gpa) : null;

      const { rows } = await pool.query(
        `UPDATE users SET budget=$1, ielts_score=$2, has_ielts=$3, gpa=$4, has_gpa=$5, onboarding_completed=true
         WHERE username=$6
         RETURNING username, first_name AS "firstName", last_name AS "lastName", phone, budget, ielts_score::float8 AS ielts_score,
                   has_ielts, gpa::float8 AS gpa, has_gpa, onboarding_completed, avatar_url AS "avatarUrl",
                   telegram_chat_id, last_login_ip, role`,
        [newBudget, newIelts, newHasIelts, newGpa, newHasGpa, user.username]
      );

      res.json({ success: true, user: rows[0] });
    } catch (err) {
      console.error('onboarding xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi' });
    }
  });

  // GET /profile
  app.get('/api/profile', authMiddleware, (req: Request, res: Response) => {
    res.json((req as any).user);
  });

  // PATCH /profile
  app.patch('/api/profile', authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { firstName, lastName, phone, budget, ielts_score, gpa, has_ielts, has_gpa } = req.body;

      const { rows } = await pool.query(
        `UPDATE users SET
           first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           phone = COALESCE($3, phone),
           budget = CASE WHEN $4::text IS NULL THEN budget ELSE NULLIF($4, '')::int END,
           ielts_score = CASE WHEN $5::text IS NULL THEN ielts_score ELSE NULLIF($5, '')::numeric END,
           gpa = CASE WHEN $6::text IS NULL THEN gpa ELSE NULLIF($6, '')::numeric END,
           has_ielts = COALESCE($7, has_ielts),
           has_gpa = COALESCE($8, has_gpa)
         WHERE username = $9
         RETURNING username, first_name AS "firstName", last_name AS "lastName", phone, budget, ielts_score::float8 AS ielts_score,
                   has_ielts, gpa::float8 AS gpa, has_gpa, onboarding_completed, avatar_url AS "avatarUrl",
                   telegram_chat_id, last_login_ip, role`,
        [
          firstName ?? null,
          lastName ?? null,
          phone ?? null,
          budget === undefined ? null : (budget === null ? '' : String(budget)),
          ielts_score === undefined ? null : (ielts_score === null ? '' : String(ielts_score)),
          gpa === undefined ? null : (gpa === null ? '' : String(gpa)),
          has_ielts === undefined ? null : Boolean(has_ielts),
          has_gpa === undefined ? null : Boolean(has_gpa),
          user.username,
        ]
      );

      res.json({ success: true, user: rows[0] });
    } catch (err) {
      console.error('profile patch xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi' });
    }
  });

  // GET /universities
  app.get('/api/universities', async (req: Request, res: Response) => {
    try {
      const { country, match_profile, username } = req.query;
      let list = await getAllUniversities();

      if (country) {
        list = list.filter(u => u.country.toLowerCase() === String(country).toLowerCase());
      }

      if (match_profile === 'true' && username) {
        const user = await getUserByUsername(String(username).toLowerCase());
        if (user) {
          list = list.filter(u => {
            const budgetMatch = user.budget === null || u.budget <= user.budget || u.budget <= 5000;
            const ieltsMatch = user.ielts_score === null || !user.has_ielts || u.ielts <= Number(user.ielts_score);
            return budgetMatch && ieltsMatch;
          });
        }
      }

      res.json(list);
    } catch (err) {
      console.error('universities xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi' });
    }
  });

  // GET /universities/recommended
  app.get('/api/universities/recommended', authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const all = await getAllUniversities();
      const recommended = all.filter(u => {
        const userBudget = user.budget || 20000;
        const budgetOk = u.budget <= userBudget;
        const userIelts = user.has_ielts ? (user.ielts_score || 0) : 0;
        const ieltsOk = !u.ielts || u.ielts <= userIelts || userIelts === 0;
        return budgetOk && ieltsOk;
      });
      res.json(recommended.slice(0, 5));
    } catch (err) {
      console.error('recommended xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi' });
    }
  });

  // GET /universities/{id}
  app.get('/api/universities/:id', async (req: Request, res: Response) => {
    try {
      const { rows } = await pool.query('SELECT * FROM universities WHERE id = $1', [req.params.id]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Universitet topilmadi' });
      }
      res.json(mapUniversityRow(rows[0]));
    } catch (err) {
      console.error('university by id xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi' });
    }
  });

  // POST /interests (toggle bookmark)
  app.post('/api/interests', authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { universityId } = req.body;

      if (!universityId) {
        return res.status(400).json({ error: 'universityId talab qilinadi' });
      }

      const { rows: existing } = await pool.query(
        'SELECT 1 FROM interests WHERE username = $1 AND university_id = $2',
        [user.username, universityId]
      );

      let saved = false;
      if (existing.length > 0) {
        await pool.query('DELETE FROM interests WHERE username = $1 AND university_id = $2', [user.username, universityId]);
      } else {
        await pool.query('INSERT INTO interests (username, university_id) VALUES ($1, $2)', [user.username, universityId]);
        saved = true;
      }

      const { rows: all } = await pool.query('SELECT university_id FROM interests WHERE username = $1', [user.username]);
      res.json({ success: true, saved, interests: all.map(r => r.university_id) });
    } catch (err) {
      console.error('interests xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi' });
    }
  });

  // GET /interests (for user)
  app.get('/api/interests', authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { rows } = await pool.query('SELECT university_id FROM interests WHERE username = $1', [user.username]);
      res.json(rows.map(r => r.university_id));
    } catch (err) {
      console.error('get interests xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi' });
    }
  });

  // GET /applications
  app.get('/api/applications', authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      res.json(await getApplicationsForUser(user.username));
    } catch (err) {
      console.error('applications xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi' });
    }
  });

  // POST /applications (create new application)
  // Endi multipart/form-data qabul qilinadi: ariza bilan birga ota-ona ma'lumotlari,
  // email/telefon va hujjat fayllari (pasport, 3x4 rasm, metrika, ID karta, zagran pasport) yuboriladi.
  app.post('/api/applications', authMiddleware, uploadApplicationDocs, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const {
        universityId, program,
        fatherName, fatherPhone, motherName, motherPhone,
        contactEmail, contactPhone
      } = req.body;

      if (!universityId || !program) {
        return res.status(400).json({ error: 'Universitet va Dastur tanlanishi shart' });
      }
      if (!contactEmail || !contactPhone) {
        return res.status(400).json({ error: 'Email va aloqa telefon raqami kiritilishi shart' });
      }

      const { rows: uniRows } = await pool.query('SELECT * FROM universities WHERE id = $1', [universityId]);
      if (uniRows.length === 0) {
        return res.status(404).json({ error: 'Universitet topilmadi' });
      }
      const uni = mapUniversityRow(uniRows[0]);

      const newId = 'app_' + Date.now();
      const today = new Date().toISOString().split('T')[0];

      await pool.query(
        `INSERT INTO applications
           (id, username, university_id, university_name, university_country, program, status, date,
            father_name, father_phone, mother_name, mother_phone, contact_email, contact_phone)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          newId, user.username, universityId, uni.name, uni.country, program, "🟡 Ko'rib chiqilyapti", today,
          fatherName || null, fatherPhone || null, motherName || null, motherPhone || null,
          contactEmail, contactPhone
        ]
      );

      await pool.query(
        `INSERT INTO application_history (application_id, status, date, note) VALUES ($1,$2,$3,$4)`,
        [newId, "🟡 Arizaga start berildi", today, 'Sizning arizangiz tizimda ro\'yxatga olindi va tez orada ko\'rib chiqiladi.']
      );

      // Yuklangan fayllarni (bo'lsa) application_documents jadvaliga saqlaymiz
      const files = (req.files || {}) as { [field: string]: Express.Multer.File[] };
      for (const { field, label } of APPLICATION_DOC_FIELDS) {
        const file = files[field]?.[0];
        if (!file) continue;
        const formattedSize = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
        await pool.query(
          `INSERT INTO application_documents (application_id, name, type, status, size, file_data, mime_type)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [newId, file.originalname, label, 'Yuklangan', formattedSize, file.buffer, file.mimetype]
        );
      }

      const apps = await getApplicationsForUser(user.username);
      const newApp = apps.find(a => a.id === newId);

      res.json({ success: true, application: newApp });
    } catch (err) {
      console.error('create application xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi' });
    }
  });

  // GET /applications/{id}
  app.get('/api/applications/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const apps = await getApplicationsForUser(user.username);
      const appItem = apps.find(a => a.id === req.params.id);
      if (!appItem) {
        return res.status(404).json({ error: 'Ariza topilmadi' });
      }
      res.json(appItem);
    } catch (err) {
      console.error('application by id xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi' });
    }
  });

  // POST /documents/upload — fayl to'g'ridan-to'g'ri PostgreSQL'ga (BYTEA) yoziladi, diskka emas
  app.post('/api/documents/upload', authMiddleware, upload.single('file'), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!req.file) {
        return res.status(400).json({ error: 'Yuklash uchun fayl tanlanmagan' });
      }

      const fileType = req.body.type || 'Boshqa hujjat';
      const formattedSize = (req.file.size / (1024 * 1024)).toFixed(2) + ' MB';

      const { rows } = await pool.query(
        `INSERT INTO documents (username, name, type, size, status, file_data, mime_type)
         VALUES ($1,$2,$3,$4,'Tasdiqlangan',$5,$6)
         RETURNING id, name, type, size, status, ('/api/documents/file/' || id) AS url`,
        [user.username, req.file.originalname, fileType, formattedSize, req.file.buffer, req.file.mimetype]
      );

      res.json({ success: true, document: rows[0] });
    } catch (err) {
      console.error('document upload xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi' });
    }
  });

  // GET /documents/file/:id — faylning o'zini bazadan o'qib, brauzerga qaytaradi.
  // Authorization header topilmasa, ?auth=TOKEN query orqali ham ruxsat beriladi
  // (chunki <a href> va <img src> orqali ochilganda header yubora olmaymiz).
  app.get('/api/documents/file/:id', async (req: Request, res: Response) => {
    try {
      const headerToken = req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : null;
      const queryToken = typeof req.query.auth === 'string' ? req.query.auth : null;
      const token = headerToken || queryToken;
      if (!token) {
        return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
      }
      const requester = await getUserByUsername(token);
      if (!requester) {
        return res.status(401).json({ error: 'Noto\'g\'ri seans' });
      }

      const { rows } = await pool.query(
        'SELECT username, name, mime_type, file_data FROM documents WHERE id = $1',
        [req.params.id]
      );
      const doc = rows[0];
      if (!doc || !doc.file_data) {
        return res.status(404).json({ error: 'Fayl topilmadi' });
      }
      if (requester.role !== 'admin' && requester.username !== doc.username) {
        return res.status(403).json({ error: 'Ushbu faylni ko\'rishga ruxsatingiz yo\'q' });
      }

      res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.name)}"`);
      res.send(doc.file_data);
    } catch (err) {
      console.error('document file xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi' });
    }
  });

  // GET /application-documents/file/:id — ariza bilan birga yuklangan hujjatni
  // (pasport, 3x4 rasm, metrika, ID karta, zagran pasport) bazadan o'qib qaytaradi.
  // Xuddi /api/documents/file/:id kabi ?auth=TOKEN orqali ham ochilishi mumkin.
  app.get('/api/application-documents/file/:id', async (req: Request, res: Response) => {
    try {
      const headerToken = req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : null;
      const queryToken = typeof req.query.auth === 'string' ? req.query.auth : null;
      const token = headerToken || queryToken;
      if (!token) {
        return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
      }
      const requester = await getUserByUsername(token);
      if (!requester) {
        return res.status(401).json({ error: 'Noto\'g\'ri seans' });
      }

      const { rows } = await pool.query(
        `SELECT ad.name, ad.mime_type, ad.file_data, a.username
         FROM application_documents ad
         JOIN applications a ON a.id = ad.application_id
         WHERE ad.id = $1`,
        [req.params.id]
      );
      const doc = rows[0];
      if (!doc || !doc.file_data) {
        return res.status(404).json({ error: 'Fayl topilmadi' });
      }
      if (requester.role !== 'admin' && requester.username !== doc.username) {
        return res.status(403).json({ error: 'Ushbu faylni ko\'rishga ruxsatingiz yo\'q' });
      }

      res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.name)}"`);
      res.send(doc.file_data);
    } catch (err) {
      console.error('application document file xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi' });
    }
  });

  // GET /documents
  app.get('/api/documents', authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { rows } = await pool.query(
        `SELECT id, name, type, size, status, ('/api/documents/file/' || id) AS url
         FROM documents WHERE username = $1 ORDER BY created_at DESC`,
        [user.username]
      );
      res.json(rows);
    } catch (err) {
      console.error('get documents xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi' });
    }
  });

  // --- ADMIN ENDPOINTS ---

  // GET /api/admin/students
  app.get('/api/admin/students', authMiddleware, async (req: Request, res: Response) => {
    try {
      const admin = (req as any).user;
      if (admin.role !== 'admin') {
        return res.status(403).json({ error: 'Sizda ushbu sahifaga kirish huquqi yo\'q' });
      }
      const { rows } = await pool.query(
        `SELECT username, password, first_name AS "firstName", last_name AS "lastName", phone, budget, ielts_score::float8 AS ielts_score,
                has_ielts, gpa::float8 AS gpa, has_gpa, onboarding_completed, avatar_url AS "avatarUrl",
                telegram_chat_id, last_login_ip, role
         FROM users WHERE role != 'admin' ORDER BY created_at DESC`
      );
      res.json(rows);
    } catch (err) {
      console.error('admin students xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi' });
    }
  });

  // GET /api/admin/applications
  app.get('/api/admin/applications', authMiddleware, async (req: Request, res: Response) => {
    try {
      const admin = (req as any).user;
      if (admin.role !== 'admin') {
        return res.status(403).json({ error: 'Sizda ushbu sahifaga kirish huquqi yo\'q' });
      }

      res.json(await getApplicationsForUser(null));
    } catch (err) {
      console.error('admin applications xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi' });
    }
  });

  // PATCH /api/admin/applications/:id
  app.patch('/api/admin/applications/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
      const admin = (req as any).user;
      if (admin.role !== 'admin') {
        return res.status(403).json({ error: 'Sizda ushbu sahifaga kirish huquqi yo\'q' });
      }

      const { status, note } = req.body;
      const appId = req.params.id;

      const { rows: existing } = await pool.query('SELECT * FROM applications WHERE id = $1', [appId]);
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Ariza topilmadi' });
      }

      const currentStatus = existing[0].status;
      const finalStatus = status || currentStatus;

      if (status) {
        await pool.query('UPDATE applications SET status = $1 WHERE id = $2', [status, appId]);
      }

      const today = new Date().toISOString().split('T')[0];
      await pool.query(
        `INSERT INTO application_history (application_id, status, date, note) VALUES ($1,$2,$3,$4)`,
        [appId, finalStatus, today, note || `Ariza holati o'zgartirildi: ${status}`]
      );

      const { rows: history } = await pool.query(
        `SELECT status, date::text AS date, note FROM application_history WHERE application_id = $1 ORDER BY created_at DESC`,
        [appId]
      );
      const { rows: docs } = await pool.query(
        `SELECT name, type, status FROM application_documents WHERE application_id = $1`,
        [appId]
      );

      res.json({
        success: true,
        application: {
          id: appId,
          universityId: existing[0].university_id,
          universityName: existing[0].university_name,
          program: existing[0].program,
          status: finalStatus,
          date: existing[0].date,
          history,
          documents: docs,
        },
      });
    } catch (err) {
      console.error('admin patch application xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi' });
    }
  });

  // GET /api/admin/documents
  app.get('/api/admin/documents', authMiddleware, async (req: Request, res: Response) => {
    try {
      const admin = (req as any).user;
      if (admin.role !== 'admin') {
        return res.status(403).json({ error: 'Sizda ushbu sahifaga kirish huquqi yo\'q' });
      }

      const { rows } = await pool.query(
        `SELECT id, name, type, size, status, ('/api/documents/file/' || id) AS url, username FROM documents ORDER BY created_at DESC`
      );
      res.json(rows);
    } catch (err) {
      console.error('admin documents xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi' });
    }
  });

  // PATCH /api/admin/documents/:username/:docName
  app.patch('/api/admin/documents/:username/:docName', authMiddleware, async (req: Request, res: Response) => {
    try {
      const admin = (req as any).user;
      if (admin.role !== 'admin') {
        return res.status(403).json({ error: 'Sizda ushbu sahifaga kirish huquqi yo\'q' });
      }

      const { username, docName } = req.params;
      const { status } = req.body;

      const { rows } = await pool.query(
        `UPDATE documents SET status = $1 WHERE username = $2 AND name = $3
         RETURNING id, name, type, size, status, ('/api/documents/file/' || id) AS url`,
        [status, username, docName]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Hujjat topilmadi' });
      }

      res.json({ success: true, document: rows[0] });
    } catch (err) {
      console.error('admin patch document xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi' });
    }
  });

  // GET /api/admin/universities
  app.get('/api/admin/universities', authMiddleware, async (req: Request, res: Response) => {
    try {
      const admin = (req as any).user;
      if (admin.role !== 'admin') {
        return res.status(403).json({ error: 'Sizda ushbu sahifaga kirish huquqi yo\'q' });
      }
      const list = await getAllUniversities();
      res.json(list);
    } catch (err) {
      console.error('admin universities xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi' });
    }
  });

  // POST /api/admin/universities — admin yangi universitet qo'shadi
  app.post('/api/admin/universities', authMiddleware, async (req: Request, res: Response) => {
    try {
      const admin = (req as any).user;
      if (admin.role !== 'admin') {
        return res.status(403).json({ error: 'Sizda ushbu sahifaga kirish huquqi yo\'q' });
      }

      const { name, country, logo, budget, ielts, gpa, grantInfo, programs, description } = req.body;
      if (!name || !country) {
        return res.status(400).json({ error: 'Universitet nomi va davlat kiritilishi shart' });
      }

      const newId = 'uni_' + Date.now();
      const programsArray = Array.isArray(programs) ? programs : (programs ? [programs] : ['Bakalavr']);

      const { rows } = await pool.query(
        `INSERT INTO universities (id, name, country, logo, budget, ielts, gpa, grant_info, programs, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          newId,
          name.trim(),
          country.trim(),
          logo || '🏫',
          budget ? Number(budget) : 5000,
          ielts ? Number(ielts) : 0,
          gpa ? Number(gpa) : 0,
          grantInfo || 'Ma\'lumot yo\'q',
          programsArray,
          description || ''
        ]
      );

      // Keshni yangilash
      (globalThis as any).__universitiesCache = await getAllUniversities();

      res.json({ success: true, university: mapUniversityRow(rows[0]) });
    } catch (err) {
      console.error('admin add university xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi' });
    }
  });

  // DELETE /api/admin/universities/:id
  app.delete('/api/admin/universities/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
      const admin = (req as any).user;
      if (admin.role !== 'admin') {
        return res.status(403).json({ error: 'Sizda ushbu sahifaga kirish huquqi yo\'q' });
      }
      await pool.query('DELETE FROM universities WHERE id = $1', [req.params.id]);
      (globalThis as any).__universitiesCache = await getAllUniversities();
      res.json({ success: true });
    } catch (err) {
      console.error('admin delete university xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi' });
    }
  });

  // POST /ai/chat
  app.post('/api/ai/chat', authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Xabar matni bo\'sh bo\'lishi mumkin emas' });
      }

      // Chat tarixini bazadan olamiz
      const { rows: historyRows } = await pool.query(
        `SELECT role, message FROM chat_messages WHERE username = $1 ORDER BY created_at ASC`,
        [user.username]
      );

      // Foydalanuvchi xabarini saqlaymiz
      await pool.query(
        `INSERT INTO chat_messages (username, role, message) VALUES ($1, 'user', $2)`,
        [user.username, message]
      );

      const userBudget = user.budget ? `$${Number(user.budget).toLocaleString()}` : 'No budget configured';
      const userIelts = user.has_ielts ? `IELTS Score: ${user.ielts_score}` : 'No IELTS certificate';
      const userGpa = user.has_gpa ? `GPA: ${user.gpa}` : 'No GPA configured';

      const apps = await getApplicationsForUser(user.username);
      const appSummary = apps.map(a => `${a.universityName} (${a.program}) - Status: ${a.status}`).join(', ') || 'No active applications yet.';

      const { rows: docs } = await pool.query(
        `SELECT name, type, status FROM documents WHERE username = $1`,
        [user.username]
      );
      const docsSummary = docs.map(d => `${d.type}: ${d.name} (${d.status})`).join(', ') || 'No documents uploaded yet.';

      const universities = await getAllUniversities();

      const contextPrompt = `
        Siz EduVisa kompaniyasining premium AI Konsultantisiz.
        Foydalanuvchi haqida quyidagi ma'lumotlar bor:
        - Ism: ${user.firstName} ${user.lastName}
        - Byudjet: ${userBudget}
        - IELTS: ${userIelts}
        - GPA: ${userGpa}
        - Arizalar holati: ${appSummary}
        - Hujjatlar holati: ${docsSummary}

        Universitetlar ro'yxati (siz tavsiya qilishingiz mumkin bo'lgan real universitetlar):
        ${JSON.stringify(universities)}

        Qoidalar:
        1. Siz foydalanuvchiga faqat uning profili (byudjet, IELTS, GPA), arizalari va hujjatlariga asoslangan professional va aniq javoblar berishingiz kerak.
        2. Hech qachon "100% qabul qilinasiz" yoki mutlaq kafolatlar bermang. Buning o'rniga "Hozirgi ma'lumotlaringiz asosida tayyorgarligingiz yaxshi ko'rinmoqda" deb ehtiyotkorona va professional javob bering.
        3. Savolga javob berganda ehtiyotkor til ishlating. Agar savol murakkab yoki noaniq bo'lsa, "Bu savol bo'yicha EduVisa konsultanti bilan bog'lanishni tavsiya qilaman" deb maslahat bering va foydalanuvchini pastdagi telegram tugmasi orqali bog'lanishga undang.
        4. Har doim o'zbek tilida javob bering. Javobingiz premium, aniq va do'stona bo'lsin. Shuningdek, foydalanuvchining keyingi harakatiga turtki beradigan amaliy "Keyingi qadam" (Next steps) taklif qiling.
        5. Chat tarixiga qarang. Sizning javobingiz qisqa, tushunarli va 2-3 ta gapdan iborat bo'lsin.
      `;

      let aiReply = '';

      if (ai) {
        try {
          // Chat tarixini OpenAI'ning messages formatiga o'giramiz
          const formattedHistory: { role: 'user' | 'assistant'; content: string }[] = historyRows.map(h => ({
            role: h.role === 'user' ? 'user' : 'assistant',
            content: h.message,
          }));

          const completion = await ai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: contextPrompt },
              ...formattedHistory,
              { role: 'user', content: message },
            ],
          });

          aiReply = completion.choices[0]?.message?.content || 'Kechirasiz, javob tayyorlashda xatolik yuz berdi. Iltimos qayta urinib ko\'ring.';
        } catch (err: any) {
          console.error('OpenAI API call error (Chat Completions API):', err);
          aiReply = getSimulatedResponse(message, user, apps, docs);
        }
      } else {
        await new Promise(r => setTimeout(r, 1000));
        aiReply = getSimulatedResponse(message, user, apps, docs);
      }

      // AI javobini saqlaymiz
      await pool.query(
        `INSERT INTO chat_messages (username, role, message) VALUES ($1, 'model', $2)`,
        [user.username, aiReply]
      );

      res.json({ success: true, reply: aiReply });
    } catch (err) {
      console.error('ai chat xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi (AI chat)' });
    }
  });

  // Simulated AI responses based on common keywords
  function getSimulatedResponse(message: string, user: any, apps: any[], docs: any[]) {
    const msg = message.toLowerCase();

    if (msg.includes('mos') || msg.includes('universitet') || msg.includes('tavsiya') || msg.includes('grant')) {
      const budgetLimit = user.budget || 20000;
      const cache = (globalThis as any).__universitiesCache || [];
      const matching = cache.filter((u: any) => u.budget <= budgetLimit && (user.ielts_score === null || u.ielts <= (user.ielts_score || 0)));
      if (matching.length > 0) {
        const uniNames = matching.slice(0, 3).map((u: any) => u.name).join(', ');
        return `Sizning IELTS (${user.ielts_score || 'Yo\'q'}) va byudjetingiz (${user.budget ? '$' + user.budget : 'Hali belgilanmagan'}) bo'yicha eng mos variantlar: ${uniNames}. Hozirgi ma'lumotlaringiz asosida ushbu universitetlarga tayyorgarligingiz yaxshi ko'rinmoqda. Arizalarni boshlaymizmi?`;
      }
      return `Sizga Germaniyaning Technical University Munich ($1,500/y, kontrakt pulsiz) va Janubiy Koreyaning Hanyang University ($7,000/y) kabi nufuzli universitetlarni o'rganishni taklif qilaman. Sizning ko'rsatkichlaringiz juda yaxshi.`;
    }

    if (msg.includes('hujjat') || msg.includes('pasport') || msg.includes('diplom') || msg.includes('sertifikat')) {
      if (docs.length === 0) {
        return `Hali hech qanday hujjat yuklamagansiz. Arizangizni ko'rib chiqishimiz uchun "Hujjatlarim" bo'limida Pasport va IELTS sertifikatingizni yuklashingizni maslahat beraman. Bu borada savol tug'ilsa, professional konsultantimiz bilan bog'laning.`;
      }
      return `Hozirda tizimda ${docs.length} ta hujjatingiz mavjud. Ularning hammasi tasdiqlangan holatda turibdi. Agar pasportingiz yoki IELTS sertifikatingiz muddati tugayotgan bo'lsa, qayta yuklashingiz kerak bo'ladi.`;
    }

    if (msg.includes('ariza') || msg.includes('status') || msg.includes('bosqich')) {
      if (apps.length === 0) {
        return `Sizda hali faol arizalar mavjud emas. "Universitetlar" bo'limiga kirib o'zingizga ma'qul oliygohni tanlang va arizangizni boshlang!`;
      }
      const pendingApp = apps.find((a: any) => a.status.includes('🟡'));
      if (pendingApp) {
        return `Sizning ${pendingApp.universityName} (${pendingApp.program}) universitetiga topshirgan arizangiz hozirda ko'rib chiqilmoqda. Status o'zgarishi bilan sizga bildirishnoma yuboriladi.`;
      }
      return `Sizning barcha arizalaringiz statusi muvaffaqiyatli yakunlangan. Oxirgi yangiliklar uchun profilingizni va bildirishnomalarni kuzatib boring.`;
    }

    return `Salom ${user.firstName}! Men sizning shaxsiy EduVisa AI konsultantingizman. Sizga universitetlarni tanlash, grantlar topish, arizalaringiz statusini tekshirish yoki hujjatlarni to'g'ri topshirishda yordam berishim mumkin. Qanday savolingiz bor?`;
  }

  // GET /ai/chat/history
  app.get('/api/ai/chat/history', authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { rows } = await pool.query(
        `SELECT role, message, created_at AS timestamp FROM chat_messages WHERE username = $1 ORDER BY created_at ASC`,
        [user.username]
      );
      res.json(rows);
    } catch (err) {
      console.error('chat history xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi' });
    }
  });

  // POST /notifications/register-token
  app.post('/api/notifications/register-token', authMiddleware, (req: Request, res: Response) => {
    res.json({ success: true, message: 'Notification token successfully registered' });
  });

  // Clear chat history
  app.post('/api/ai/chat/clear', authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      await pool.query('DELETE FROM chat_messages WHERE username = $1', [user.username]);
      res.json({ success: true });
    } catch (err) {
      console.error('clear chat xatolik:', err);
      res.status(500).json({ error: 'Server xatoligi' });
    }
  });

  // Kichik keshni yangilab turamiz - simulyatsiya javoblarida universitet nomlarini tez ko'rsatish uchun
  (globalThis as any).__universitiesCache = await getAllUniversities();

  // Serve static files and handle routing in production, serve Vite dev server in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware integrated.');
  } else {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`EduVisa Full-Stack Server running at http://0.0.0.0:${port}`);
  });
}

main().catch(err => {
  console.error('Fatal server startup error:', err);
});
