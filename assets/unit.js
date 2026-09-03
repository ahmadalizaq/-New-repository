/* ═══ product page ═══ */
function initUnit(ref) {
  var u = byRef(ref);
  if (!u) { location.replace(CFG.home); return; }

  document.title = fullTitle(u) + ' · ' + u.ref + ' — ' + CFG.brand;
  $('#uTitle').textContent = fullTitle(u);
  $('#uEyebrow').textContent = u.ref + ' · ' + CATS[u.cat];
  $('#crumbNow').textContent = fullTitle(u);

  /* specs */
  var sp = [];
  if (u.sqm)     sp.push(['المساحة', n(u.sqm) + ' م²']);
  if (u.dims)    sp.push(['الأبعاد', u.dims]);
  if (u.stories) sp.push(['الطوابق', u.stories]);
  var ct = containerTxt(u.p40);
  if (ct)        sp.push(['شحن بحاوية 40 قدم', ct]);
  $('#uSpecs').innerHTML = sp.map(function (s) {
    return '<div><dt>' + s[0] + '</dt><dd>' + s[1] + '</dd></div>';
  }).join('');

  $('#uAmen').innerHTML = u.amen.length
    ? u.amen.map(function (a) { return '<span>' + a + '</span>'; }).join('')
    : '';

  $('#uWa').href = waLink('مرحباً ' + CFG.brand + '، أرغب بعرض سعر لـ: ' +
    fullTitle(u) + ' — ' + u.ref + (u.sqm ? ' — ' + n(u.sqm) + ' م²' : '') + '.\n\nالموقع: ');

  var addBtn = $('#uAdd');
  function syncAdd() {
    addBtn.textContent = Basket.has(u.ref) ? 'إزالة من اختياراتي' : 'أضف إلى اختياراتي';
  }
  addBtn.addEventListener('click', function () {
    toast(Basket.toggle(u.ref) ? 'أُضيفت إلى اختياراتك' : 'أُزيلت من اختياراتك');
    syncAdd();
  });
  syncAdd();

  /* ── photo / 3D tabs ── */
  var view = $('#uView'), tabs = $('#uTabs'), thumbs = $('#uThumbs');
  var viewer = null, mode = u.imgs.length ? 'photo' : (u.geo ? '3d' : 'photo');
  var shot = 0;

  var tabList = [];
  if (u.imgs.length) tabList.push(['photo', 'الصور (' + u.imgs.length + ')']);
  if (u.geo)         tabList.push(['3d', 'مجسّم ثلاثي الأبعاد']);
  tabs.innerHTML = tabList.map(function (t) {
    return '<button class="u-tab' + (t[0] === mode ? ' on' : '') +
      '" data-mode="' + t[0] + '">' + t[1] + '</button>';
  }).join('');
  if (tabList.length < 2) tabs.hidden = true;

  function showPhoto() {
    if (viewer) { viewer.destroy(); viewer = null; }
    view.innerHTML = u.imgs.length
      ? '<img src="' + CFG.img(u.imgs[shot], false) + '" alt="' + fullTitle(u) + '">'
      : (u.geo ? elevationSVG(u.geo, u.stories)
         : u.sqm ? areaSVG(u.sqm)
         : '<div class="noimg"><span>لا توجد صورة</span></div>');
    thumbs.hidden = u.imgs.length < 2;
    thumbs.innerHTML = u.imgs.length < 2 ? '' : u.imgs.map(function (im, i) {
      return '<button class="' + (i === shot ? 'on' : '') + '" data-i="' + i +
        '" aria-label="صورة ' + (i + 1) + '"><img src="' + CFG.img(im, true) + '" alt=""></button>';
    }).join('');
  }

  function show3D() {
    thumbs.hidden = true;
    view.innerHTML =
      '<canvas id="uCanvas"></canvas>' +
      '<p class="u-note3d">مجسّم بمقياس رسم مبني على الأبعاد المسجّلة — ' +
        'للنسب والحجم، وليس رندراً للتشطيب النهائي.</p>' +
      '<div class="u-tools">' +
        '<button data-v="iso">منظور</button>' +
        '<button data-v="front">أمامي</button>' +
        '<button data-v="side">جانبي</button>' +
        '<button data-v="top">علوي</button>' +
        '<button data-t="dims" class="on">الأبعاد</button>' +
        '<button data-t="person" class="on">مرجع بشري</button>' +
      '</div>';
    viewer = new UnitViewer($('#uCanvas'), u.geo, u.stories);
    if (!viewer) { view.innerHTML = '<div class="noimg"><span>المتصفح لا يدعم العرض ثلاثي الأبعاد</span></div>'; return; }
    requestAnimationFrame(function () { viewer.resize(); });
    $('.u-tools', view).addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.v) { viewer.setView(b.dataset.v); return; }
      var on = !b.classList.contains('on');
      b.classList.toggle('on', on);
      if (b.dataset.t === 'dims') viewer.toggleDims(on);
      else viewer.togglePerson(on);
    });
  }

  function apply() { mode === '3d' ? show3D() : showPhoto(); }
  apply();

  tabs.addEventListener('click', function (e) {
    var b = e.target.closest('.u-tab');
    if (!b || b.dataset.mode === mode) return;
    $$('.u-tab', tabs).forEach(function (t) { t.classList.toggle('on', t === b); });
    mode = b.dataset.mode;
    apply();
  });
  thumbs.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    shot = +b.dataset.i;
    showPhoto();
  });

  /* ── related: same category, nearest in size ── */
  var rel = UNITS.filter(function (x) { return x.cat === u.cat && x.ref !== u.ref; })
    .sort(function (a, b) {
      return Math.abs((a.sqm || 0) - (u.sqm || 0)) - Math.abs((b.sqm || 0) - (u.sqm || 0));
    }).slice(0, 4);
  if (rel.length) paint(rel, $('#uRelGrid'));
  else $('#uRel').hidden = true;
}
