// Bu skript bazani "0" dan tayyorlaydi:
// 1) schema.sql dagi jadvallarni yaratadi
// 2) Universitetlar ro'yxatini yuklaydi (agar bo'sh bo'lsa)
// 3) Demo talaba va admin foydalanuvchini yaratadi (agar mavjud bo'lmasa)
//
// Ishga tushirish: npm run db:init

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { pool, testConnection } from '../db';

dotenv.config();

// package.json da "type": "module" bo'lgani uchun __dirname mavjud emas - shu tarzda hosil qilamiz
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const universities = [
  {
    id: 'u1', name: 'University of London', country: 'Buyuk Britaniya', logo: '🇬🇧',
    budget: 12000, ielts: 6.5, gpa: 4.0, grantInfo: '45% gacha grant imkoniyati',
    programs: ['Moliya va Bank', 'Biznes boshqaruvi', 'Iqtisodiyot', 'Kompyuter elmlari'],
    description: 'Buyuk Britaniyaning eng nufuzli universitetlaridan biri bo\'lib, jahon miqyosida tan olingan ta\'lim dasturlarini taqdim etadi.'
  },
  {
    id: 'u2', name: 'Tsinghua University', country: 'Xitoy', logo: '🇨🇳',
    budget: 4500, ielts: 6.5, gpa: 4.5, grantInfo: 'Full Grant (Barcha xarajatlar qoplanadi)',
    programs: ['Sun\'iy Intellekt', 'Xalqaro munosabatlar', 'Yadro muhandisligi', 'Dasturlash'],
    description: 'Xitoy va Osiyoning 1-raqamli nufuzli universiteti. Dunyo reytingida kuchli o\'nlikka kiradi.'
  },
  {
    id: 'u3', name: 'Hanyang University', country: 'Janubiy Koreya', logo: '🇰🇷',
    budget: 7000, ielts: 6.0, gpa: 3.5, grantInfo: 'Part-time grant (30%-50% kontrakt chegirma)',
    programs: ['Mexatronika', 'Koreys tili va madaniyati', 'Kino va Rejissyorlik', 'IT Menejment'],
    description: 'Janubiy Koreyaning yetakchi xususiy tadqiqot universiteti bo\'lib, texnika va IT sohasida kuchli.'
  },
  {
    id: 'u4', name: 'Monash University', country: 'Avstraliya', logo: '🇦🇺',
    budget: 15000, ielts: 7.0, gpa: 4.2, grantInfo: 'Iqtidorli talabalar uchun $10,000 grant',
    programs: ['Tibbiyot', 'Farmatsevtika', 'Arxitektura', 'Data Science'],
    description: 'Avstraliyaning nufuzli "Group of Eight" guruhiga kiruvchi eng yirik oliygohi.'
  },
  {
    id: 'u5', name: 'Technical University Munich', country: 'Germaniya', logo: '🇩🇪',
    budget: 1500, ielts: 7.5, gpa: 4.5, grantInfo: 'No Tuition (Kontrakt pulisiz, bepul ta\'lim)',
    programs: ['Mashinasozlik', 'Informatika', 'Robototexnika', 'Fizika'],
    description: 'Yevropaning eng kuchli texnika universitetlaridan biri. Ta\'lim mutlaqo bepul, faqat semestr badali to\'lanadi.'
  },
  {
    id: 'u6', name: 'Yonsei University', country: 'Janubiy Koreya', logo: '🇰🇷',
    budget: 8500, ielts: 6.5, gpa: 3.8, grantInfo: 'Global liderlik granti (100% gacha)',
    programs: ['Xalqaro Biznes (Underwood)', 'Biomuharrirlik', 'Iqtisodiyot'],
    description: 'Koreyaning eng mashhur "SKY" universitetlari uchligiga kiruvchi elita ta\'lim muassasasi.'
  },
  {
    id: 'u7', name: 'National University of Singapore', country: 'Singapur', logo: '🇸🇬',
    budget: 18000, ielts: 7.0, gpa: 4.8, grantInfo: 'Singapur hukumati granti (A-star)',
    programs: ['Kvant hisoblashlari', 'Moliya muhandisligi', 'Arxitektura'],
    description: 'Osiyodagi eng nufuzli universitet, jahon miqyosidagi tadqiqot va innovatsiyalar markazi.'
  },
];

