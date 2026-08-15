/* ============================================================
   FEEL — supabase-client.js

   عبّي هون بيانات مشروعك من Supabase Dashboard > Project Settings > API:
   - Project URL
   - anon public key

   هاد المفتاحين آمن ينكشفوا بالفرونت إند (هيك Supabase مصمم) —
   الحماية الحقيقية موجودة بسياسات RLS جوا schema.sql.
   ============================================================ */

const SUPABASE_URL = 'https://wqbfpjavrnjizrbbsihz.supabase.co/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYmZwamF2cm5qaXpyYmJzaWh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1NTA1NjQsImV4cCI6MjEwMjEyNjU2NH0.dzageIYTQAnxS7Km5G77xnUWKj2JZKq8ypuKIXCI2Ro';

if (SUPABASE_URL.includes('YOUR-PROJECT-REF') || SUPABASE_ANON_KEY.includes('YOUR-ANON')) {
  console.warn('⚠️ لسا ما عبّيت بيانات Supabase في supabase-client.js — راجع ملف SETUP.md');
}

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,   // يخلي الجلسة محفوظة بالمتصفح — ما بتحتاج تسجّل دخول كل مرة
    autoRefreshToken: true, // يجدّد الجلسة تلقائيًا قبل ما تنتهي صلاحيتها
    detectSessionInUrl: true,
  },
});

// مفتاح VAPID العام (آمن يكون هون — هيك بروتوكول Web Push مصمم أصلًا)
const VAPID_PUBLIC_KEY = 'BClaSitxc6OiQkbcTa2i5m59Rc5nufDl5zgK9XZxcqMD9YScwd8YWTjcjk1xirL-Gww-PSEJmHSxRW7NMy6LaqM';
