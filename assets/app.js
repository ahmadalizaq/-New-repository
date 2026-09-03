/* ═══ shared helpers (loaded on every page) ═══ */
var $  = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
var REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

function waLink(text) {
  return 'https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(text);
}
function n(v) {
  if (v == null) return '';
  return Number.isInteger(+v) ? String(+v) : (+v).toFixed(1);
}
function unitUrl(u) { return CFG.unitPath(u.ref); }

function containerTxt(v) {
  if (!v) return null;
  if (v >= 2) return n(v) + ' وحدات في الحاوية';
  if (v >= 1) return 'وحدة كاملة في الحاوية';
  return 'يحتاج ' + Math.round(1 / v) + ' حاويات';
}

/* card artwork: a photo, or an SVG elevation drawn from the real dimensions */
function artwork(u, thumb) {
  var src = u.imgs.length ? CFG.img(u.imgs[0], thumb) : '';
  if (src) return '<img src="' + src + '" alt="' + u.title + '" loading="lazy" decoding="async">';
  if (u.geo) return elevationSVG(u.geo, u.stories);
  if (u.sqm) return areaSVG(u.sqm);
  return '<div class="noimg"><span>مخطط قيد الإعداد</span></div>';
}

/* area-only diagram: the sheet records a size but no dimensions */
function areaSVG(sqm) {
  var W = 400, H = 300, side = 150, x = (W - side) / 2, y = (H - side) / 2 - 6;
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" ' +
    'role="img" aria-label="مساحة الوحدة">' +
    '<rect width="' + W + '" height="' + H + '" fill="#EFEBE3"/>' +
    '<defs><pattern id="hz" width="8" height="8" patternTransform="rotate(45)" ' +
      'patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="8" ' +
      'stroke="#1B2422" stroke-width="1" opacity=".14"/></pattern></defs>' +
    '<rect x="' + x + '" y="' + y + '" width="' + side + '" height="' + side +
      '" fill="url(#hz)" stroke="#1B2422" stroke-width="1.2"/>' +
    '<text x="' + (W / 2) + '" y="' + (y + side / 2 + 2) + '" text-anchor="middle" ' +
      'fill="#1B2422" font-size="26" font-weight="700" ' +
      'font-family="Noto Kufi Arabic,sans-serif">' + n(sqm) + ' م²</text>' +
    '<text x="' + (W / 2) + '" y="' + (y + side + 26) + '" text-anchor="middle" ' +
      'fill="#6E7A76" font-size="12.5" font-family="IBM Plex Sans Arabic,sans-serif">' +
      'الأبعاد التفصيلية عند الطلب</text></svg>';
}

