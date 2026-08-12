/* ============================================================
   FEEL — config.js
   إعدادات ثابتة يستخدمها كل التطبيق: المشاعر، نظام XP/المستويات،
   قيم الـ Tips، وأدوات مساعدة صغيرة. لا يوجد هون أي اتصال بالشبكة.
   ============================================================ */

const FEELINGS = [
  { id: 'love',           name: 'الحب',           emoji: '❤️',    color: '#E6395B', desc: 'كيف تتواصل، وتهتم، وتسمح لنفسك أن تكون ضعيفًا.', tagline: 'الحب ليس فقط أن تُحَب. إنه أن تفهم كيف تُحب.' },
  { id: 'trust',          name: 'الثقة',          emoji: '💙',    color: '#4A90E2', desc: 'كيف تنفتح بأمان وتعتمد على الآخرين.', tagline: 'الثقة تنمو في المسافة بين الشك والتواصل.' },
  { id: 'happiness',      name: 'السعادة',        emoji: '💛',    color: '#D9A400', desc: 'ما الذي يرفع معنوياتك فعلًا، أبعد من السطح.', tagline: 'السعادة هي أن تلاحظ ما يرفع معنوياتك أصلًا.' },
  { id: 'sadness',        name: 'الحزن',          emoji: '💜',    color: '#667EEA', desc: 'كيف تجلس مع الفقدان دون أن يبتلعك.', tagline: 'الحزن ليس ضعفًا — إنه شعور كامل غير منقوص.' },
  { id: 'empathy',        name: 'التعاطف',        emoji: '🧡',    color: '#F28C6B', desc: 'كيف تشعر مع الآخرين، لا فقط من أجلهم.', tagline: 'التعاطف جسر يُبنى من ألمك أنت.' },
  { id: 'hope',           name: 'الأمل',           emoji: '💚',    color: '#2F9E82', desc: 'كيف تتمسك بالإمكانية عندما تصعب الأمور.', tagline: 'الأمل قرار هادئ، يُتَّخذ كل يوم من جديد.' },
  { id: 'tenderness',     name: 'الحنان',         emoji: '🩷',    color: '#D6699A', desc: 'كيف تعامل بلطف من تحب — ونفسك أيضًا.', tagline: 'الحنان قوة، لكنها اختارت أن تكون ناعمة.' },
  { id: 'passion',        name: 'الشغف',          emoji: '❤️‍🔥', color: '#D7263D', desc: 'ما الذي يجعلك تشعر بأنك حي تمامًا ومستيقظ.', tagline: 'الشغف هو الجزء منك الذي يرفض أن يصمت.' },
  { id: 'calmness',       name: 'الهدوء',         emoji: '🩵',    color: '#3F8CA6', desc: 'كيف تجد السكينة وسط الضجيج.', tagline: 'الهدوء ليس غياب العاصفة — بل معرفة كيف تقف داخلها.' },
  { id: 'anger',          name: 'الغضب',          emoji: '🖤',    color: '#C0392B', desc: 'ما الذي يحاول غضبك أن يحميه.', tagline: 'الغضب غالبًا يحرس شيئًا تأذى من قبل.' },
  { id: 'forgiveness',    name: 'التسامح',        emoji: '🤍',    color: '#9C9483', desc: 'كيف تُطلق ما لم تعد قادرًا على حمله.', tagline: 'التسامح هدية تمنحها لكتفيك أنت.' },
  { id: 'appreciation',   name: 'التقدير',        emoji: '💗',    color: '#C15FCB', desc: "كيف تلاحظ وتسمّي ما هو جيد.", tagline: 'التقدير يحوّل ما نملكه إلى ما يكفينا.' },
  { id: 'loneliness',     name: 'الوحدة',         emoji: '💙',    color: '#64748B', desc: 'كيف تتعامل مع نفسك في الغرف الفارغة.', tagline: 'الوحدة معلومة، لا حكم نهائي.' },
  { id: 'fear',           name: 'الخوف',          emoji: '💛',    color: '#8B5CF6', desc: 'ما الذي تتجنبه، وما الذي قد يكون يحميه.', tagline: 'الخوف غالبًا حارس قديم، ما زال في الخدمة.' },
  { id: 'nostalgia',      name: 'الحنين',         emoji: '💜',    color: '#A6733F', desc: 'كيف يبقى الماضي يشكّل من تصبح.', tagline: 'الحنين ذاكرة، ترتدي ضوءًا أكثر نعومة.' },
  { id: 'inner-strength', name: 'القوة الداخلية', emoji: '🩶',    color: '#475569', desc: 'ما الذي يحملك عندما لا يحملك شيء آخر.', tagline: 'القوة الداخلية هادئة — نادرًا ما تُعلن عن نفسها.' },
  { id: 'general',        name: 'عام',            emoji: '🌈',    color: '#7C6EE0', desc: 'كل ما لا يندرج تحت تصنيف واحد.', tagline: 'بعض ما تشعر به لا يملك اسمًا واحدًا.', gradient: true },
];
const FEELING_MAP = Object.fromEntries(FEELINGS.map(f => [f.id, f]));