async function run() {
  console.log('=== EduVisa DB Init boshlandi ===');

  const ok = await testConnection();
  if (!ok) {
    console.error('Bazaga ulanib bo\'lmadi. .env dagi DATABASE_URL ni tekshiring.');
    process.exit(1);
  }

  // 1) Sxema (jadvallar)
  const schemaPath = path.resolve(__dirname, '..', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  console.log('[1/3] Jadvallar yaratilmoqda (schema.sql)...');
  await pool.query(schemaSql);
  console.log('    ✔ Jadvallar tayyor.');

  // 2) Universitetlar
  console.log('[2/3] Universitetlar tekshirilmoqda...');
  const { rows: uniCountRows } = await pool.query('SELECT COUNT(*)::int AS count FROM universities');
  if (uniCountRows[0].count === 0) {
    for (const u of universities) {
      await pool.query(
        `INSERT INTO universities (id, name, country, logo, budget, ielts, gpa, grant_info, programs, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO NOTHING`,
        [u.id, u.name, u.country, u.logo, u.budget, u.ielts, u.gpa, u.grantInfo, JSON.stringify(u.programs), u.description]
      );
    }
    console.log(`    ✔ ${universities.length} ta universitet qo'shildi.`);
  } else {
    console.log(`    ⏭ Universitetlar allaqachon mavjud (${uniCountRows[0].count} ta), o'tkazib yuborildi.`);
  }

  // 3) Demo foydalanuvchilar (talaba + admin)
  console.log('[3/3] Demo foydalanuvchilar tekshirilmoqda...');

  const { rows: existingDemo } = await pool.query('SELECT username FROM users WHERE username = $1', ['aziz_karimov']);
  if (existingDemo.length === 0) {
    await pool.query(
      `INSERT INTO users (username, password, first_name, last_name, phone, budget, ielts_score, has_ielts, gpa, has_gpa, onboarding_completed, telegram_chat_id, last_login_ip, role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      ['aziz_karimov', 'Xk9mPq2T', 'Aziz', 'Karimov', '+998901234567', 6000, 7.5, true, 4.8, true, true, '998124', '127.0.0.1', 'student']
    );

    await pool.query(`INSERT INTO interests (username, university_id) VALUES ($1,$2), ($1,$3)`, ['aziz_karimov', 'u1', 'u2']);

    const app1Id = 'app_1';
    const app2Id = 'app_2';
    await pool.query(
      `INSERT INTO applications (id, username, university_id, university_name, program, status, date)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [app1Id, 'aziz_karimov', 'u1', 'University of London', 'Moliya va Bank', "🟡 Ko'rib chiqilyapti", '2026-06-12']
    );
    await pool.query(
      `INSERT INTO application_history (application_id, status, date, note) VALUES ($1,$2,$3,$4)`,
      [app1Id, "🟡 Arizaga start berildi", '2026-06-12', 'Ariza tizimga muvaffaqiyatli qabul qilindi.']
    );
    await pool.query(
      `INSERT INTO application_documents (application_id, name, type, status) VALUES ($1,$2,$3,$4), ($1,$5,$6,$7)`,
      [app1Id, 'passport.pdf', 'Pasport', 'Tasdiqlangan', 'ielts_certificate.pdf', 'IELTS Sertifikati', 'Tasdiqlangan']
    );

    await pool.query(
      `INSERT INTO applications (id, username, university_id, university_name, program, status, date)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [app2Id, 'aziz_karimov', 'u6', 'Yonsei University', 'Xalqaro Biznes (Underwood)', "🟢 Tasdiqlangan / Qabul qilingan", '2026-06-05']
    );
    await pool.query(
      `INSERT INTO application_history (application_id, status, date, note) VALUES
        ($1,$2,$3,$4), ($1,$5,$6,$7)`,
      [app2Id, "🟡 Ko'rib chiqilyapti", '2026-06-05', 'Hujjatlar elchixona darajasida tekshirilmoqda.',
       "🟢 Tasdiqlangan", '2026-06-20', 'Universitet sizga rasmiy taklifnoma yubordi! Tabriklaymiz!']
    );
    await pool.query(
      `INSERT INTO application_documents (application_id, name, type, status) VALUES ($1,$2,$3,$4), ($1,$5,$6,$7)`,
      [app2Id, 'passport.pdf', 'Pasport', 'Tasdiqlangan', 'diplom_va_ilova.pdf', 'Diplom / Attestat', 'Tasdiqlangan']
    );

    await pool.query(
      `INSERT INTO documents (username, name, type, size, status, url) VALUES
        ($1,$2,$3,$4,$5,$6), ($1,$7,$8,$9,$5,$10), ($1,$11,$12,$13,$5,$14)`,
      ['aziz_karimov',
       'passport.pdf', 'Pasport', '1.2 MB', 'Tasdiqlangan', '#',
       'ielts_certificate.pdf', 'IELTS Sertifikati', '850 KB', '#',
       'diplom_va_ilova.pdf', 'Diplom / Attestat', '2.4 MB', '#']
    );

    await pool.query(
      `INSERT INTO chat_messages (username, role, message) VALUES ($1,$2,$3)`,
      ['aziz_karimov', 'model', "Salom Aziz! Siz uchun 3 ta ajoyib grant dasturlarini topdim. Ko'rib chiqamizmi?"]
    );

    console.log('    ✔ Demo talaba (aziz_karimov / Xk9mPq2T) yaratildi.');
  } else {
    console.log('    ⏭ Demo talaba allaqachon mavjud, o\'tkazib yuborildi.');
  }

  const { rows: existingAdmin } = await pool.query('SELECT username FROM users WHERE username = $1', ['admin']);
  if (existingAdmin.length === 0) {
    await pool.query(
      `INSERT INTO users (username, password, first_name, last_name, phone, onboarding_completed, role)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      ['admin', 'admin123', 'Tizim', 'Administratori', '+998909999999', true, 'admin']
    );
    console.log('    ✔ Admin (admin / admin123) yaratildi.');
  } else {
    console.log('    ⏭ Admin allaqachon mavjud, o\'tkazib yuborildi.');
  }

  console.log('=== Tayyor! Baza to\'liq sozlandi. ===');
  await pool.end();
}

run().catch((err) => {
  console.error('DB init xatolik bilan tugadi:', err);
  process.exit(1);
});