/* technical elevation, generated from the unit's own numbers */
function elevationSVG(g, stories) {
  var W = 400, H = 300, pad = 46;
  var w, h;
  if (g.shape === 'dome') { w = g.d; h = g.d * 0.55; }
  else { w = g.l || 8; h = (g.h || 3) * (stories >= 2 ? 2 : 1); }
  var k = Math.min((W - pad * 2) / w, (H - pad * 2) / (h * 1.5));
  var pw = w * k, ph = h * k;
  var x = (W - pw) / 2, y = H - pad - ph;
  var body;
  if (g.shape === 'dome') {
    body = '<path d="M' + x + ' ' + (y + ph) + ' A' + (pw / 2) + ' ' + ph + ' 0 0 1 ' +
           (x + pw) + ' ' + (y + ph) + ' Z" fill="#D6DEDA" stroke="#1B2422" stroke-width="1.2"/>';
  } else {
    body = '<rect x="' + x + '" y="' + y + '" width="' + pw + '" height="' + ph +
           '" rx="' + (Math.min(pw, ph) * 0.07) + '" fill="#E4DFD5" stroke="#1B2422" stroke-width="1.2"/>' +
           '<rect x="' + (x + pw * 0.1) + '" y="' + (y + ph * 0.22) + '" width="' + (pw * 0.52) +
           '" height="' + (ph * (stories >= 2 ? 0.22 : 0.42)) + '" fill="#2E3B3A" opacity=".82"/>';
    if (stories >= 2) {
      body += '<line x1="' + x + '" y1="' + (y + ph / 2) + '" x2="' + (x + pw) + '" y2="' +
              (y + ph / 2) + '" stroke="#1B2422" stroke-width="1" opacity=".5"/>' +
              '<rect x="' + (x + pw * 0.1) + '" y="' + (y + ph * 0.62) + '" width="' + (pw * 0.52) +
              '" height="' + (ph * 0.22) + '" fill="#2E3B3A" opacity=".82"/>';
    }
  }
  var gy = H - pad + 8;
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" ' +
    'aria-label="مخطط واجهة بالأبعاد">' +
    '<rect width="' + W + '" height="' + H + '" fill="#EFEBE3"/>' +
    '<g opacity=".13" stroke="#1B2422" stroke-width=".5">' +
      Array.apply(null, Array(9)).map(function (_, i) {
        return '<line x1="0" y1="' + (i * 34) + '" x2="' + W + '" y2="' + (i * 34) + '"/>' +
               '<line x1="' + (i * 46) + '" y1="0" x2="' + (i * 46) + '" y2="' + H + '"/>';
      }).join('') + '</g>' +
    '<line x1="12" y1="' + (H - pad) + '" x2="' + (W - 12) + '" y2="' + (H - pad) +
      '" stroke="#1B2422" stroke-width="1.2"/>' + body +
    '<g stroke="#A8813F" stroke-width="1" fill="none">' +
      '<line x1="' + x + '" y1="' + gy + '" x2="' + (x + pw) + '" y2="' + gy + '"/>' +
      '<line x1="' + x + '" y1="' + (gy - 5) + '" x2="' + x + '" y2="' + (gy + 5) + '"/>' +
      '<line x1="' + (x + pw) + '" y1="' + (gy - 5) + '" x2="' + (x + pw) + '" y2="' + (gy + 5) + '"/>' +
    '</g>' +
    '<text x="' + (W / 2) + '" y="' + (gy + 20) + '" text-anchor="middle" fill="#A8813F" ' +
      'font-size="13" font-family="IBM Plex Sans Arabic,sans-serif">' +
      (+w.toFixed(1)) + ' م</text></svg>';
}

/* ═══ selection basket, shared across pages via sessionStorage ═══ */
var Basket = {
  key: 'modula.basket',
  get: function () {
    try { return JSON.parse(sessionStorage.getItem(this.key)) || []; }
    catch (e) { return []; }
  },
  set: function (a) {
    try { sessionStorage.setItem(this.key, JSON.stringify(a)); } catch (e) {}
    this.sync();
  },
  has: function (r) { return this.get().indexOf(r) > -1; },
  toggle: function (r) {
    var a = this.get(), i = a.indexOf(r);
    if (i > -1) a.splice(i, 1); else a.push(r);
    this.set(a);
    return i === -1;
  },
  message: function () {
    var refs = this.get();
    var lines = refs.map(function (r, i) {
      var u = byRef(r);
      if (!u) return '';
      return (i + 1) + '. ' + fullTitle(u) + ' — ' + u.ref +
        (u.sqm ? ' — ' + n(u.sqm) + ' م²' : '') + (u.dims ? ' (' + u.dims + ')' : '');
    }).filter(Boolean);
    return 'مرحباً ' + CFG.brand + '،\nأرغب بعرض سعر للوحدات التالية:\n\n' +
      lines.join('\n') + '\n\nالموقع: \nالكمية: ';
  },
  sync: function () {
    var refs = this.get(), c = refs.length;
    var btn = $('#selBtn');
    if (btn) { btn.hidden = c === 0; $('#selN').textContent = c; }
    var list = $('#drList');
    if (list) {
      if (!c) {
        list.innerHTML = '<p class="dr-empty">لم تختر أي وحدة بعد.<br>اضغط + على أي وحدة لإضافتها.</p>';
      } else {
        list.innerHTML = refs.map(function (r) {
          var u = byRef(r);
          if (!u) return '';
          var art = u.imgs.length
            ? '<img class="ph" src="' + CFG.img(u.imgs[0], true) + '" alt="">'
            : '<div class="ph"></div>';
          return '<div class="dr-item">' + art +
            '<div><h3>' + fullTitle(u) + '</h3><p>' + u.ref +
            (u.sqm ? ' · ' + n(u.sqm) + ' م²' : '') + '</p></div>' +
            '<button class="x" data-rm="' + u.ref + '" aria-label="إزالة">' +
            '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
        }).join('');
      }
    }
    var send = $('#drSend');
    if (send) send.href = waLink(this.message());
    $$('.card').forEach(function (el) {
      var on = refs.indexOf(el.dataset.ref) > -1;
      el.classList.toggle('picked', on);
      var b = $('.pick', el);
      if (b) {
        b.setAttribute('aria-pressed', on);
        $('svg', b).innerHTML = on
          ? '<path d="M20 6L9 17l-5-5"/>' : '<path d="M12 5v14M5 12h14"/>';
      }
    });
  }
};

