/* ============================================================
   FEEL — db.js
   كل الاتصال بـ Supabase (Auth + Postgres) يمر من هون.
   ============================================================ */

const DB = {

  /* ---------------- Auth ---------------- */
  async signUp({ username, email, password, displayName, avatarEmoji, avatarColor }) {
    username = username.trim().toLowerCase();
    const { data: existing } = await sb.rpc('email_for_username', { p_username: username });
    if (existing) return { error: { message: 'اسم المستخدم هذا محجوز، جرّب اسم ثاني.' } };

    return await sb.auth.signUp({
      email, password,
      options: { data: {
        username, display_name: displayName || username,
        avatar_emoji: avatarEmoji || '🙂', avatar_color: avatarColor || '#8B5CF6',
      } },
    });
  },

  async signInWithUsername(usernameOrEmail, password) {
    let email = usernameOrEmail.trim();
    if (!email.includes('@')) {
      const { data: resolvedEmail, error: rpcErr } = await sb.rpc('email_for_username', { p_username: email });
      if (rpcErr || !resolvedEmail) return { error: { message: 'اسم المستخدم أو كلمة المرور غير صحيحة.' } };
      email = resolvedEmail;
    }
    const res = await sb.auth.signInWithPassword({ email, password });
    if (res.error) return { error: { message: 'اسم المستخدم أو كلمة المرور غير صحيحة.' } };

    const profile = await this.getMyProfile();
    if (profile && profile.is_banned) {
      await sb.auth.signOut();
      return { error: { message: 'هذا الحساب محظور. السبب: ' + (profile.ban_reason || 'مخالفة قواعد المجتمع.') } };
    }
    return res;
  },

  async signOut() { return sb.auth.signOut(); },

  async getSession() {
    const { data } = await sb.auth.getSession();
    return data.session;
  },

  async getMyProfile() {
    const session = await this.getSession();
    if (!session) return null;
    const { data, error } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
    if (error) return null;
    return data;
  },

  /* ---------------- Profiles / XP ---------------- */
  async fetchXpMap(userId) {
    const { data, error } = await sb.from('user_feeling_xp').select('feeling_id, xp').eq('user_id', userId);
    if (error) return {};
    const map = {};
    FEELINGS.forEach(f => { map[f.id] = 0; });
    data.forEach(row => { map[row.feeling_id] = row.xp; });
    return map;
  },

  async fetchProfileByUsername(username) {
    const { data } = await sb.from('profiles').select('*').eq('username', username.toLowerCase()).single();
    return data || null;
  },

  /* ---------------- Questions ---------------- */
  async fetchQuestions({ feelingId = null, authorId = null } = {}) {
    let q = sb.from('questions')
      .select('*, author:profiles!questions_author_id_fkey(id, username, display_name, avatar_emoji, avatar_color)')
      .order('created_at', { ascending: false });
    if (feelingId && feelingId !== 'all') q = q.eq('feeling_id', feelingId);
    if (authorId) q = q.eq('author_id', authorId);
    const { data, error } = await q;
    if (error) { console.error(error); return []; }
    return data;
  },

  async fetchQuestionById(id) {
    const { data, error } = await sb.from('questions')
      .select('*, author:profiles!questions_author_id_fkey(id, username, display_name, avatar_emoji, avatar_color)')
      .eq('id', id).single();
    if (error) return null;
    return data;
  },

  async fetchMySeenQuestionIds(userId) {
    const { data, error } = await sb.from('question_seen').select('question_id').eq('user_id', userId);
    if (error) return new Set();
    return new Set(data.map(r => r.question_id));
  },

  async markQuestionSeen(questionId, userId) {
    await sb.from('question_seen').upsert({ question_id: questionId, user_id: userId }, { onConflict: 'question_id,user_id', ignoreDuplicates: true });
  },

  async fetchMyLikedQuestionIds(userId) {
    const { data, error } = await sb.from('question_likes').select('question_id').eq('user_id', userId);
    if (error) return new Set();
    return new Set(data.map(r => r.question_id));
  },

  async postQuestion({ feelingId, text, authorId }) {
    return await sb.from('questions').insert({ feeling_id: feelingId, text, author_id: authorId }).select().single();
  },

  async toggleQuestionLike(questionId) {
    const { data, error } = await sb.rpc('toggle_question_like', { p_question_id: questionId });
    if (error) { console.error(error); return null; }
    return Array.isArray(data) ? data[0] : data;
  },

  /* ---------------- Answers ---------------- */
  async fetchAnswersForQuestion(questionId) {
    const { data, error } = await sb.from('answers')
      .select('*, author:profiles!answers_author_id_fkey(id, username, display_name, avatar_emoji, avatar_color), tips(tip_type, xp, from_user_id, created_at)')
      .eq('question_id', questionId)
      .order('likes_count', { ascending: false });
    if (error) { console.error(error); return []; }
    return data;
  },

  async fetchMyLikedAnswerIds(userId) {
    const { data, error } = await sb.from('answer_likes').select('answer_id').eq('user_id', userId);
    if (error) return new Set();
    return new Set(data.map(r => r.answer_id));
  },

  async postAnswer({ questionId, text, authorId }) {
    return await sb.from('answers').insert({ question_id: questionId, text, author_id: authorId }).select().single();
  },

  async toggleAnswerLike(answerId) {
    const { data, error } = await sb.rpc('toggle_answer_like', { p_answer_id: answerId });
    if (error) { console.error(error); return null; }
    return Array.isArray(data) ? data[0] : data;
  },

  async sendTip(answerId, tipType) {
    const { data, error } = await sb.rpc('send_tip', { p_answer_id: answerId, p_tip_type: tipType });
    if (error) return { error };
    return { data: Array.isArray(data) ? data[0] : data };
  },

  /* ---------------- Posts (الكوتيشن) ---------------- */
  async fetchPosts() {
    const { data, error } = await sb.from('posts')
      .select('*, author:profiles!posts_author_id_fkey(id, username, display_name, avatar_emoji, avatar_color)')
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return []; }
    return data;
  },

  async createPost({ text, authorId }) {
    return await sb.from('posts').insert({ text, author_id: authorId }).select().single();
  },

  async togglePostLike(postId) {
    const { data, error } = await sb.rpc('toggle_post_like', { p_post_id: postId });
    if (error) { console.error(error); return null; }
    return Array.isArray(data) ? data[0] : data;
  },

  async fetchMyLikedPostIds(userId) {
    const { data, error } = await sb.from('post_likes').select('post_id').eq('user_id', userId);
    if (error) return new Set();
    return new Set(data.map(r => r.post_id));
  },

  async fetchComments(postId) {
    const { data, error } = await sb.from('post_comments')
      .select('*, author:profiles!post_comments_author_id_fkey(id, username, display_name, avatar_emoji, avatar_color)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (error) return [];
    return data;
  },

  async addComment({ postId, text, authorId }) {
    return await sb.from('post_comments').insert({ post_id: postId, text, author_id: authorId }).select().single();
  },

  /* ---------------- Notifications ---------------- */
  async fetchNotifications(userId) {
    const { data, error } = await sb.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) return [];
    return data;
  },

  async markAllNotificationsRead(userId) {
    await sb.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
  },

  async notify(userId, icon, text, linkRoute, linkParams) {
    await sb.from('notifications').insert({ user_id: userId, icon, text, link_route: linkRoute || null, link_params: linkParams || null });
  },

  /* ---------------- Admin ---------------- */
  async adminListUsers() {
    const { data, error } = await sb.rpc('admin_list_users');
    if (error) { console.error(error); return []; }
    return data;
  },

  async adminSetBan(userId, banned, reason) {
    return await sb.rpc('admin_set_ban', { p_user_id: userId, p_banned: banned, p_reason: reason || null });
  },

  /* ---------------- Delete (owner or admin — RLS enforces this server-side) ---------------- */
  async deleteQuestion(id) { return await sb.from('questions').delete().eq('id', id); },
  async deleteAnswer(id) { return await sb.from('answers').delete().eq('id', id); },
  async deletePost(id) { return await sb.from('posts').delete().eq('id', id); },
  async deleteComment(id) { return await sb.from('post_comments').delete().eq('id', id); },

  /* ---------------- Realtime ---------------- */
  subscribeToNotifications(userId, onInsert) {
    return sb.channel('notifications-' + userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, payload => onInsert(payload.new))
      .subscribe();
  },
  subscribeToQuestions(onChange) {
    return sb.channel('questions-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, onChange)
      .subscribe();
  },
  subscribeToAnswers(questionId, onChange) {
    return sb.channel('answers-' + questionId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'answers', filter: `question_id=eq.${questionId}` }, onChange)
      .subscribe();
  },
  subscribeToPosts(onChange) {
    return sb.channel('posts-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, onChange)
      .subscribe();
  },
  subscribeToComments(postId, onChange) {
    return sb.channel('comments-' + postId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments', filter: `post_id=eq.${postId}` }, onChange)
      .subscribe();
  },
  subscribeToMyXp(userId, onChange) {
    return sb.channel('xp-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_feeling_xp', filter: `user_id=eq.${userId}` }, onChange)
      .subscribe();
  },
  unsubscribe(channel) { if (channel) sb.removeChannel(channel); },

  /* ---------------- Push notifications ---------------- */
  async savePushSubscription(userId, sub) {
    const keys = sub.toJSON().keys;
    return await sb.from('push_subscriptions').upsert({
      user_id: userId, endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth,
    }, { onConflict: 'endpoint' });
  },
  async removePushSubscription(endpoint) {
    return await sb.from('push_subscriptions').delete().eq('endpoint', endpoint);
  },
};
