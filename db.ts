import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// MUAMMO (FIX): Avval barcha ma'lumotlar server xotirasida (Map) saqlanardi,
// server qayta ishga tushganda (restart) barcha ma'lumot o'chib ketardi.
// Endi PostgreSQL orqali doimiy (persistent) saqlanadi.
if (!process.env.DATABASE_URL) {
  console.warn(
    '[DB OGOHLANTIRISH] .env faylida DATABASE_URL topilmadi. ' +
    'PostgreSQL ulanishi ishlamaydi. .env.example fayliga qarang.'
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Ko'pchilik hosting provayderlari (Render, Railway, Neon, Supabase) SSL talab qiladi.
  // Lokal Windows'dagi PostgreSQL uchun buni "false" qoldiring (.env da DB_SSL=false).
  ssl:
    process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false,
});

pool.on('error', (err) => {
  // Pool ichidagi kutilmagan (idle client) xatoliklarni ushlab, serverni yiqilishdan saqlaydi.
  console.error('[DB XATOLIK] Kutilmagan PostgreSQL pool xatoligi:', err);
});

// Yordamchi funksiya: har bir so'rovni log qilish va xatolikni aniqroq ko'rsatish uchun
export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[] }> {
  try {
    const result = await pool.query(text, params);
    return { rows: result.rows };
  } catch (err: any) {
    console.error('[DB QUERY XATOLIK]', { text, params, message: err.message });
    throw err;
  }
}

// Serverni ishga tushirishdan oldin bazaga ulanishni tekshirish uchun
export async function testConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    console.log('[DB] PostgreSQL bilan ulanish muvaffaqiyatli o\'rnatildi.');
    return true;
  } catch (err: any) {
    console.error('[DB] PostgreSQL bilan ulanib bo\'lmadi:', err.message);
    return false;
  }
}