const LEVEL_THRESHOLDS = [
  { level: 0,  min: 0,     max: 99 },
  { level: 1,  min: 100,   max: 249 },
  { level: 2,  min: 250,   max: 499 },
  { level: 3,  min: 500,   max: 899 },
  { level: 4,  min: 900,   max: 1499 },
  { level: 5,  min: 1500,  max: 2499 },
  { level: 6,  min: 2500,  max: 3999 },
  { level: 7,  min: 4000,  max: 5999 },
  { level: 8,  min: 6000,  max: 8499 },
  { level: 9,  min: 8500,  max: 11999 },
  { level: 10, min: 12000, max: Infinity },
];

function getLevelInfo(xp) {
  xp = xp || 0;
  const tier = LEVEL_THRESHOLDS.find(t => xp >= t.min && xp <= t.max) || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  const span = tier.max === Infinity ? Math.max(xp - tier.min, 1) : (tier.max - tier.min + 1);
  const into = xp - tier.min;
  const pct = tier.max === Infinity ? 100 : Math.min(100, Math.round((into / span) * 100));
  return {
    level: tier.level, xp, min: tier.min,
    max: tier.max === Infinity ? into + tier.min : tier.max + 1,
    pct, isMax: tier.level === 10,
  };
}

const TIP_VALUES = {
  small: { xp: 10,  label: 'مفيدة',       icon: '💡' },
  good:  { xp: 25,  label: 'مؤثرة',       icon: '❤️' },
  great: { xp: 50,  label: 'قوية',        icon: '✨' },
  epic:  { xp: 100, label: 'غيّرت حياتي', icon: '🏆' },
};

function timeAgo(iso) {
  const ts = typeof iso === 'number' ? iso : new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'الآن';
  if (min < 60) return 'قبل ' + min + ' د';
  const hr = Math.floor(min / 60);
  if (hr < 24) return 'قبل ' + hr + ' س';
  const day = Math.floor(hr / 24);
  if (day < 30) return 'قبل ' + day + ' يوم';
  const mo = Math.floor(day / 30);
  return 'قبل ' + mo + ' شهر';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function totalXpFromMap(xpMap) {
  return Object.values(xpMap || {}).reduce((a, b) => a + (b || 0), 0);
}

const AVATAR_OPTIONS = [
  { emoji: '🧑🏻', color: '#F6C945' }, { emoji: '👩🏽', color: '#E88EED' },
  { emoji: '🧑🏾', color: '#76B5C5' }, { emoji: '👨🏼', color: '#55BFA3' },
  { emoji: '👩🏻', color: '#E6395B' }, { emoji: '🧑🏿', color: '#8B5CF6' },
  { emoji: '👨🏽', color: '#4A90E2' }, { emoji: '👩🏾', color: '#D7263D' },
];
