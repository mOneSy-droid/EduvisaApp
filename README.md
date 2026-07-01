<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/d0461c5a-69a7-4765-ba8e-698abed81525

## Run Locally

**Prerequisites:**  Node.js, PostgreSQL (lokal yoki bulutda: Render/Railway/Neon/Supabase)

1. Install dependencies:
   `npm install`
2. `.env.example` faylidan nusxa olib `.env` deb saqlang, so'ng ichidagi qiymatlarni to'ldiring:
   - `OPENAI_API_KEY` — OpenAI API kalitingiz (bo'lmasa AI simulyatsiya rejimida ishlaydi)
   - `DATABASE_URL` — PostgreSQL bazangizga ulanish manzili
   - `DB_SSL` — lokal baza uchun `false`, bulutdagi baza uchun odatda `true`
3. Bazani tayyorlash (jadvallarni yaratadi va demo ma'lumotlarni yuklaydi):
   `npm run db:init`
4. Serverni ishga tushirish:
   `npm run dev`

### Telegram bot orqali ro'yxatdan o'tish
Ro'yxatdan o'tish sahifasidagi "Telegram orqali ro'yxatdan o'tish" haqiqiy Telegram bot bilan ishlaydi:
1. [@BotFather](https://t.me/BotFather) orqali yangi bot yarating va tokenini oling.
2. `.env` fayliga qo'shing: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` (bot foydalanuvchi nomi, @ belgisiz).
3. Admin bildirishnomalari uchun o'z Telegram chat ID'ingizni [@userinfobot](https://t.me/userinfobot) orqali oling va `TELEGRAM_ADMIN_CHAT_ID` ga qo'shing.
4. Server ishga tushganda bot avtomatik long-polling rejimida ishlay boshlaydi (qo'shimcha buyruq shart emas).
5. Oqim: foydalanuvchi formani to'ldiradi → hisob serverda darhol yaratiladi → "Telegram botni ochish" tugmasi bosilsa, bot `/start` payload'ini o'qib foydalanuvchiga username/parolni DM orqali yuboradi va sizga (adminga) IP manzili bilan birga bildirishnoma keladi. Foydalanuvchi shu tugma o'rniga "Shu qurilmada avtomatik kirish" tugmasini bossa, parolni qo'lda kiritmasdan darhol tizimga kiradi.
6. `TELEGRAM_BOT_TOKEN` bo'sh qoldirilsa, bot ishga tushmaydi — faqat avtomatik kirish yo'li ishlaydi.

Demo login: `aziz_karimov` / `Xk9mPq2T` (talaba), `admin` / `admin123` (admin panel).

### PostgreSQL bilan bog'liq muhim eslatmalar
- Barcha foydalanuvchilar, arizalar, hujjat metama'lumotlari va AI chat tarixi endi PostgreSQL'da saqlanadi — server qayta ishga tushsa ham ma'lumot yo'qolmaydi.
- Yuklangan fayllarning o'zi hali ham `uploads/` papkasida (diskda) saqlanadi, faqat fayl haqidagi ma'lumot (nomi, turi, havolasi) bazada.
- `npm run db:init` xavfsiz — uni bir necha marta ishga tushirsangiz ham mavjud ma'lumotlarni qayta yozib yubormaydi (faqat bo'sh joylarni to'ldiradi).
