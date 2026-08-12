-- ============================================================
-- FEEL — schema.sql
-- شغّل هاد الملف كامل في Supabase Dashboard > SQL Editor > New query
-- (انسخ كل الملف والصقه واضغط Run)
-- ============================================================

-- ---------- الإضافات المطلوبة ----------
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1) profiles — بروفايل كل مستخدم (مرتبط بـ auth.users من Supabase Auth)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_emoji text not null default '🙂',
  avatar_color text not null default '#8B5CF6',
  is_admin boolean not null default false,
  is_banned boolean not null default false,
  ban_reason text,
  tips_received int not null default 0,
  tips_given int not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 2) user_feeling_xp — XP كل مستخدم بكل شعور (يبلّش من صفر تلقائيًا)
-- ============================================================
create table public.user_feeling_xp (
  user_id uuid references public.profiles(id) on delete cascade,
  feeling_id text not null,
  xp int not null default 0,
  primary key (user_id, feeling_id)
);

-- ============================================================
-- 3) questions
-- ============================================================
create table public.questions (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid references public.profiles(id) on delete cascade,
  feeling_id text not null,
  text text not null,
  likes_count int not null default 0,
  created_at timestamptz not null default now()
);

create table public.question_likes (
  question_id uuid references public.questions(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  primary key (question_id, user_id)
);

-- تتبّع الأسئلة الي المستخدم شافها (عشان تنزل للماضي وما تتكرر بالأول)
create table public.question_seen (
  question_id uuid references public.questions(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (question_id, user_id)
);

-- ============================================================
-- 4) answers
-- ============================================================
create table public.answers (
  id uuid primary key default uuid_generate_v4(),
  question_id uuid references public.questions(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete cascade,
  text text not null,
  likes_count int not null default 0,
  created_at timestamptz not null default now()
);

create table public.answer_likes (
  answer_id uuid references public.answers(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  primary key (answer_id, user_id)
);

-- ============================================================
-- 5) tips
-- ============================================================
create table public.tips (
  id uuid primary key default uuid_generate_v4(),
  answer_id uuid references public.answers(id) on delete cascade,
  from_user_id uuid references public.profiles(id) on delete cascade,
  tip_type text not null check (tip_type in ('small','good','great','epic')),
  xp int not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 6) posts (صفحة الكوتيشن / الاقتباسات) + تعليقات + لايكات
-- ============================================================
create table public.posts (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid references public.profiles(id) on delete cascade,
  text text not null,
  likes_count int not null default 0,
  created_at timestamptz not null default now()
);

create table public.post_likes (
  post_id uuid references public.posts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  primary key (post_id, user_id)
);

create table public.post_comments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid references public.posts(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 7) notifications
-- ============================================================
create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  icon text not null,
  text text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- دالة مساعدة: هل المستخدم الحالي أدمن؟ (تُستخدم بسياسات RLS)
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- دالة مساعدة: هل المستخدم الحالي محظور؟
create or replace function public.is_banned()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select is_banned from public.profiles where id = auth.uid()), false);
$$;

-- ============================================================
-- تفعيل RLS على كل الجداول
-- ============================================================
alter table public.profiles enable row level security;
alter table public.user_feeling_xp enable row level security;
alter table public.questions enable row level security;
alter table public.question_likes enable row level security;
alter table public.question_seen enable row level security;
alter table public.answers enable row level security;
alter table public.answer_likes enable row level security;
alter table public.tips enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.notifications enable row level security;

-- ---------- profiles ----------
create policy "الجميع يقدر يشوف البروفايلات" on public.profiles
  for select using (true);

create policy "المستخدم يعدّل بروفايله بس (بدون صلاحيات الأدمن)" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id and is_admin = (select is_admin from public.profiles where id = auth.uid()) and is_banned = (select is_banned from public.profiles where id = auth.uid()));

create policy "الأدمن يقدر يعدّل أي بروفايل (بان/فك بان)" on public.profiles
  for update using (public.is_admin());

create policy "إنشاء البروفايل عند التسجيل" on public.profiles
  for insert with check (auth.uid() = id);

-- ---------- user_feeling_xp ----------
create policy "الجميع يقدر يشوف الـXP" on public.user_feeling_xp
  for select using (true);
create policy "إدخال XP ابتدائي للمستخدم الجديد" on public.user_feeling_xp
  for insert with check (auth.uid() = user_id);
create policy "تحديث XP لأي مستخدم (يصير من عمليات التطبيق)" on public.user_feeling_xp
  for update using (auth.uid() is not null and not public.is_banned());