function byRef(r) {
  for (var i = 0; i < UNITS.length; i++) if (UNITS[i].ref === r) return UNITS[i];
  return null;
}
function fullTitle(u) { return u.model ? u.title + ' ' + u.model : u.title; }

function toast(msg) {
  var t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(t._t);
  t._t = setTimeout(function () { t.classList.remove('on'); }, 2100);
}

/* ═══ chrome present on every page ═══ */
function initChrome() {
  var hello = 'مرحباً ' + CFG.brand + '، أرغب بالاستفسار عن الوحدات السكنية الجاهزة.';
  ['#waTop', '#waFoot', '#fab', '#waMain'].forEach(function (s) {
    var el = $(s); if (el) el.href = waLink(hello);
  });

  var hdr = $('#hdr'), fab = $('#fab'), solid = hdr && hdr.classList.contains('solid');
  addEventListener('scroll', function () {
    var past = scrollY > (solid ? 40 : innerHeight * 0.82);
    if (!solid) hdr.classList.toggle('stuck', past);
    if (fab) fab.classList.toggle('on', scrollY > 300);
  }, { passive: true });

  var dr = $('#drawer'), sc = $('#scrim');
  if (dr) {
    var open  = function () { dr.classList.add('open'); sc.classList.add('on'); };
    var close = function () { dr.classList.remove('open'); sc.classList.remove('on'); };
    $('#selBtn').addEventListener('click', open);
    $('#drX').addEventListener('click', close);
    sc.addEventListener('click', close);
    $('#drList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-rm]');
      if (b) { Basket.toggle(b.dataset.rm); toast('أُزيلت من اختياراتك'); }
    });
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('.pick');
    if (!b) return;
    e.preventDefault();
    var ref = b.closest('[data-ref]').dataset.ref;
    toast(Basket.toggle(ref) ? 'أُضيفت إلى اختياراتك' : 'أُزيلت من اختياراتك');
  });

  Basket.sync();
}

/* ═══ catalogue card ═══ */
function cardHTML(u) {
  var dim = u.dims || (u.sqm ? n(u.sqm) + ' م²' : '');
  return '<article class="card" data-ref="' + u.ref + '">' +
    '<a class="card-img" href="' + unitUrl(u) + '">' + artwork(u, true) +
      '<span class="ref">' + u.ref + '</span>' +
      (u.geo ? '<span class="tag3d">عرض ثلاثي الأبعاد</span>' : '') + '</a>' +
    '<button class="pick" aria-label="أضف إلى اختياراتي" aria-pressed="false">' +
      '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>' +
    '<div class="card-b"><span class="card-cat">' + CATS[u.cat] + '</span>' +
      '<h3 class="card-t"><a href="' + unitUrl(u) + '">' + fullTitle(u) + '</a></h3>' +
      '<div class="specs">' +
        (u.sqm ? '<span>المساحة <b>' + n(u.sqm) + ' م²</b></span>' : '') +
        (u.stories >= 2 ? '<span>الطوابق <b>' + u.stories + '</b></span>' : '') +
      '</div>' +
      (dim ? '<div class="dim"><div class="dim-line"><span class="dim-bar"></span><span>' +
        dim + '</span><span class="dim-bar"></span></div></div>' : '') +
    '</div></article>';
}

