/* ============================================================
   FEEL — supabase-client.js

   عبّي هون بيانات مشروعك من Supabase Dashboard > Project Settings > API:
   - Project URL
   - anon public key

   هاد المفتاحين آمن ينكشفوا بالفرونت إند (هيك Supabase مصمم) —
   الحماية الحقيقية موجودة بسياسات RLS جوا schema.sql.
   ============================================================ */

const SUPABASE_URL = 'https://https://wqbfpjavrnjizrbbsihz.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'sb_publishable_G-Iss2BrP_Wsrdy7QBZrLQ_nh7zghRP';

if (SUPABASE_URL.includes('YOUR-PROJECT-REF') || SUPABASE_ANON_KEY.includes('YOUR-ANON')) {
  console.warn('⚠️ لسا ما عبّيت بيانات Supabase في supabase-client.js — راجع ملف SETUP.md');
}

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
