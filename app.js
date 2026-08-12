/* ============================================================
   FEEL — app.js (النسخة الأونلاين مع Supabase)
   ============================================================ */

const AppState = {
  route: 'home',
  feelingFilter: 'all',
  questionsScope: 'all', // 'all' | 'mine'
  activeFeelingId: null,
  activeQuestionId: null,
  tipContext: null,
  askDefaultFeeling: null,
  searchQuery: '',
  profile: null,
  xpMap: {},
  seenQuestionIds: new Set(),
  likedQuestionIds: new Set(),
  likedAnswerIds: new Set(),
  likedPostIds: new Set(),
  selectedAvatar: null,
  channels: { notifications: null, questions: null, posts: null, answers: null, comments: null, xp: null },
};

document.addEventListener('DOMContentLoaded', async () => {
  applyTheme(localStorage.getItem('feel_theme') || 'light');
  buildAvatarPicker();
  bindStaticEvents();

  const session = await DB.getSession();
  if (session) {
    const ok = await loadCurrentUserContext();
    if (ok) { enterApp(); return; }
  }
  showAuth();
});

/* ============================================================
   AUTH
   ============================================================ */
function showAuth() {
  document.getElementById('view-auth').classList.remove('hidden');
  document.getElementById('app-shell').classList.add('hidden');
  tryAutofillSavedCredential();
  renderSavedAccountsBox();
}

async function tryAutofillSavedCredential() {
  try {
    if (!navigator.credentials || !window.PasswordCredential) return;
    const cred = await navigator.credentials.get({ password: true, mediation: 'optional' });
    if (cred && cred.type === 'password') {
      document.getElementById('login-username').value = cred.id;
      document.getElementById('login-password').value = cred.password;
    }
  } catch (e) { /* تجاهل بهدوء */ }
}

/* ============================================================
   تبديل الحساب — يحفظ جلسات الحسابات على هالجهاز بدون كلمات مرور
   ============================================================ */
const SAVED_ACCOUNTS_KEY = 'feel_saved_accounts';

function loadSavedAccounts() {
  try { return JSON.parse(localStorage.getItem(SAVED_ACCOUNTS_KEY) || '[]'); }
  catch (e) { return []; }
}
function persistSavedAccounts(list) {
  localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(list));
}
function upsertSavedAccount(profile, session) {
  if (!session || !session.refresh_token) return;
  const list = loadSavedAccounts().filter(a => a.user_id !== profile.id);
  list.unshift({
    user_id: profile.id, username: profile.username, display_name: profile.display_name,
    avatar_emoji: profile.avatar_emoji, avatar_color: profile.avatar_color,
    access_token: session.access_token, refresh_token: session.refresh_token,
  });
  persistSavedAccounts(list.slice(0, 5)); // أقصى 5 حسابات محفوظة
}
function forgetSavedAccount(userId) {
  persistSavedAccounts(loadSavedAccounts().filter(a => a.user_id !== userId));
  renderSavedAccountsBox();
}

function renderSavedAccountsBox() {
  const box = document.getElementById('saved-accounts-box');
  const list = document.getElementById('saved-accounts-list');
  const accounts = loadSavedAccounts().filter(a => !AppState.profile || a.user_id !== AppState.profile.id);
  if (!accounts.length) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  list.innerHTML = accounts.map(a => `
    <button type="button" class="saved-account-chip" data-action="switch-account" data-uid="${a.user_id}">
      <span class="avatar avatar-sm" style="background:${a.avatar_color}22;">${a.avatar_emoji}</span>
      <span class="saved-account-name">${escapeHtml(a.display_name)}<br><span class="saved-account-username">@${escapeHtml(a.username)}</span></span>
      <span class="saved-account-forget" data-action="forget-account" data-uid="${a.user_id}" title="نسيان هذا الحساب">✕</span>
    </button>
  `).join('');
}

async function switchToAccount(userId) {
  const account = loadSavedAccounts().find(a => a.user_id === userId);
  if (!account) return;
  showToast('🔄', 'جاري التبديل...');
  const { data, error } = await sb.auth.setSession({ access_token: account.access_token, refresh_token: account.refresh_token });
  if (error || !data.session) {
    showToast('🚫', 'انتهت صلاحية هالحساب، لازم تسجّل دخول فيه من جديد.');
    forgetSavedAccount(userId);
    return;
  }
  upsertSavedAccount({ id: account.user_id, username: account.username, display_name: account.display_name, avatar_emoji: account.avatar_emoji, avatar_color: account.avatar_color }, data.session);
  const ok = await loadCurrentUserContext();
  if (!ok) { showToast('🚫', 'صار في خطأ بالتبديل.'); return; }
  enterApp();
  showToast('👋', `رجعت لحساب ${AppState.profile.display_name}.`);
}

async function openAccountSwitcher() {
  teardownGlobalRealtime();
  await sb.auth.signOut({ scope: 'local' }); // يسكر الجلسة الحالية بس من هالجهاز، بدون ما يمسحها من قائمة الحسابات المحفوظة
  AppState.profile = null;
  showAuth();
}

async function enterApp() {
  document.getElementById('view-auth').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
  document.getElementById('admin-nav-link').classList.toggle('hidden', !(AppState.profile && AppState.profile.is_admin));
  navigateTo('home');
  setupGlobalRealtime();
}

/* ============================================================
   REALTIME — تحديث مباشر بدون Refresh
   ============================================================ */
function setupGlobalRealtime() {
  teardownGlobalRealtime();
  if (!AppState.profile) return;

  AppState.channels.notifications = DB.subscribeToNotifications(AppState.profile.id, notif => {
    refreshNotifBadge();
    showToast(notif.icon, notif.text);
  });

  AppState.channels.questions = DB.subscribeToQuestions(debounce(() => {
    if (['home', 'feelings', 'feeling-detail', 'questions'].includes(AppState.route)) renderMain();
  }, 400));

  AppState.channels.posts = DB.subscribeToPosts(debounce(() => {
    if (AppState.route === 'posts') renderMain();
  }, 400));

  AppState.channels.xp = DB.subscribeToMyXp(AppState.profile.id, payload => {
    const row = payload.new;
    if (!row) return;
    const feelingId = row.feeling_id;
    const newXp = row.xp;
    const oldXp = AppState.xpMap[feelingId] || 0;
    if (newXp === oldXp) return;
    const beforeLevel = getLevelInfo(oldXp).level;
    const afterLevel = getLevelInfo(newXp).level;
    AppState.xpMap[feelingId] = newXp;

    if (afterLevel > beforeLevel) {
      DB.notify(AppState.profile.id, '✨', `وصلت للمستوى ${afterLevel} في ${FEELING_MAP[feelingId].name}.`);
      showLevelUp(feelingId, afterLevel);
    }
    if (['home', 'feelings', 'feeling-detail', 'profile'].includes(AppState.route)) renderMain();
  });
}