-- ---------- questions ----------
create policy "الجميع يقدر يشوف الأسئلة" on public.questions
  for select using (true);
create policy "مستخدم مسجّل وغير محظور يقدر ينشر سؤال" on public.questions
  for insert with check (auth.uid() = author_id and not public.is_banned());
create policy "تحديث عدد اللايكات على السؤال" on public.questions
  for update using (auth.uid() is not null and not public.is_banned());
create policy "الأدمن يقدر يحذف أي سؤال" on public.questions
  for delete using (public.is_admin() or auth.uid() = author_id);

-- ---------- question_likes ----------
create policy "الجميع يشوف اللايكات" on public.question_likes for select using (true);
create policy "مستخدم يلايك سؤال" on public.question_likes
  for insert with check (auth.uid() = user_id and not public.is_banned());
create policy "مستخدم يشيل لايكه" on public.question_likes
  for delete using (auth.uid() = user_id);

-- ---------- question_seen ----------
create policy "المستخدم يشوف الأسئلة الي شافها" on public.question_seen
  for select using (auth.uid() = user_id);
create policy "المستخدم يسجّل إنه شاف سؤال" on public.question_seen
  for insert with check (auth.uid() = user_id);

-- ---------- answers ----------
create policy "الجميع يقدر يشوف الإجابات" on public.answers for select using (true);
create policy "مستخدم غير محظور يقدر يجاوب" on public.answers
  for insert with check (auth.uid() = author_id and not public.is_banned());
create policy "تحديث عدد لايكات الإجابة" on public.answers
  for update using (auth.uid() is not null and not public.is_banned());
create policy "الأدمن أو صاحب الإجابة يقدر يحذفها" on public.answers
  for delete using (public.is_admin() or auth.uid() = author_id);

-- ---------- answer_likes ----------
create policy "الجميع يشوف لايكات الإجابات" on public.answer_likes for select using (true);
create policy "مستخدم يلايك إجابة" on public.answer_likes
  for insert with check (auth.uid() = user_id and not public.is_banned());
create policy "مستخدم يشيل لايكه عن إجابة" on public.answer_likes
  for delete using (auth.uid() = user_id);

-- ---------- tips ----------
create policy "الجميع يشوف الـ Tips" on public.tips for select using (true);
create policy "صاحب السؤال بس يقدر يرسل Tip" on public.tips
  for insert with check (auth.uid() = from_user_id and not public.is_banned());

-- ---------- posts (الكوتيشن) ----------
create policy "الجميع يشوف البوستات" on public.posts for select using (true);
create policy "مستخدم غير محظور ينشر بوست" on public.posts
  for insert with check (auth.uid() = author_id and not public.is_banned());
create policy "تحديث عدد لايكات البوست" on public.posts
  for update using (auth.uid() is not null and not public.is_banned());
create policy "الأدمن أو صاحب البوست يحذفه" on public.posts
  for delete using (public.is_admin() or auth.uid() = author_id);

-- ---------- post_likes ----------
create policy "الجميع يشوف لايكات البوستات" on public.post_likes for select using (true);
create policy "مستخدم يلايك بوست" on public.post_likes
  for insert with check (auth.uid() = user_id and not public.is_banned());
create policy "مستخدم يشيل لايكه عن بوست" on public.post_likes
  for delete using (auth.uid() = user_id);

-- ---------- post_comments ----------
create policy "الجميع يشوف التعليقات" on public.post_comments for select using (true);
create policy "مستخدم غير محظور يعلّق" on public.post_comments
  for insert with check (auth.uid() = author_id and not public.is_banned());
create policy "الأدمن أو صاحب التعليق يحذفه" on public.post_comments
  for delete using (public.is_admin() or auth.uid() = author_id);

-- ---------- notifications ----------
create policy "المستخدم يشوف إشعاراته بس" on public.notifications
  for select using (auth.uid() = user_id);
create policy "إنشاء إشعار لأي مستخدم (من عمليات التطبيق)" on public.notifications
  for insert with check (auth.uid() is not null);
create policy "المستخدم يعلّم إشعاره كمقروء" on public.notifications
  for update using (auth.uid() = user_id);

-- ============================================================
-- Trigger: عند تسجيل مستخدم جديد بـ Supabase Auth، أنشئ بروفايل
-- تلقائيًا + صفوف XP بصفر لكل الشعور (بداية من الصفر تمامًا)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  feeling_ids text[] := array['love','trust','happiness','sadness','empathy','hope',
    'tenderness','passion','calmness','anger','forgiveness','appreciation',
    'loneliness','fear','nostalgia','inner-strength','general'];
  fid text;