var reveal = new IntersectionObserver(function (es) {
  es.forEach(function (e, i) {
    if (!e.isIntersecting) return;
    var el = e.target;
    setTimeout(function () { el.classList.add('in'); }, REDUCE ? 0 : Math.min(i, 8) * 45);
    reveal.unobserve(el);
  });
}, { rootMargin: '90px' });

function paint(list, gridEl) {
  gridEl.innerHTML = list.length
    ? list.map(cardHTML).join('')
    : '<div class="empty"><h3>لا توجد وحدات بهذه المواصفات</h3>' +
      '<p>جرّب توسيع نطاق المساحة أو اختيار نوع آخر.</p></div>';
  $$('.card', gridEl).forEach(function (c) { reveal.observe(c); });
  Basket.sync();
}

/* ═══ homepage ═══ */
function initHome() {
  var cat = 'all', maxArea = Infinity, only40 = false, sort = 'def';
  var STEPS = [20, 30, 40, 50, 60, 80, 100, 150, 250, 500, 1000, Infinity];
  var grid = $('#grid');

  function render() {
    var list = UNITS.filter(function (u) {
      return (cat === 'all' || u.cat === cat) &&
             (!u.sqm || u.sqm <= maxArea) &&
             (!only40 || (u.p40 && u.p40 >= 1));
    });
    if (sort === 'asc')  list = list.slice().sort(function (a, b) { return (a.sqm || 1e9) - (b.sqm || 1e9); });
    if (sort === 'desc') list = list.slice().sort(function (a, b) { return (b.sqm || 0) - (a.sqm || 0); });
    paint(list, grid);
    $('#cnt').textContent = list.length;
  }

  $('#chips').addEventListener('click', function (e) {
    var b = e.target.closest('.chip');
    if (!b) return;
    $$('.chip').forEach(function (c) { c.classList.toggle('on', c === b); });
    cat = b.dataset.cat;
    render();
  });
  var area = $('#area');
  area.addEventListener('input', function () {
    maxArea = STEPS[+area.value];
    $('#areaOut').textContent = maxArea === Infinity ? 'الكل' : maxArea + ' م²';
    render();
  });
  $('#c40').addEventListener('change', function (e) { only40 = e.target.checked; render(); });
  $('#sort').addEventListener('change', function (e) { sort = e.target.value; render(); });

  render();
  initStory();
  initCatRail();
  initCounters();
}

/* a model shown beside the process steps — the visitor chooses the view */
function initStory() {
  var cv = document.getElementById('storyCanvas');
  if (!cv || !window.UnitViewer || !window.THREE) return;
  var v = new UnitViewer(cv, { shape: 'box', l: 11.5, w: 3.4, h: 3.3 }, 2,
    { dark: true, arch: 'pod2', pal: { shell: '#E5DCD0', shell2: '#D2C9BC',
      glass: '#28312F', accent: '#C0703A' } });
  if (!v) return;
  v.toggleDims(false);
  requestAnimationFrame(function () { v.resize(); });

  var tools = document.getElementById('storyTools');
  if (tools) tools.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    $$('button', tools).forEach(function (x) { x.classList.toggle('on', x === b); });
    v.setView(b.dataset.v);
  });
}

/* category rail slides horizontally as the section passes through */
function initCatRail() {
  var sec = $('#cats'), tr = $('#catsTrack');
  if (!sec || !tr || REDUCE) return;
  var ticking = false;
  addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var r = sec.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      var p = 1 - (r.top + r.height) / (innerHeight + r.height);
      var over = Math.max(0, tr.scrollWidth - innerWidth + 40);
      tr.style.transform = 'translateX(' + (p * over * 0.85) + 'px)';
    });
  }, { passive: true });
}

/* stat rail counts up once, when it first appears */
function initCounters() {
  var els = $$('[data-count]');
  if (!els.length) return;
  if (REDUCE) { els.forEach(function (e) { e.textContent = e.dataset.count; }); return; }
  var io = new IntersectionObserver(function (list) {
    list.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target, to = +el.dataset.count, t0 = performance.now();
      (function tick(now) {
        var p = Math.min(1, (now - t0) / 900);
        el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
      io.unobserve(el);
    });
  }, { threshold: 0.6 });
  els.forEach(function (e) { io.observe(e); });
}