function teardownGlobalRealtime() {
  Object.keys(AppState.channels).forEach(key => {
    if (AppState.channels[key]) { DB.unsubscribe(AppState.channels[key]); AppState.channels[key] = null; }
  });
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function loadCurrentUserContext() {
  const profile = await DB.getMyProfile();
  if (!profile) return false;
  if (profile.is_banned) {
    await DB.signOut();
    showToast('🚫', 'هذا الحساب محظور: ' + (profile.ban_reason || 'مخالفة قواعد المجتمع.'));
    return false;
  }
  AppState.profile = profile;
  AppState.xpMap = await DB.fetchXpMap(profile.id);
  AppState.seenQuestionIds = await DB.fetchMySeenQuestionIds(profile.id);
  AppState.likedQuestionIds = await DB.fetchMyLikedQuestionIds(profile.id);
  AppState.likedAnswerIds = await DB.fetchMyLikedAnswerIds(profile.id);
  AppState.likedPostIds = await DB.fetchMyLikedPostIds(profile.id);
  return true;
}

function setBtnLoading(btn, loading, loadingText) {
  if (!btn) return;
  if (loading) { btn.dataset.label = btn.textContent; btn.textContent = loadingText || 'جاري التحميل...'; btn.disabled = true; }
  else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
}

async function handleLogin(e) {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  if (!username || !password) { errEl.textContent = 'عبّي اسم المستخدم وكلمة المرور.'; errEl.classList.remove('hidden'); return; }

  const btn = document.getElementById('login-submit-btn');
  setBtnLoading(btn, true, 'جاري الدخول...');
  const { data, error } = await DB.signInWithUsername(username, password);
  setBtnLoading(btn, false);

  if (error) { errEl.textContent = error.message; errEl.classList.remove('hidden'); return; }

  const ok = await loadCurrentUserContext();
  if (!ok) { errEl.textContent = 'صار في خطأ، جرب تاني.'; errEl.classList.remove('hidden'); return; }
  saveCredentialForBrowser(username, password, AppState.profile.display_name);
  upsertSavedAccount(AppState.profile, data.session);
  document.getElementById('login-form').reset();
  enterApp();
  showToast('👋', `أهلًا فيك، ${AppState.profile.display_name}.`);
}

async function handleSignup(e) {
  e.preventDefault();
  const errEl = document.getElementById('signup-error');
  const okEl = document.getElementById('signup-success');
  errEl.classList.add('hidden'); okEl.classList.add('hidden');

  const username = document.getElementById('signup-username').value.trim().toLowerCase();
  const displayName = document.getElementById('signup-displayname').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    errEl.textContent = 'اسم المستخدم لازم يكون 3-20 حرف/رقم إنجليزي بدون مسافات.'; errEl.classList.remove('hidden'); return;
  }
  if (!displayName) { errEl.textContent = 'اكتب الاسم الظاهر.'; errEl.classList.remove('hidden'); return; }
  if (!email.includes('@')) { errEl.textContent = 'اكتب إيميل صحيح.'; errEl.classList.remove('hidden'); return; }
  if (password.length < 6) { errEl.textContent = 'كلمة المرور لازم تكون 6 أحرف على الأقل.'; errEl.classList.remove('hidden'); return; }
  if (!AppState.selectedAvatar) { errEl.textContent = 'اختر أفاتار.'; errEl.classList.remove('hidden'); return; }

  const btn = document.getElementById('signup-submit-btn');
  setBtnLoading(btn, true, 'جاري إنشاء الحساب...');
  const { data, error } = await DB.signUp({
    username, email, password, displayName,
    avatarEmoji: AppState.selectedAvatar.emoji, avatarColor: AppState.selectedAvatar.color,
  });
  setBtnLoading(btn, false);

  if (error) { errEl.textContent = translateAuthError(error.message); errEl.classList.remove('hidden'); return; }

  if (data.session) {
    const ok = await loadCurrentUserContext();
    if (ok) {
      saveCredentialForBrowser(username, password, AppState.profile.display_name);
      upsertSavedAccount(AppState.profile, data.session);
      enterApp();
      showToast('🎉', 'تم إنشاء حسابك! أهلًا فيك بـ FEEL.');
      return;
    }
  }
  okEl.textContent = 'تم إنشاء الحساب! تحقق من إيميلك لتفعيل الحساب، وبعدين سجّل دخول.';
  okEl.classList.remove('hidden');
  document.getElementById('signup-form').reset();
  switchAuthTab('login');
}

/* ---------- حفظ بيانات الدخول بمدير كلمات المرور تبع المتصفح ---------- */
async function saveCredentialForBrowser(username, password, displayName) {
  try {
    if (!window.PasswordCredential) return; // المتصفح ما بيدعم الميزة (متصفحات مبنية على Chromium بتدعمها)
    const cred = new PasswordCredential({ id: username, password, name: displayName || username });
    await navigator.credentials.store(cred);
  } catch (e) { /* تجاهل بهدوء — مش ميزة أساسية */ }
}

function translateAuthError(msg) {
  if (/already registered|already exists/i.test(msg)) return 'هذا الإيميل مسجّل مسبقًا.';
  if (/password/i.test(msg)) return 'كلمة المرور غير صالحة (6 أحرف على الأقل).';
  return msg || 'صار في خطأ، جرب تاني.';
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('signup-form').classList.toggle('hidden', tab !== 'signup');
}