begin
  insert into public.profiles (id, username, display_name, avatar_emoji, avatar_color)
  values (
    new.id,
    lower(new.raw_user_meta_data->>'username'),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username'),
    coalesce(new.raw_user_meta_data->>'avatar_emoji', '🙂'),
    coalesce(new.raw_user_meta_data->>'avatar_color', '#8B5CF6')
  );

  foreach fid in array feeling_ids loop
    insert into public.user_feeling_xp (user_id, feeling_id, xp) values (new.id, fid, 0);
  end loop;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- دالة: تسجيل الدخول باسم المستخدم بدل الإيميل
-- بترجع الإيميل المرتبط باسم المستخدم بس (بدون أي بيانات تانية)
-- عشان الواجهة تقدر تستخدمه مع Supabase Auth (الي بده إيميل)
-- ============================================================
create or replace function public.email_for_username(p_username text)
returns text
language sql
security definer
set search_path = public, auth
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(p.username) = lower(p_username)
  limit 1;
$$;

grant execute on function public.email_for_username(text) to anon, authenticated;

-- ============================================================
-- دالة: للأدمن بس — قائمة كل المستخدمين مع الإيميل (بدون كلمة المرور،
-- كلمة المرور غير موجودة أصلًا بشكل قابل للقراءة، Supabase يشفّرها)
-- ============================================================
create or replace function public.admin_list_users()
returns table (
  id uuid,
  username text,
  display_name text,
  email text,
  is_admin boolean,
  is_banned boolean,
  ban_reason text,
  tips_received int,
  tips_given int,
  created_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
  select p.id, p.username, p.display_name, u.email, p.is_admin, p.is_banned,
         p.ban_reason, p.tips_received, p.tips_given, p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_admin()
  order by p.created_at desc;
$$;

grant execute on function public.admin_list_users() to authenticated;

-- ============================================================
-- دالة: للأدمن بس — بان / فك بان لحساب
-- ============================================================
create or replace function public.admin_set_ban(p_user_id uuid, p_banned boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'غير مصرح: هاد الإجراء للأدمن بس';
  end if;
  update public.profiles
  set is_banned = p_banned,
      ban_reason = case when p_banned then p_reason else null end
  where id = p_user_id;
end;
$$;

grant execute on function public.admin_set_ban(uuid, boolean, text) to authenticated;

-- ============================================================
-- RPCs ذرّية (atomic) للايكات والـ Tips — تمنع تعارض العدّادات
-- ============================================================
create or replace function public.toggle_question_like(p_question_id uuid)
returns table (liked boolean, likes_count int)
language plpgsql security definer set search_path = public
as $$
declare v_liked boolean; v_count int;
begin
  if public.is_banned() then raise exception 'حسابك محظور'; end if;
  if exists (select 1 from question_likes where question_id = p_question_id and user_id = auth.uid()) then
    delete from question_likes where question_id = p_question_id and user_id = auth.uid();
    update questions set likes_count = greatest(0, likes_count - 1) where id = p_question_id returning questions.likes_count into v_count;
    v_liked := false;
  else
    insert into question_likes(question_id, user_id) values (p_question_id, auth.uid());
    update questions set likes_count = likes_count + 1 where id = p_question_id returning questions.likes_count into v_count;
    v_liked := true;
  end if;
  return query select v_liked, v_count;
end;
$$;
grant execute on function public.toggle_question_like(uuid) to authenticated;

create or replace function public.toggle_answer_like(p_answer_id uuid)
returns table (liked boolean, likes_count int)
language plpgsql security definer set search_path = public
as $$
declare v_liked boolean; v_count int;
begin
  if public.is_banned() then raise exception 'حسابك محظور'; end if;
  if exists (select 1 from answer_likes where answer_id = p_answer_id and user_id = auth.uid()) then
    delete from answer_likes where answer_id = p_answer_id and user_id = auth.uid();
    update answers set likes_count = greatest(0, likes_count - 1) where id = p_answer_id returning answers.likes_count into v_count;
    v_liked := false;
  else
    insert into answer_likes(answer_id, user_id) values (p_answer_id, auth.uid());
    update answers set likes_count = likes_count + 1 where id = p_answer_id returning answers.likes_count into v_count;
    v_liked := true;
  end if;
  return query select v_liked, v_count;
end;
$$;
grant execute on function public.toggle_answer_like(uuid) to authenticated;

create or replace function public.toggle_post_like(p_post_id uuid)
returns table (liked boolean, likes_count int)
language plpgsql security definer set search_path = public
as $$
declare v_liked boolean; v_count int;
begin
  if public.is_banned() then raise exception 'حسابك محظور'; end if;
  if exists (select 1 from post_likes where post_id = p_post_id and user_id = auth.uid()) then
    delete from post_likes where post_id = p_post_id and user_id = auth.uid();
    update posts set likes_count = greatest(0, likes_count - 1) where id = p_post_id returning posts.likes_count into v_count;
    v_liked := false;
  else
    insert into post_likes(post_id, user_id) values (p_post_id, auth.uid());
    update posts set likes_count = likes_count + 1 where id = p_post_id returning posts.likes_count into v_count;
    v_liked := true;
  end if;
  return query select v_liked, v_count;
end;
$$;
grant execute on function public.toggle_post_like(uuid) to authenticated;

-- ============================================================
-- RPC: إرسال Tip — يتحقق من كل الشروط، يحدّث XP، ويرجع القيم القديمة/الجديدة
-- ============================================================
create or replace function public.send_tip(p_answer_id uuid, p_tip_type text)
returns table (old_xp int, new_xp int, feeling_id text)
language plpgsql security definer set search_path = public
as $$
declare
  v_xp int;
  v_answer record;
  v_question record;
  v_old_xp int;
  v_new_xp int;
begin
  if public.is_banned() then raise exception 'حسابك محظور'; end if;

  v_xp := case p_tip_type
    when 'small' then 10 when 'good' then 25
    when 'great' then 50 when 'epic' then 100
    else null end;
  if v_xp is null then raise exception 'نوع Tip غير صالح'; end if;

  select * into v_answer from answers where id = p_answer_id;
  if v_answer is null then raise exception 'الإجابة غير موجودة'; end if;

  select * into v_question from questions where id = v_answer.question_id;
  if v_question.author_id <> auth.uid() then
    raise exception 'صاحب السؤال بس يقدر يرسل Tip على إجاباته';
  end if;
  if v_answer.author_id = auth.uid() then
    raise exception 'ما بتقدر ترسل Tip لنفسك';
  end if;
  if exists (select 1 from tips where answer_id = p_answer_id) then
    raise exception 'في Tip مرسَل على هاي الإجابة أصلًا';
  end if;

  insert into tips(answer_id, from_user_id, tip_type, xp) values (p_answer_id, auth.uid(), p_tip_type, v_xp);

  select xp into v_old_xp from user_feeling_xp where user_id = v_answer.author_id and feeling_id = v_question.feeling_id;
  v_old_xp := coalesce(v_old_xp, 0);
  v_new_xp := v_old_xp + v_xp;

  insert into user_feeling_xp (user_id, feeling_id, xp) values (v_answer.author_id, v_question.feeling_id, v_new_xp)
  on conflict (user_id, feeling_id) do update set xp = v_new_xp;

  update profiles set tips_received = tips_received + 1 where id = v_answer.author_id;
  update profiles set tips_given = tips_given + 1 where id = auth.uid();

  insert into notifications (user_id, icon, text)
  select v_answer.author_id,
    case p_tip_type when 'small' then '💡' when 'good' then '❤️' when 'great' then '✨' else '🏆' end,
    (select display_name from profiles where id = auth.uid()) || ' أرسل لإجابتك تقدير ' ||
    (case p_tip_type when 'small' then 'مفيدة' when 'good' then 'مؤثرة' when 'great' then 'قوية' else 'غيّرت حياتي' end) || '.';

  return query select v_old_xp, v_new_xp, v_question.feeling_id;
end;
$$;
grant execute on function public.send_tip(uuid, text) to authenticated;

-- ============================================================
-- فهارس لتسريع الاستعلامات الشائعة
-- ============================================================
create index idx_questions_feeling on public.questions(feeling_id);
create index idx_questions_created on public.questions(created_at desc);
create index idx_answers_question on public.answers(question_id);
create index idx_posts_created on public.posts(created_at desc);
create index idx_post_comments_post on public.post_comments(post_id);
create index idx_notifications_user on public.notifications(user_id, is_read);

-- ============================================================
-- بعد تشغيل هاد الملف:
-- 1) سجّل حساب عادي من صفحة التسجيل بالموقع.
-- 2) رجع هون ونفّذ السطر التالي (غيّر الإيميل لإيميلك) عشان
--    تحوّل حسابك لأدمن:
--
--    update public.profiles set is_admin = true
--    where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');
--
-- ============================================================
