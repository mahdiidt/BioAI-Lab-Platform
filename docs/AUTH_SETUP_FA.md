# راه‌اندازی لاگین/ثبت‌نام (Supabase) — راهنما

این پیاده‌سازی کاملاً client-side است و به هیچ بک‌اند اضافه‌ای نیاز ندارد؛ فقط یک پروژه‌ی رایگان Supabase لازم است.

## ۱) ساخت پروژه در Supabase

1. به [supabase.com](https://supabase.com) بروید و یک پروژه‌ی رایگان جدید بسازید.
2. در Dashboard پروژه: **Project Settings -> API** را باز کنید.
3. دو مقدار زیر را کپی کنید:
   - **Project URL**
   - **anon public key**

## ۲) اجرای اسکیمای دیتابیس

1. در Dashboard: **SQL Editor -> New query**.
2. کل محتوای فایل `docs/supabase/schema.sql` را کپی و اجرا (Run) کنید.
3. این کار یک جدول `profiles` می‌سازد که هر کاربر جدید به‌صورت خودکار در آن یک ردیف با `plan = 'free'` می‌گیرد — همین فیلد `plan` بعداً برای اشتراک/پولی‌سازی استفاده می‌شود.

## ۳) تنظیم متغیرهای محیطی برای اجرای لوکال

فایل `.env.example` را کپی کنید به `.env.local` و مقادیر واقعی را جایگزین کنید:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxx
```

سپس `npm run dev` را اجرا کنید. دکمه‌ی "Sign In" باید در بالای صفحه کار کند.

> نکته: `anon key` برای استفاده در فرانت‌اند امن است — امنیت واقعی داده‌ها را Row Level Security (RLS) که در schema.sql تنظیم شده تضمین می‌کند، نه مخفی بودن این کلید.

## ۴) تنظیم برای دیپلوی روی GitHub Pages

چون سایت روی GitHub Actions build می‌شود، باید این دو مقدار را به‌صورت **Secrets** در ریپازیتوری گیت‌هاب اضافه کنید (نه در کد):

1. در گیت‌هاب: **Settings -> Secrets and variables -> Actions -> New repository secret**
2. دو Secret بسازید:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

فایل `.github/workflows/deploy.yml` از قبل طوری آپدیت شده که این دو Secret را در مرحله‌ی build به Vite پاس می‌دهد. بعد از اضافه‌کردن Secrets، فقط یک push جدید (یا Run workflow دستی) کافی است تا نسخه‌ی زنده هم لاگین را فعال داشته باشد.

## ۵) تنظیمات اختیاری در Supabase Auth

در Dashboard: **Authentication -> Providers -> Email**:
- می‌توانید "Confirm email" را روشن/خاموش کنید (پیش‌فرض روشن است؛ یعنی کاربر بعد از ثبت‌نام باید ایمیلش را تأیید کند).
- در **Authentication -> URL Configuration**، آدرس سایت (`https://mahdiidt.github.io/BioAI-Lab-Platform/`) را به‌عنوان Site URL اضافه کنید تا لینک تأیید ایمیل درست کار کند.

## اگر env vars تنظیم نشده باشند

سایت به‌طور کامل کار می‌کند (همه‌ی ۳۰ ابزار)، فقط دکمه‌ی Sign In/Sign Up یک پیام دوستانه نشان می‌دهد که "هنوز فعال نشده" — هیچ خطایی سایت را نمی‌شکند. این عمداً طوری طراحی شده که دیپلوی فعلی زنده هیچ‌وقت خراب نشود.

## آماده‌سازی برای اشتراک/پولی‌سازی در آینده

- ستون `plan` در جدول `profiles` از همین الان وجود دارد (`free` پیش‌فرض).
- وقتی خواستید یک ابزار یا قابلیت را محدود به کاربران پولی کنید، کافی‌ست در کامپوننت مربوطه از `useAuth()` مقدار `profile?.plan` را بخوانید.
- اتصال واقعی پرداخت (مثلاً Stripe) و آپدیت خودکار `plan` از طریق Webhook، یک مرحله‌ی جدا و بعدی است — ساختار داده الان برایش آماده است.