function buildAvatarPicker() {
  const container = document.getElementById('avatar-picker');
  container.innerHTML = AVATAR_OPTIONS.map((a, i) => `
    <button type="button" class="avatar-option" data-idx="${i}" style="background:${a.color}22;">${a.emoji}</button>
  `).join('');
  container.addEventListener('click', e => {
    const btn = e.target.closest('.avatar-option');
    if (!btn) return;
    AppState.selectedAvatar = AVATAR_OPTIONS[+btn.dataset.idx];
    container.querySelectorAll('.avatar-option').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
}

async function logout() {
  teardownGlobalRealtime();
  if (AppState.profile) forgetSavedAccount(AppState.profile.id); // تسجيل الخروج الكامل بينسى الحساب من هالجهاز
  await DB.signOut();
  AppState.profile = null;
  showAuth();
}

/* ============================================================
   DELETE HANDLERS (owner or admin — RLS enforces this again server-side)
   ============================================================ */
async function deleteQuestionHandler(qid) {
  if (!confirm('متأكد إنك بدك تحذف هالسؤال؟ هالإجراء ما بينرجع.')) return;
  const { error } = await DB.deleteQuestion(qid);
  if (error) { showToast('🚫', 'ما قدرنا نحذف السؤال.'); return; }
  showToast('🗑', 'تم حذف السؤال.');
  if (AppState.activeQuestionId === qid) closeQuestionDetail();
  renderMain();
}
async function deleteAnswerHandler(aid) {
  if (!confirm('متأكد إنك بدك تحذف هالإجابة؟ هالإجراء ما بينرجع.')) return;
  const { error } = await DB.deleteAnswer(aid);
  if (error) { showToast('🚫', 'ما قدرنا نحذف الإجابة.'); return; }
  showToast('🗑', 'تم حذف الإجابة.');
  if (AppState.activeQuestionId) renderQuestionDetail();
}
async function deletePostHandler(pid) {
  if (!confirm('متأكد إنك بدك تحذف هالبوست؟ هالإجراء ما بينرجع.')) return;
  const { error } = await DB.deletePost(pid);
  if (error) { showToast('🚫', 'ما قدرنا نحذف البوست.'); return; }
  showToast('🗑', 'تم حذف البوست.');
  renderMain();
}
async function deleteCommentHandler(cid, pid) {
  if (!confirm('متأكد إنك بدك تحذف هالتعليق؟')) return;
  const { error } = await DB.deleteComment(cid);
  if (error) { showToast('🚫', 'ما قدرنا نحذف التعليق.'); return; }
  showToast('🗑', 'تم حذف التعليق.');
  renderComments(pid);
}

/* ============================================================
   ROUTER
   ============================================================ */
function navigateTo(route, params = {}) {
  if (route === 'admin' && !(AppState.profile && AppState.profile.is_admin)) return;
  AppState.route = route;
  Object.assign(AppState, params);
  renderMain();
  updateNavActive();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateNavActive() {
  document.querySelectorAll('.nav-link, .bottom-nav-btn').forEach(el => {
    const nav = el.dataset.nav;
    el.classList.toggle('active', nav && (nav === AppState.route || (nav === 'feelings' && AppState.route === 'feeling-detail')));
  });
  refreshNotifBadge();
}

async function renderMain() {
  const main = document.getElementById('main-content');
  main.innerHTML = `<div class="loading-spinner">جاري التحميل...</div>`;
  let html = '';
  try {
    switch (AppState.route) {
      case 'home': html = await renderHome(); break;
      case 'feelings': html = await renderFeelingsPage(); break;
      case 'feeling-detail': html = await renderFeelingDetail(AppState.activeFeelingId); break;
      case 'questions': html = await renderQuestionsPage(); break;
      case 'posts': html = await renderPostsPage(); break;
      case 'profile': html = await renderProfile(); break;
      case 'notifications': html = await renderNotifications(); break;
      case 'admin': html = await renderAdmin(); break;
      default: html = await renderHome();
    }
  } catch (err) {
    console.error(err);
    html = `<div class="empty-state"><div class="empty-state-emoji">⚠️</div><div class="empty-state-title">صار في خطأ بالتحميل</div><div class="empty-state-sub">تأكد إنك عبّيت بيانات Supabase بشكل صحيح بملف supabase-client.js</div></div>`;
  }
  main.innerHTML = `<div class="view-fade">${html}</div>`;
}

/* ============================================================
   HOME
   ============================================================ */
async function renderHome() {
  const profile = AppState.profile;
  const level = getLevelInfo(totalXpFromMap(AppState.xpMap));
  const topFeelings = [...FEELINGS].filter(f => !f.gradient)
    .sort((a, b) => (AppState.xpMap[b.id] || 0) - (AppState.xpMap[a.id] || 0)).slice(0, 4);

  const allQuestions = await DB.fetchQuestions();
  const worthAnswering = pickWorthAnswering(allQuestions).slice(0, 5);

  return `
    <section class="hero">
      <h1 class="hero-title">كيف بتتطور اليوم؟</h1>
      <p class="hero-sub">كل محادثة ممكن تعلّمك شي جديد عن نفسك.</p>
      <div class="user-card">
        <div class="avatar avatar-lg" style="background:${profile.avatar_color}22;">${profile.avatar_emoji}</div>
        <div class="user-card-info">
          <div class="user-card-name">${escapeHtml(profile.display_name)}</div>
          <div class="user-card-meta">المستوى ${level.level} · ${totalXpFromMap(AppState.xpMap).toLocaleString()} XP إجمالي</div>
        </div>
        <div class="user-card-stats">
          <div class="stat"><div class="stat-num">${level.level}</div><div class="stat-label">المستوى</div></div>
          <div class="stat"><div class="stat-num">${profile.tips_received}</div><div class="stat-label">تقديرات مستلمة</div></div>
        </div>
        <div class="progress-wrap">
          <div class="progress-labels"><span>المستوى ${level.level}</span><span>${level.xp.toLocaleString()} / ${level.isMax ? level.xp.toLocaleString() : level.max.toLocaleString()} XP</span></div>
          <div class="progress-track"><div class="progress-fill" style="width:${level.pct}%"></div></div>
        </div>
      </div>
    </section>

    <section>
      <div class="section-head">
        <div><h2 class="section-title">استكشف مشاعرك</h2><p class="section-sub">كل شعور مهارة بتنتظر إنك تفهمها.</p></div>
        <button class="btn btn-ghost btn-sm" data-nav="feelings">شوف كل الـ 17</button>
      </div>
      <div class="feelings-grid">${topFeelings.map(f => feelingCardHtml(f)).join('')}</div>
    </section>

    <section>
      <div class="section-head">
        <div><h2 class="section-title">أسئلة تستاهل جواب</h2><p class="section-sub">أسئلة حقيقية من ناس عم يفكروا بشي مهم.</p></div>
        <button class="btn btn-primary btn-sm" data-action="ask">اسأل شيئًا</button>
      </div>
      <div class="question-feed">${worthAnswering.map(q => questionCardHtml(q)).join('') || emptyStateHtml('home')}</div>
    </section>
  `;
}

function pickWorthAnswering(questions) {
  const scored = questions.map(q => ({ q, score: q.likes_count }));
  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.q);
}

/* ============================================================
   FEELINGS
   ============================================================ */
async function renderFeelingsPage() {
  return `
    <section class="section-head"><div><h1 class="section-title" style="font-size:1.9rem;">استكشف مشاعرك</h1><p class="section-sub">كل شعور مهارة بتنتظر إنك تفهمها.</p></div></section>
    <div class="feelings-grid">${FEELINGS.map(f => feelingCardHtml(f)).join('')}</div>
  `;
}

function feelingVars(feeling) {
  const c = feeling.gradient ? 'var(--brand-3)' : feeling.color;
  return `--fc:${c}; --fc-bg: color-mix(in srgb, ${c} 14%, var(--bg-elevated));`;
}

function feelingCardHtml(feeling) {
  const xp = AppState.xpMap[feeling.id] || 0;
  const info = getLevelInfo(xp);
  return `
    <button class="feeling-card" style="${feelingVars(feeling)}" data-action="open-feeling" data-feeling="${feeling.id}">
      <div class="feeling-card-top"><span class="feeling-emoji">${feeling.emoji}</span><span class="feeling-level-badge">Lv ${info.level}</span></div>
      <div class="feeling-name">${feeling.name}</div>
      <div class="feeling-desc">${feeling.desc}</div>
      <div class="feeling-card-progress"><div class="progress-track"><div class="progress-fill tinted" style="width:${info.pct}%"></div></div></div>
      <div class="feeling-card-xp"><span>${info.isMax ? info.xp.toLocaleString() : info.xp.toLocaleString() + ' / ' + info.max.toLocaleString()} XP</span></div>
    </button>
  `;
}

async function renderFeelingDetail(feelingId) {
  const feeling = FEELING_MAP[feelingId];
  if (!feeling) return renderFeelingsPage();
  const info = getLevelInfo(AppState.xpMap[feeling.id] || 0);
  const questions = await DB.fetchQuestions({ feelingId: feeling.id });
  const ordered = orderBySeenStatus(questions);

  return `
    <div class="feeling-hero" style="${feelingVars(feeling)}">
      <div class="feeling-hero-emoji">${feeling.emoji}</div>
      <h1 class="feeling-hero-name">${feeling.name}</h1>
      <p class="feeling-hero-tagline">${feeling.tagline}</p>
      <div class="feeling-hero-stats">
        <div class="stat"><div class="stat-num">${info.level}</div><div class="stat-label">المستوى الحالي</div></div>
        <div class="stat"><div class="stat-num">${info.xp.toLocaleString()}</div><div class="stat-label">XP</div></div>
        <div class="progress-wrap" style="flex:1; min-width:180px;">
          <div class="progress-labels"><span>المستوى ${info.level}</span><span>${info.isMax ? info.xp.toLocaleString() : info.xp.toLocaleString() + ' / ' + info.max.toLocaleString()}</span></div>
          <div class="progress-track"><div class="progress-fill tinted" style="width:${info.pct}%"></div></div>
        </div>
      </div>
    </div>
    <div class="section-head">
      <div><h2 class="section-title">أسئلة عن ${feeling.name}</h2></div>
      <button class="btn btn-primary btn-sm" data-action="ask" data-feeling="${feeling.id}">اسأل شيئًا</button>
    </div>
    <div class="question-feed">${ordered.map(q => questionCardHtml(q)).join('') || emptyStateHtml('feeling', feeling)}</div>
  `;
}

/* ============================================================
   QUESTIONS PAGE
   ============================================================ */
function orderBySeenStatus(questions) {
  const unseen = questions.filter(q => !AppState.seenQuestionIds.has(q.id));
  const seen = questions.filter(q => AppState.seenQuestionIds.has(q.id));
  unseen.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  seen.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return [...unseen, ...seen];
}

async function renderQuestionsPage() {
  const chips = ['all', ...FEELINGS.map(f => f.id)];
  const chipHtml = chips.map(c => {
    const label = c === 'all' ? 'الكل' : `${FEELING_MAP[c].emoji} ${FEELING_MAP[c].name}`;
    return `<button class="filter-chip ${AppState.feelingFilter === c ? 'active' : ''}" data-action="filter" data-filter="${c}">${label}</button>`;
  }).join('');

  let questions = await DB.fetchQuestions({
    feelingId: AppState.feelingFilter,
    authorId: AppState.questionsScope === 'mine' ? AppState.profile.id : null,
  });

  if (AppState.searchQuery.trim()) {
    const s = AppState.searchQuery.trim().toLowerCase();
    questions = questions.filter(q =>
      q.text.toLowerCase().includes(s) ||
      (q.author && q.author.display_name.toLowerCase().includes(s)) ||
      FEELING_MAP[q.feeling_id].name.toLowerCase().includes(s)
    );
  }

  const ordered = AppState.questionsScope === 'all' ? orderBySeenStatus(questions) : questions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return `
    <section class="section-head">
      <div><h1 class="section-title" style="font-size:1.9rem;">الأسئلة</h1><p class="section-sub">دوّر على مستخدمين، أسئلة، أو مشاعر.</p></div>
      <button class="btn btn-primary btn-sm" data-action="ask">اسأل شيئًا</button>
    </section>
    <div class="scope-toggle">
      <button class="scope-btn ${AppState.questionsScope === 'all' ? 'active' : ''}" data-action="scope" data-scope="all">كل الأسئلة</button>
      <button class="scope-btn ${AppState.questionsScope === 'mine' ? 'active' : ''}" data-action="scope" data-scope="mine">أسئلتي</button>
    </div>
    <div class="search-bar">
      <span class="search-icon">⌕</span>
      <input type="text" id="search-input" placeholder="دوّر عن مستخدمين، أسئلة، مشاعر..." value="${escapeHtml(AppState.searchQuery)}">
    </div>
    <div class="filter-row">${chipHtml}</div>
    <div class="question-feed">${ordered.map(q => questionCardHtml(q)).join('') || emptyStateHtml('search')}</div>
  `;
}

function questionCardHtml(q) {
  const feeling = FEELING_MAP[q.feeling_id];
  const author = q.author;
  const liked = AppState.likedQuestionIds.has(q.id);
  const isSeen = AppState.seenQuestionIds.has(q.id);
  const canDelete = AppState.profile && (AppState.profile.is_admin || q.author_id === AppState.profile.id);
  return `
    <article class="question-card ${isSeen ? 'seen' : ''}" data-action="open-question" data-qid="${q.id}">
      <div class="q-head">
        <div class="avatar avatar-sm" style="background:${author ? author.avatar_color : '#ccc'}22;">${author ? author.avatar_emoji : '🙂'}</div>
        <div>
          <div class="q-author-name">${author ? escapeHtml(author.display_name) : 'مستخدم محذوف'}</div>
          <div class="q-meta"><span>${timeAgo(q.created_at)}</span></div>
        </div>
        ${!isSeen ? '<span class="new-dot" title="لسا ما شفتها"></span>' : ''}
        <span class="q-spacer"></span>
        ${canDelete ? `<button class="delete-btn" data-action="delete-question" data-qid="${q.id}" title="حذف">🗑</button>` : ''}
      </div>
      <p class="q-text">${escapeHtml(q.text)}</p>
      <div class="q-footer">
        <span class="q-tag" style="${feelingVars(feeling)}">${feeling.emoji} ${feeling.name}</span>
        <span class="q-spacer"></span>
        <button class="icon-btn ${liked ? 'liked' : ''}" data-action="like-question" data-qid="${q.id}">♥ ${q.likes_count}</button>
      </div>
    </article>
  `;
}

function emptyStateHtml(context, feeling) {
  const copy = {
    home: { title: 'ما في أسئلة هون لسا.', sub: 'كون أول واحد يبلّش المحادثة.' },
    feeling: { title: `ما في أسئلة عن ${feeling ? feeling.name : 'هاد الشعور'} لسا.`, sub: 'كون أول واحد يبلّش المحادثة.' },
    search: { title: 'ما في نتائج.', sub: 'جرّب كلمة تانية، أو اسأل السؤال بنفسك.' },
  }[context] || { title: 'ما في أسئلة هون لسا.', sub: 'كون أول واحد يبلّش المحادثة.' };
  return `<div class="empty-state"><div class="empty-state-emoji">🌱</div><div class="empty-state-title">${copy.title}</div><div class="empty-state-sub">${copy.sub}</div><button class="btn btn-primary" data-action="ask">اسأل سؤال</button></div>`;
}

/* ============================================================
   QUESTION DETAIL
   ============================================================ */
async function openQuestionDetail(qid) {
  AppState.activeQuestionId = qid;
  document.getElementById('question-overlay').classList.remove('hidden');
  document.getElementById('question-detail-content').innerHTML = `<div class="loading-spinner">جاري التحميل...</div>`;
  await DB.markQuestionSeen(qid, AppState.profile.id);
  AppState.seenQuestionIds.add(qid);
  await renderQuestionDetail();

  if (AppState.channels.answers) DB.unsubscribe(AppState.channels.answers);
  AppState.channels.answers = DB.subscribeToAnswers(qid, debounce(() => {
    if (AppState.activeQuestionId === qid) renderQuestionDetail();
  }, 400));
}
function closeQuestionDetail() {
  document.getElementById('question-overlay').classList.add('hidden');
  AppState.activeQuestionId = null;
  if (AppState.channels.answers) { DB.unsubscribe(AppState.channels.answers); AppState.channels.answers = null; }
}

async function renderQuestionDetail() {
  const q = await DB.fetchQuestionById(AppState.activeQuestionId);
  const container = document.getElementById('question-detail-content');
  if (!q) { container.innerHTML = `<p>هاد السؤال ما عاد موجود.</p>`; return; }
  const feeling = FEELING_MAP[q.feeling_id];
  const answers = await DB.fetchAnswersForQuestion(q.id);
  const liked = AppState.likedQuestionIds.has(q.id);
  const canDeleteQ = AppState.profile && (AppState.profile.is_admin || q.author_id === AppState.profile.id);

  container.innerHTML = `
    <div class="qd-question">
      <div class="q-head">
        <div class="avatar avatar-sm" style="background:${q.author ? q.author.avatar_color : '#ccc'}22;">${q.author ? q.author.avatar_emoji : '🙂'}</div>
        <div><div class="q-author-name">${q.author ? escapeHtml(q.author.display_name) : 'مستخدم محذوف'}</div><div class="q-meta">${timeAgo(q.created_at)}</div></div>
        <span class="q-spacer"></span>
        ${canDeleteQ ? `<button class="delete-btn" data-action="delete-question" data-qid="${q.id}" title="حذف">🗑</button>` : ''}
      </div>
      <p class="q-text">${escapeHtml(q.text)}</p>
      <div class="q-footer">
        <span class="q-tag" style="${feelingVars(feeling)}">${feeling.emoji} ${feeling.name}</span>
        <span class="q-spacer"></span>
        <button class="icon-btn ${liked ? 'liked' : ''}" data-action="like-question" data-qid="${q.id}">♥ ${q.likes_count}</button>
      </div>
    </div>
    <div class="qd-answers-title">${answers.length} إجابة</div>
    ${answers.map(a => answerCardHtml(a, q)).join('') || `<p style="color:var(--text-muted); font-size:0.9rem;">ما في إجابات لسا — إجابتك ممكن تكون الأولى.</p>`}
    <div class="answer-form">
      <textarea id="answer-textarea" class="answer-textarea" maxlength="500" placeholder="شارك اللي فاهمو عن هالموضوع..."></textarea>
      <p class="field-error hidden" id="answer-error"></p>
      <button class="btn btn-primary btn-block" data-action="submit-answer" data-qid="${q.id}" id="answer-submit-btn">نشر الإجابة</button>
    </div>
  `;
}

function answerCardHtml(a, q) {
  const author = a.author;
  const liked = AppState.likedAnswerIds.has(a.id);
  const isOwnQuestion = AppState.profile && q.author_id === AppState.profile.id;
  const isOwnAnswer = AppState.profile && a.author_id === AppState.profile.id;
  const tip = a.tips && a.tips[0];
  const canDeleteA = AppState.profile && (AppState.profile.is_admin || isOwnAnswer);
  return `
    <div class="answer-card">
      <div class="q-head">
        <div class="avatar avatar-sm" style="background:${author ? author.avatar_color : '#ccc'}22;">${author ? author.avatar_emoji : '🙂'}</div>
        <div><div class="q-author-name">${author ? escapeHtml(author.display_name) : 'مستخدم محذوف'}</div><div class="q-meta">${timeAgo(a.created_at)}</div></div>
        <span class="q-spacer"></span>
        ${canDeleteA ? `<button class="delete-btn" data-action="delete-answer" data-aid="${a.id}" title="حذف">🗑</button>` : ''}
      </div>
      <p class="answer-text">${escapeHtml(a.text)}</p>
      <div class="q-footer">
        <button class="icon-btn ${liked ? 'liked' : ''}" data-action="like-answer" data-aid="${a.id}">♥ ${a.likes_count}</button>
        ${tip ? `<span class="answer-tip-badge">${TIP_VALUES[tip.tip_type].icon} ${TIP_VALUES[tip.tip_type].label}</span>` : ''}
        <span class="q-spacer"></span>
        ${isOwnQuestion && !isOwnAnswer && !tip ? `<button class="btn btn-ghost btn-sm" data-action="open-tip" data-qid="${q.id}" data-aid="${a.id}">Tip</button>` : ''}
      </div>
    </div>
  `;
}

async function submitAnswer(qid) {
  const ta = document.getElementById('answer-textarea');
  const err = document.getElementById('answer-error');
  const text = ta.value.trim();
  err.classList.add('hidden');
  if (!text) { err.textContent = 'اكتب شي قبل ما تنشر إجابتك.'; err.classList.remove('hidden'); return; }

  const btn = document.getElementById('answer-submit-btn');
  setBtnLoading(btn, true, 'جاري النشر...');
  const q = await DB.fetchQuestionById(qid);
  const { error } = await DB.postAnswer({ questionId: qid, text, authorId: AppState.profile.id });
  setBtnLoading(btn, false);
  if (error) { err.textContent = 'صار في خطأ، جرب تاني.'; err.classList.remove('hidden'); return; }

  if (q && q.author_id !== AppState.profile.id) {
    await DB.notify(q.author_id, '💡', `${AppState.profile.display_name} أجاب على سؤالك في ${FEELING_MAP[q.feeling_id].name}.`);
  }
  ta.value = '';
  await renderQuestionDetail();
  refreshFeedViews();
  showToast('✅', 'تم نشر إجابتك.');
}

/* ============================================================
   ASK MODAL
   ============================================================ */
function openAskModal(defaultFeeling) {
  AppState.askDefaultFeeling = defaultFeeling || AppState.activeFeelingId || 'general';
  const select = document.getElementById('ask-feeling');
  select.innerHTML = FEELINGS.map(f => `<option value="${f.id}" ${f.id === AppState.askDefaultFeeling ? 'selected' : ''}>${f.emoji} ${f.name}</option>`).join('');
  document.getElementById('ask-textarea').value = '';
  document.getElementById('ask-error').classList.add('hidden');
  document.getElementById('ask-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('ask-textarea').focus(), 50);
}
function closeAskModal() { document.getElementById('ask-overlay').classList.add('hidden'); }

async function submitQuestion(e) {
  e.preventDefault();
  const textarea = document.getElementById('ask-textarea');
  const select = document.getElementById('ask-feeling');
  const err = document.getElementById('ask-error');
  const text = textarea.value.trim();
  err.classList.add('hidden');
  if (!text) { err.textContent = 'السؤال ما بينفع يكون فاضي.'; err.classList.remove('hidden'); return; }

  const btn = document.getElementById('ask-submit-btn');
  setBtnLoading(btn, true, 'جاري النشر...');
  const { error } = await DB.postQuestion({ feelingId: select.value, text, authorId: AppState.profile.id });
  setBtnLoading(btn, false);
  if (error) { err.textContent = 'صار في خطأ، جرب تاني.'; err.classList.remove('hidden'); return; }

  closeAskModal();
  showToast('📝', 'سؤالك صار منشور.');
  navigateTo('feeling-detail', { activeFeelingId: select.value });
}

/* ============================================================
   TIP SYSTEM
   ============================================================ */
function openTipModal(qid, aid) {
  AppState.tipContext = { questionId: qid, answerId: aid };
  document.getElementById('tip-overlay').classList.remove('hidden');
}
function closeTipModal() { document.getElementById('tip-overlay').classList.add('hidden'); AppState.tipContext = null; }

async function sendTip(tipType) {
  const ctx = AppState.tipContext;
  if (!ctx) return;
  closeTipModal();
  const { data, error } = await DB.sendTip(ctx.answerId, tipType);
  if (error) { showToast('🚫', error.message || 'ما قدرنا نرسل الـ Tip.'); return; }

  const tipInfo = TIP_VALUES[tipType];
  showFloatingXp(tipInfo.xp);
  showToast(tipInfo.icon, `تم إرسال Tip — +${tipInfo.xp} XP.`);

  await renderQuestionDetail();
  refreshFeedViews();
}

function showFloatingXp(amount) {
  const el = document.createElement('div');
  el.textContent = `✨ +${amount} XP`;
  el.style.cssText = `position:fixed; top:50%; right:50%; transform:translate(50%,-50%); font-family:var(--font-display); font-weight:700; font-size:1.6rem; color:var(--brand-1); z-index:500; pointer-events:none; animation:floatxp 1.1s ease forwards;`;
  if (!document.getElementById('floatxp-style')) {
    const style = document.createElement('style');
    style.id = 'floatxp-style';
    style.textContent = `@keyframes floatxp { 0% {opacity:0; transform:translate(50%,-40%) scale(.7);} 20% {opacity:1; transform:translate(50%,-60%) scale(1.15);} 100% {opacity:0; transform:translate(50%,-110%) scale(1);} }`;
    document.head.appendChild(style);
  }
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1150);
}

function showLevelUp(feelingId, level) {
  const feeling = FEELING_MAP[feelingId];
  document.getElementById('levelup-emoji').textContent = feeling.emoji;
  document.getElementById('levelup-message').textContent = `لقد تطورت في ${feeling.name}.`;
  document.getElementById('levelup-level').textContent = `المستوى ${level}`;
  document.getElementById('levelup-overlay').classList.remove('hidden');
}
function closeLevelUp() { document.getElementById('levelup-overlay').classList.add('hidden'); }

/* ============================================================
   LIKES
   ============================================================ */
async function toggleLikeQuestion(qid) {
  const res = await DB.toggleQuestionLike(qid);
  if (!res) return;
  if (res.liked) AppState.likedQuestionIds.add(qid); else AppState.likedQuestionIds.delete(qid);
}
async function toggleLikeAnswer(aid) {
  const res = await DB.toggleAnswerLike(aid);
  if (!res) return;
  if (res.liked) AppState.likedAnswerIds.add(aid); else AppState.likedAnswerIds.delete(aid);
}
function refreshFeedViews() {
  if (['home', 'feelings', 'feeling-detail', 'questions', 'posts'].includes(AppState.route)) renderMain();
}

/* ============================================================
   POSTS (صفحة الاقتباسات)
   ============================================================ */
async function renderPostsPage() {
  const posts = await DB.fetchPosts();
  return `
    <section class="section-head">
      <div><h1 class="section-title" style="font-size:1.9rem;">الاقتباسات</h1><p class="section-sub">شارك اقتباس أو فكرة، وخلي الناس تتفاعل معك.</p></div>
    </section>
    <form id="post-form" class="post-composer">
      <textarea id="post-textarea" class="ask-textarea" maxlength="500" placeholder="شو الاقتباس أو الفكرة الي بدك تشاركها؟"></textarea>
      <button type="submit" class="btn btn-primary" id="post-submit-btn">نشر</button>
    </form>
    <div class="posts-feed">${posts.map(p => postCardHtml(p)).join('') || `<div class="empty-state"><div class="empty-state-emoji">💬</div><div class="empty-state-title">ما في اقتباسات لسا.</div><div class="empty-state-sub">كون أول واحد يشارك.</div></div>`}</div>
  `;
}

function postCardHtml(p) {
  const author = p.author;
  const liked = AppState.likedPostIds.has(p.id);
  const canDeleteP = AppState.profile && (AppState.profile.is_admin || p.author_id === AppState.profile.id);
  return `
    <article class="post-card" data-pid="${p.id}">
      <div class="q-head">
        <div class="avatar avatar-sm" style="background:${author ? author.avatar_color : '#ccc'}22;">${author ? author.avatar_emoji : '🙂'}</div>
        <div><div class="q-author-name">${author ? escapeHtml(author.display_name) : 'مستخدم محذوف'}</div><div class="q-meta">${timeAgo(p.created_at)}</div></div>
        <span class="q-spacer"></span>
        ${canDeleteP ? `<button class="delete-btn" data-action="delete-post" data-pid="${p.id}" title="حذف">🗑</button>` : ''}
      </div>
      <p class="q-text">${escapeHtml(p.text)}</p>
      <div class="q-footer">
        <button class="icon-btn ${liked ? 'liked' : ''}" data-action="like-post" data-pid="${p.id}">♥ ${p.likes_count}</button>
        <button class="icon-btn" data-action="toggle-comments" data-pid="${p.id}">💬 تعليقات</button>
      </div>
      <div class="post-comments hidden" id="comments-${p.id}"></div>
    </article>
  `;
}

async function togglePostComments(pid) {
  const container = document.getElementById(`comments-${pid}`);
  if (!container) return;
  const willShow = container.classList.contains('hidden');
  container.classList.toggle('hidden');
  if (AppState.channels.comments) { DB.unsubscribe(AppState.channels.comments); AppState.channels.comments = null; }
  if (!willShow) return;
  await renderComments(pid);
  AppState.channels.comments = DB.subscribeToComments(pid, debounce(() => renderComments(pid), 400));
}

async function renderComments(pid) {
  const container = document.getElementById(`comments-${pid}`);
  if (!container || container.classList.contains('hidden')) return;
  const comments = await DB.fetchComments(pid);
  const canModerate = AppState.profile && AppState.profile.is_admin;
  container.innerHTML = `
    <div class="comment-list">
      ${comments.map(c => {
        const canDelete = canModerate || (AppState.profile && c.author_id === AppState.profile.id);
        return `
        <div class="comment-item">
          <div class="avatar avatar-sm" style="background:${c.author ? c.author.avatar_color : '#ccc'}22;">${c.author ? c.author.avatar_emoji : '🙂'}</div>
          <div style="flex:1;"><div class="comment-author">${c.author ? escapeHtml(c.author.display_name) : 'مستخدم محذوف'}</div><div class="comment-text">${escapeHtml(c.text)}</div></div>
          ${canDelete ? `<button class="delete-btn" data-action="delete-comment" data-cid="${c.id}" data-pid="${pid}" title="حذف">🗑</button>` : ''}
        </div>
      `;}).join('') || '<p style="color:var(--text-faint); font-size:0.85rem;">ولا تعليق لسا.</p>'}
    </div>
    <form class="comment-form" data-pid="${pid}">
      <input type="text" class="comment-input" placeholder="اكتب تعليق..." maxlength="300">
      <button type="submit" class="btn btn-ghost btn-sm">إرسال</button>
    </form>
  `;
}

async function submitComment(form) {
  const pid = form.dataset.pid;
  const input = form.querySelector('.comment-input');
  const text = input.value.trim();
  if (!text) return;
  await DB.addComment({ postId: pid, text, authorId: AppState.profile.id });
  input.value = '';
  await togglePostComments(pid); // إعادة تحميل مقفولة
  await togglePostComments(pid); // فتحها من جديد بالمحتوى الجديد
}

async function submitPost(e) {
  e.preventDefault();
  const ta = document.getElementById('post-textarea');
  const text = ta.value.trim();
  if (!text) return;
  const btn = document.getElementById('post-submit-btn');
  setBtnLoading(btn, true, 'جاري النشر...');
  await DB.createPost({ text, authorId: AppState.profile.id });
  setBtnLoading(btn, false);
  ta.value = '';
  showToast('✅', 'تم نشر الاقتباس.');
  renderMain();
}

async function togglePostLike(pid) {
  const res = await DB.togglePostLike(pid);
  if (!res) return;
  if (res.liked) AppState.likedPostIds.add(pid); else AppState.likedPostIds.delete(pid);
  refreshFeedViews();
}

/* ============================================================
   NOTIFICATIONS
   ============================================================ */
async function refreshNotifBadge() {
  if (!AppState.profile) return;
  const notifs = await DB.fetchNotifications(AppState.profile.id);
  const unread = notifs.filter(n => !n.is_read).length;
  [document.getElementById('notif-badge'), document.getElementById('notif-badge-mobile')].forEach(b => {
    if (!b) return;
    b.textContent = unread;
    b.classList.toggle('hidden', unread === 0);
  });
}

async function renderNotifications() {
  const notifs = await DB.fetchNotifications(AppState.profile.id);
  await DB.markAllNotificationsRead(AppState.profile.id);
  setTimeout(refreshNotifBadge, 0);
  if (!notifs.length) {
    return `<h1 class="section-title" style="font-size:1.9rem; margin-bottom:1.4rem;">الإشعارات</h1>
      <div class="empty-state"><div class="empty-state-emoji">🔔</div><div class="empty-state-title">ما في شي هون لسا.</div><div class="empty-state-sub">لما حدا يعطيك Tip أو ترقّى مستوى، رح تشوفه هون.</div></div>`;
  }
  return `
    <h1 class="section-title" style="font-size:1.9rem; margin-bottom:1.4rem;">الإشعارات</h1>
    <div class="notif-list">${notifs.map(n => `
      <div class="notif-item ${n.is_read ? '' : 'unread'}">
        <span class="notif-icon">${n.icon}</span>
        <div><div class="notif-text">${escapeHtml(n.text)}</div><div class="notif-time">${timeAgo(n.created_at)}</div></div>
      </div>
    `).join('')}</div>
  `;
}

/* ============================================================
   PROFILE
   ============================================================ */
async function renderProfile() {
  const profile = AppState.profile;
  const level = getLevelInfo(totalXpFromMap(AppState.xpMap));
  const sortedFeelings = [...FEELINGS].filter(f => !f.gradient).sort((a, b) => (AppState.xpMap[b.id] || 0) - (AppState.xpMap[a.id] || 0));
  const strongest = sortedFeelings.slice(0, 3);
  const growth = sortedFeelings.slice(-3).reverse();

  const mapRows = FEELINGS.filter(f => !f.gradient).map(f => {
    const info = getLevelInfo(AppState.xpMap[f.id] || 0);
    return `<div class="emotional-map-row"><div class="em-label">${f.emoji} ${f.name}</div><div class="em-track"><div class="em-fill" style="width:${info.pct}%; background:${f.color};"></div></div><div class="em-xp">Lv ${info.level} · ${info.xp.toLocaleString()} XP</div></div>`;
  }).join('');

  return `
    <div class="profile-header">
      <div class="avatar avatar-lg" style="background:${profile.avatar_color}22;">${profile.avatar_emoji}</div>
      <div><h1 class="section-title" style="font-size:1.7rem;">${escapeHtml(profile.display_name)}</h1><p class="section-sub">المستوى ${level.level} · ${totalXpFromMap(AppState.xpMap).toLocaleString()} XP إجمالي</p></div>
    </div>
    <div class="profile-stats-grid">
      <div class="profile-stat-card"><div class="profile-stat-num">${level.level}</div><div class="profile-stat-label">المستوى</div></div>
      <div class="profile-stat-card"><div class="profile-stat-num">${profile.tips_received}</div><div class="profile-stat-label">تقديرات مستلمة</div></div>
      <div class="profile-stat-card"><div class="profile-stat-num">${profile.tips_given}</div><div class="profile-stat-label">تقديرات مرسلة</div></div>
    </div>
    <h2 class="section-title" style="margin-bottom:0.3rem;">خريطتك العاطفية</h2>
    <p class="section-sub" style="margin-bottom:1.2rem;">صورة عن مكانك الحالي — مش تقييم لك.</p>
    <div class="map-summary-grid">
      <div class="map-summary-card"><div class="map-summary-title">الأقوى عندك</div>${strongest.map(f => `<span class="map-summary-chip">${f.emoji} ${f.name}</span>`).join('')}</div>
      <div class="map-summary-card"><div class="map-summary-title">مجالات للاستكشاف</div>${growth.map(f => `<span class="map-summary-chip">${f.emoji} ${f.name}</span>`).join('')}</div>
    </div>
    <div style="background:var(--bg-elevated); border:1px solid var(--border-soft); border-radius:var(--radius-lg); padding:0.6rem 1.4rem;">${mapRows}</div>
  `;
}

/* ============================================================
   ADMIN
   ============================================================ */
async function renderAdmin() {
  const users = await DB.adminListUsers();
  return `
    <section class="section-head"><div><h1 class="section-title" style="font-size:1.9rem;">لوحة الأدمن</h1><p class="section-sub">إدارة الحسابات. ما في وصول لكلمات المرور — هذا مقصود لحماية المستخدمين.</p></div></section>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th>المستخدم</th><th>الإيميل</th><th>تقديرات</th><th>تاريخ التسجيل</th><th>الحالة</th><th>إجراء</th></tr></thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td><strong>${escapeHtml(u.display_name)}</strong><br><span style="color:var(--text-faint); font-size:0.78rem;">@${escapeHtml(u.username)}${u.is_admin ? ' · أدمن' : ''}</span></td>
              <td>${escapeHtml(u.email || '—')}</td>
              <td>${u.tips_received} مستلمة / ${u.tips_given} مرسلة</td>
              <td>${new Date(u.created_at).toLocaleDateString('ar')}</td>
              <td>${u.is_banned ? `<span class="ban-badge">محظور${u.ban_reason ? ': ' + escapeHtml(u.ban_reason) : ''}</span>` : '<span class="ok-badge">فعّال</span>'}</td>
              <td>
                ${u.is_admin ? '' : (u.is_banned
                  ? `<button class="btn btn-ghost btn-sm" data-action="admin-unban" data-uid="${u.id}">فك الحظر</button>`
                  : `<button class="btn btn-ghost btn-sm" data-action="admin-ban" data-uid="${u.id}" data-name="${escapeHtml(u.display_name)}">حظر</button>`)}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

let banTargetUserId = null;
function openBanModal(userId, name) {
  banTargetUserId = userId;
  document.getElementById('ban-target-name').textContent = `حظر حساب: ${name}`;
  document.getElementById('ban-reason').value = '';
  document.getElementById('ban-overlay').classList.remove('hidden');
}
function closeBanModal() { document.getElementById('ban-overlay').classList.add('hidden'); banTargetUserId = null; }

async function confirmBan(e) {
  e.preventDefault();
  const reason = document.getElementById('ban-reason').value.trim();
  await DB.adminSetBan(banTargetUserId, true, reason);
  closeBanModal();
  showToast('🚫', 'تم حظر الحساب.');
  renderMain();
}

async function unbanUser(userId) {
  await DB.adminSetBan(userId, false, null);
  showToast('✅', 'تم فك الحظر.');
  renderMain();
}

/* ============================================================
   TOASTS / THEME
   ============================================================ */
function showToast(icon, message) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('leaving'); setTimeout(() => toast.remove(), 260); }, 2800);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
  const icon = theme === 'dark' ? '☀️' : '🌙';
  ['theme-toggle-app', 'theme-toggle-auth'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = icon; });
}
function toggleTheme() {
  const next = (localStorage.getItem('feel_theme') || 'light') === 'dark' ? 'light' : 'dark';
  localStorage.setItem('feel_theme', next);
  applyTheme(next);
}

/* ============================================================
   EVENT BINDING
   ============================================================ */
function bindStaticEvents() {
  document.querySelectorAll('.auth-tab').forEach(tab => tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab)));
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('signup-form').addEventListener('submit', handleSignup);
  document.getElementById('theme-toggle-auth').addEventListener('click', toggleTheme);
  document.getElementById('theme-toggle-app').addEventListener('click', toggleTheme);
  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('switch-account-btn').addEventListener('click', openAccountSwitcher);

  document.getElementById('ask-form').addEventListener('submit', submitQuestion);
  document.getElementById('ask-close').addEventListener('click', closeAskModal);
  document.getElementById('ask-overlay').addEventListener('click', e => { if (e.target.id === 'ask-overlay') closeAskModal(); });

  document.getElementById('tip-close').addEventListener('click', closeTipModal);
  document.getElementById('tip-overlay').addEventListener('click', e => { if (e.target.id === 'tip-overlay') closeTipModal(); });
  document.getElementById('tip-grid').addEventListener('click', e => { const btn = e.target.closest('.tip-option'); if (btn) sendTip(btn.dataset.tip); });

  document.getElementById('question-close').addEventListener('click', closeQuestionDetail);
  document.getElementById('question-overlay').addEventListener('click', e => { if (e.target.id === 'question-overlay') closeQuestionDetail(); });

  document.getElementById('levelup-close').addEventListener('click', closeLevelUp);
  document.getElementById('ban-close').addEventListener('click', closeBanModal);
  document.getElementById('ban-overlay').addEventListener('click', e => { if (e.target.id === 'ban-overlay') closeBanModal(); });
  document.getElementById('ban-form').addEventListener('submit', confirmBan);

  document.addEventListener('click', e => {
    const navEl = e.target.closest('[data-nav]');
    if (navEl) { navigateTo(navEl.dataset.nav); return; }

    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    switch (action) {
      case 'ask': openAskModal(actionEl.dataset.feeling); break;
      case 'open-feeling': navigateTo('feeling-detail', { activeFeelingId: actionEl.dataset.feeling }); break;
      case 'open-question': openQuestionDetail(actionEl.dataset.qid); break;
      case 'like-question': e.stopPropagation(); toggleLikeQuestion(actionEl.dataset.qid).then(() => { if (AppState.activeQuestionId) renderQuestionDetail(); refreshFeedViews(); }); break;
      case 'like-answer': e.stopPropagation(); toggleLikeAnswer(actionEl.dataset.aid).then(renderQuestionDetail); break;
      case 'open-tip': e.stopPropagation(); openTipModal(actionEl.dataset.qid, actionEl.dataset.aid); break;
      case 'submit-answer': submitAnswer(actionEl.dataset.qid); break;
      case 'filter': AppState.feelingFilter = actionEl.dataset.filter; renderMain(); break;
      case 'scope': AppState.questionsScope = actionEl.dataset.scope; renderMain(); break;
      case 'like-post': togglePostLike(actionEl.dataset.pid); break;
      case 'toggle-comments': togglePostComments(actionEl.dataset.pid); break;
      case 'admin-ban': openBanModal(actionEl.dataset.uid, actionEl.dataset.name); break;
      case 'admin-unban': unbanUser(actionEl.dataset.uid); break;
      case 'delete-question': e.stopPropagation(); deleteQuestionHandler(actionEl.dataset.qid); break;
      case 'delete-answer': e.stopPropagation(); deleteAnswerHandler(actionEl.dataset.aid); break;
      case 'delete-post': e.stopPropagation(); deletePostHandler(actionEl.dataset.pid); break;
      case 'delete-comment': e.stopPropagation(); deleteCommentHandler(actionEl.dataset.cid, actionEl.dataset.pid); break;
      case 'switch-account': switchToAccount(actionEl.dataset.uid); break;
      case 'forget-account': e.stopPropagation(); forgetSavedAccount(actionEl.dataset.uid); break;
    }
  });

  document.getElementById('main-content').addEventListener('submit', e => {
    if (e.target.id === 'post-form') submitPost(e);
    if (e.target.classList.contains('comment-form')) { e.preventDefault(); submitComment(e.target); }
  });

  document.getElementById('main-content').addEventListener('input', e => {
    if (e.target.id === 'search-input') {
      AppState.searchQuery = e.target.value;
      renderMain().then(() => {
        const input = document.getElementById('search-input');
        if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
      });
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    closeAskModal(); closeTipModal(); closeQuestionDetail(); closeLevelUp(); closeBanModal();
  });
}
