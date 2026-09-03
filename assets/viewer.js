/* ─────────────────────────────────────────────────────────────
   عارض ثلاثي الأبعاد

   لكل وحدة نمط بناء خاص، مُسنَد بعد مراجعة صورتها الفعلية:
   كبسولة مدبّبة، أسطوانة، خيمة مثلثة، حاوية بأجنحة تتوسّع،
   بيت بسقف هرمي، كابينة خشبية بواجهة زجاجية، فيلا بطابقين،
   مبنى متعدد الطوابق، سقف مقوّس، قبة جيوديسية.

   الأبعاد من بيانات الوحدة، والألوان مستخرجة من صورتها.

   إن توفّر ملف ثلاثي الأبعاد من المورّد (.glb) يُحمَّل بدلاً من
   النمط البرمجي ويظهر المنتج كما هو تماماً — أضف "glb" في data.js.
   ───────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  var FALLBACK = {
    shell: 0xEDE9E1, shell2: 0xDDD7CB, glass: 0x2E3B3A,
    accent: 0xA8813F, roof: 0x4A5250, ground: 0xD3CEC2, person: 0x8A9490
  };

  function hex(v, d) {
    return (typeof v === 'string' && v.charAt(0) === '#') ? parseInt(v.slice(1), 16) : d;
  }
  function darken(c, k) {
    var r = (c >> 16 & 255) * k, g = (c >> 8 & 255) * k, b = (c & 255) * k;
    return (r << 16 | g << 8 | b) | 0;
  }
  function mat(color, rough, metal) {
    return new THREE.MeshStandardMaterial({
      color: color, roughness: rough == null ? 0.72 : rough, metalness: metal || 0.04
    });
  }
  function glassMat(color, op) {
    return new THREE.MeshStandardMaterial({
      color: color, roughness: 0.07, metalness: 0.45,
      transparent: true, opacity: op == null ? 0.86 : op
    });
  }
  function box(l, h, d, material, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(l, h, d), material);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = m.receiveShadow = true;
    return m;
  }
  function outline(mesh, geo, opacity) {
    return new THREE.LineSegments(new THREE.EdgesGeometry(geo, 24),
      new THREE.LineBasicMaterial({
        color: 0x1B2422, transparent: true, opacity: opacity || 0.2 }));
  }

  /* rounded-rectangle plan, extruded upward; taper narrows one end */
  function slab(l, w, h, radius, material, taper) {
    var r = Math.max(0.001, Math.min(radius, l / 2 - 0.01, w / 2 - 0.01));
    var tw = w * (taper || 1);
    var tr = Math.max(0.001, Math.min(r, tw / 2 - 0.01));
    var s = new THREE.Shape();
    s.moveTo(-l / 2 + r, -w / 2);
    s.lineTo(l / 2 - tr, -tw / 2);
    s.quadraticCurveTo(l / 2, -tw / 2, l / 2, -tw / 2 + tr);
    s.lineTo(l / 2, tw / 2 - tr);
    s.quadraticCurveTo(l / 2, tw / 2, l / 2 - tr, tw / 2);
    s.lineTo(-l / 2 + r, w / 2);
    s.quadraticCurveTo(-l / 2, w / 2, -l / 2, w / 2 - r);
    s.lineTo(-l / 2, -w / 2 + r);
    s.quadraticCurveTo(-l / 2, -w / 2, -l / 2 + r, -w / 2);
    var g = new THREE.ExtrudeGeometry(s, {
      depth: h, bevelEnabled: true, bevelThickness: 0.05,
      bevelSize: 0.05, bevelSegments: 2, curveSegments: 10 });
    g.rotateX(-Math.PI / 2);
    var m = new THREE.Mesh(g, material);
    m.castShadow = m.receiveShadow = true;
    var grp = new THREE.Group();
    grp.add(m, outline(m, g));
    return grp;
  }

  /* hip or gable roof over an l × w plan */
  function roof(l, w, rise, over, hip, material) {
    var L = l / 2 + over, W = w / 2 + over;
    var inset = hip ? Math.min(w / 2, l / 4) : 0;
    var v = [
      -L, 0, -W,   L, 0, -W,   L, 0, W,   -L, 0, W,          // 0..3 eaves
      -L + inset, rise, 0,   L - inset, rise, 0               // 4,5 ridge
    ];
    var f = [0, 1, 5, 0, 5, 4,  2, 3, 4, 2, 4, 5,
             1, 2, 5,  3, 0, 4];
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setIndex(f);
    g.computeVertexNormals();
    var m = new THREE.Mesh(g, material);
    m.material.side = THREE.DoubleSide;
    m.castShadow = m.receiveShadow = true;
    var grp = new THREE.Group();
    grp.add(m, outline(m, g, 0.26));
    return grp;
  }

  /* evenly spaced windows across a facade */
  function windows(l, w, h, y, cols, rows, P, inset) {
    var g = new THREE.Group();
    var gm = glassMat(P.glass), fm = mat(P.accent, 0.4, 0.5);
    var cw = l / cols * 0.56, ch = h / rows * 0.5;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var x = -l / 2 + (c + 0.5) * (l / cols);
        var yy = y + (r + 0.5) * (h / rows);
        for (var s = -1; s <= 1; s += 2) {
          g.add(box(cw, ch, 0.05, gm, x, yy, s * (w / 2 + (inset || 0.06))));
          g.add(box(cw + 0.09, ch + 0.09, 0.025, fm, x, yy, s * (w / 2 + (inset || 0.06) - 0.02)));
        }
      }
    }
    return g;
  }

  /* one continuous glazed band along the front */
  function band(l, w, h, y, P, frac) {
    var g = new THREE.Group();
    var gh = Math.min(h * (frac || 0.52), 2);
    g.add(box(l * 0.82, gh, 0.06, glassMat(P.glass), 0, y + h * 0.52, w / 2 + 0.13));
    g.add(box(l * 0.82 + 0.1, gh + 0.1, 0.03, mat(P.accent, 0.35, 0.7),
              0, y + h * 0.52, w / 2 + 0.11));
    return g;
  }

  function stair(x, z, top, P, dir) {
    var g = new THREE.Group();
    var n = Math.max(6, Math.round(top / 0.23));
    var m = mat(P.shell2, 0.8);
    for (var i = 0; i < n; i++) {
      g.add(box(0.95, 0.06, 0.26, m, x, (i + 1) * (top / n), z + (dir || -1) * i * 0.26));
    }
    var rm = mat(P.accent, 0.4, 0.6);
    for (var s = -1; s <= 1; s += 2) {
      var rail = box(0.05, 0.05, Math.sqrt(top * top + (n * 0.26) * (n * 0.26)), rm,
        x + s * 0.45, top * 0.55 + 0.5, z + (dir || -1) * n * 0.13);
      rail.rotation.x = Math.atan2(top, n * 0.26) * (dir || -1) * -1;
      g.add(rail);
    }
    return g;
  }

  function deck(l, w, y, P, depth) {
    var g = new THREE.Group();
    var dw = depth || w * 0.4;
    g.add(box(l, 0.12, dw, mat(P.shell2, 0.86), 0, y + 0.06, w / 2 + dw / 2));
    var rm = mat(P.accent, 0.4, 0.6);
    g.add(box(l, 0.05, 0.05, rm, 0, y + 1.05, w / 2 + dw));
    for (var i = 0; i <= 8; i++) {
      g.add(box(0.045, 1, 0.045, rm, -l / 2 + i * (l / 8), y + 0.6, w / 2 + dw));
    }
    return g;
  }

  function corrugate(l, w, h, y, color) {
    var g = new THREE.Group();
    var n = Math.max(6, Math.min(28, Math.round(l / 0.4)));
    var geo = new THREE.BoxGeometry(0.07, h * 0.92, 0.06), m = mat(color, 0.75);
    for (var i = 0; i < n; i++) {
      var x = -l / 2 + (i + 0.5) * (l / n);
      for (var s = -1; s <= 1; s += 2) {
        var r = new THREE.Mesh(geo, m);
        r.position.set(x, y + h * 0.5, s * (w / 2 + 0.04));
        r.castShadow = true;
        g.add(r);
      }
    }
    var pm = mat(darken(color, 0.35), 0.55, 0.3);
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (c) {
      g.add(box(0.18, h, 0.18, pm, c[0] * (l / 2 - 0.02), y + h / 2, c[1] * (w / 2 - 0.02)));
    });
    return g;
  }

  /* ═══════════ archetypes ═══════════
     each returns { g: Group, h: total height }               */
  var ARCH = {};

  /* elongated space capsule: tapered nose, wrap-around glazing, trim stripe */
  ARCH.pod = function (l, w, h, st, P) {
    var g = new THREE.Group();
    g.add(slab(l, w, h, w * 0.46, mat(P.shell, 0.55, 0.06), 0.62));
    /* glazing wraps the front and turns the corner onto the nose */
    g.add(box(l * 0.46, h * 0.6, 0.07, glassMat(P.glass, 0.9),
             -l * 0.14, h * 0.52, w / 2 + 0.1));
    g.add(box(l * 0.46 + 0.14, h * 0.6 + 0.14, 0.035, mat(P.accent, 0.32, 0.7),
             -l * 0.14, h * 0.52, w / 2 + 0.08));
    g.add(box(0.07, h * 0.52, w * 0.34, glassMat(P.glass, 0.9), l * 0.47, h * 0.54, 0));
    /* accent stripe running the length, the signature of these pods */
    g.add(box(l * 0.99, 0.09, w * 1.005, mat(P.accent, 0.35, 0.65), 0, h * 0.86, 0));
    g.add(box(l * 0.99, 0.07, w * 1.002, mat(P.accent, 0.35, 0.65), 0, h * 0.13, 0));
    g.add(box(0.85, Math.min(h * 0.72, 2.05), 0.05, mat(P.shell2, 0.6),
             -l * 0.36, Math.min(h * 0.72, 2.05) / 2, w / 2 + 0.1));
    return { g: g, h: h };
  };

  /* two capsules stacked, with terrace and external stair */
  ARCH.pod2 = function (l, w, h, st, P) {
    var g = new THREE.Group(), l2 = l * 0.8;
    var a = ARCH.pod(l, w, h, 1, P); g.add(a.g);
    var b = ARCH.pod(l2, w, h, 1, P);
    b.g.position.set(-(l - l2) * 0.28, h + 0.14, 0);
    g.add(b.g);
    g.add(deck(l * 0.4, w, h, P, w * 0.5).translateX(l * 0.26));
    g.add(stair(l * 0.24 + l * 0.2 + 0.55, w * 0.55, h, P, -1));
    return { g: g, h: h * 2 + 0.14 };
  };

  /* cylindrical pod with a glazed band and a shallow domed top */
  ARCH.drum = function (l, w, h, st, P) {
    var g = new THREE.Group(), r = Math.max(l, w) / 2;
    g.add(box(0, 0, 0, mat(P.shell)));
    var body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h * 0.82, 40), mat(P.shell, 0.6));
    body.position.y = h * 0.41; body.castShadow = body.receiveShadow = true;
    g.add(body);
    var gl = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 1.005, r * 1.005, h * 0.44, 40, 1, true),
      glassMat(P.glass, 0.72));
    gl.position.y = h * 0.46; gl.material.side = THREE.DoubleSide;
    g.add(gl);
    var top = new THREE.Mesh(
      new THREE.SphereGeometry(r, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(P.shell2, 0.65));
    top.scale.y = h * 0.3 / r; top.position.y = h * 0.82; top.castShadow = true;
    g.add(top);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.01, 0.06, 8, 48),
      mat(P.accent, 0.35, 0.7));
    ring.rotation.x = Math.PI / 2; ring.position.y = h * 0.82;
    g.add(ring);
    return { g: g, h: h * 1.12 };
  };

  /* triangular A-frame */
  ARCH.aframe = function (l, w, h, st, P) {
    var g = new THREE.Group();
    var s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0);
    var geo = new THREE.ExtrudeGeometry(s, { depth: l, bevelEnabled: false });
    geo.rotateY(Math.PI / 2); geo.translate(-l / 2, 0, 0);
    var m = new THREE.Mesh(geo, mat(P.shell, 0.68));
    m.castShadow = m.receiveShadow = true;
    g.add(m, outline(m, geo, 0.3));
    g.add(box(0.08, h * 0.72, w * 0.5, glassMat(P.glass), l / 2 + 0.03, h * 0.32, 0));
    g.add(box(0.05, h * 0.72 + 0.1, w * 0.5 + 0.1, mat(P.accent, 0.4, 0.6),
             l / 2 + 0.01, h * 0.32, 0));
    g.add(deck(l * 0.5, w, 0, P, w * 0.35));
    return { g: g, h: h };
  };

  /* container that folds out into side wings */
  ARCH.expand = function (l, w, h, st, P) {
    var g = new THREE.Group(), cw = w * 0.46;
    g.add(slab(l, cw, h, 0.12, mat(P.shell, 0.68)));
    g.add(corrugate(l, cw, h, 0, darken(P.shell, 0.72)));
    for (var s = -1; s <= 1; s += 2) {
      var wingW = (w - cw) / 2;
      var wing = slab(l * 0.94, wingW, h * 0.92, 0.08, mat(P.shell2, 0.7));
      wing.position.set(0, 0, s * (cw / 2 + wingW / 2));
      g.add(wing);
      g.add(box(l * 0.6, h * 0.44, 0.06, glassMat(P.glass),
                0, h * 0.5, s * (cw / 2 + wingW + 0.05)));
      g.add(box(l * 0.6 + 0.1, h * 0.44 + 0.1, 0.03, mat(P.accent, 0.4, 0.6),
                0, h * 0.5, s * (cw / 2 + wingW + 0.03)));
      var rf = roof(l * 0.94, wingW, h * 0.14, 0.12, false, mat(darken(P.shell, 0.5), 0.7));
      rf.position.set(0, h * 0.92, s * (cw / 2 + wingW / 2));
      rf.scale.z = 0.9;
      g.add(rf);
    }
    g.add(box(l * 0.99, 0.08, cw * 0.99, mat(darken(P.shell, 0.35), 0.5, 0.3), 0, h, 0));
    return { g: g, h: h * 1.1 };
  };

  /* plain corrugated shipping container */
  ARCH.container = function (l, w, h, st, P) {
    var g = new THREE.Group();
    g.add(slab(l, w, h, 0.1, mat(P.shell, 0.7)));
    g.add(corrugate(l, w, h, 0, darken(P.shell, 0.75)));
    g.add(band(l, w, h, 0, P, 0.42));
    g.add(box(l * 0.99, 0.1, w * 0.99, mat(darken(P.shell, 0.4), 0.5, 0.3), 0, h, 0));
    return { g: g, h: h };
  };

  /* single-storey house with a hipped roof and a porch */
  ARCH.house = function (l, w, h, st, P) {
    var g = new THREE.Group(), wall = Math.min(h, 3.1);
    g.add(slab(l, w, wall, 0.06, mat(P.shell, 0.85)));
    g.add(windows(l, w, wall * 0.6, wall * 0.22, Math.max(2, Math.round(l / 3)), 1, P));
    var rise = Math.max(1.1, Math.min(w * 0.34, 2.4));
    var rf = roof(l, w, rise, 0.5, true, mat(P.roof, 0.85));
    rf.position.y = wall;
    g.add(rf);
    /* porch */
    var pd = Math.min(1.6, w * 0.3);
    g.add(box(l * 0.42, 0.1, pd, mat(P.shell2, 0.9), 0, 0.05, w / 2 + pd / 2));
    var col = mat(P.shell2, 0.7);
    for (var i = -1; i <= 1; i += 2) {
      g.add(box(0.16, wall * 0.78, 0.16, col, i * l * 0.19, wall * 0.39, w / 2 + pd * 0.85));
    }
    g.add(box(l * 0.44, 0.12, pd + 0.2, mat(P.roof, 0.85),
              0, wall * 0.8, w / 2 + pd / 2));
    g.add(box(0.95, wall * 0.68, 0.06, mat(P.accent, 0.5), 0, wall * 0.34, w / 2 + 0.05));
    return { g: g, h: wall + rise };
  };

  /* timber cabin: steep gable, fully glazed gable end, veranda */
  ARCH.cabin = function (l, w, h, st, P) {
    var g = new THREE.Group(), wall = Math.min(h, 2.9);
    g.add(slab(l, w, wall, 0.05, mat(P.shell, 0.9)));
    var rise = Math.max(1.6, w * 0.62);
    var rf = roof(l, w, rise, 0.35, false, mat(P.roof, 0.82));
    rf.position.y = wall;
    g.add(rf);
    /* glazed gable end */
    var s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, rise); s.lineTo(-w / 2, 0);
    var geo = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: false });
    geo.rotateY(Math.PI / 2);
    var gable = new THREE.Mesh(geo, glassMat(P.glass, 0.82));
    gable.position.set(l / 2 + 0.04, wall, 0);
    g.add(gable);
    g.add(box(0.05, wall * 0.8, w * 0.72, glassMat(P.glass), l / 2 + 0.04, wall * 0.44, 0));
    g.add(box(0.03, wall * 0.8 + 0.1, w * 0.72 + 0.1, mat(P.accent, 0.4, 0.5),
              l / 2 + 0.02, wall * 0.44, 0));
    g.add(windows(l * 0.8, w, wall * 0.5, wall * 0.28, 3, 1, P));
    g.add(deck(l * 0.55, w, 0, P, w * 0.42).translateX(-l * 0.16));
    return { g: g, h: wall + rise };
  };

  /* two-storey villa with balcony and pitched roof */
  ARCH.villa2 = function (l, w, h, st, P) {
    var g = new THREE.Group(), fl = Math.min(h, 3.1);
    g.add(slab(l, w, fl, 0.06, mat(P.shell, 0.85)));
    g.add(windows(l, w, fl * 0.55, fl * 0.24, Math.max(2, Math.round(l / 3.2)), 1, P));
    g.add(box(l * 1.02, 0.16, w * 1.02, mat(P.shell2, 0.8), 0, fl, 0));
    var up = slab(l * 0.96, w * 0.96, fl, 0.06, mat(P.shell2, 0.85));
    up.position.y = fl + 0.16;
    g.add(up);
    var win2 = windows(l * 0.96, w * 0.96, fl * 0.55, fl * 0.24,
                       Math.max(2, Math.round(l / 3.2)), 1, P);
    win2.position.y = fl + 0.16;
    g.add(win2);
    var rise = Math.max(1.1, Math.min(w * 0.3, 2.2));
    var rf = roof(l, w, rise, 0.45, true, mat(P.roof, 0.85));
    rf.position.y = fl * 2 + 0.16;
    g.add(rf);
    g.add(deck(l * 0.5, w, fl + 0.16, P, w * 0.22).translateX(-l * 0.12));
    return { g: g, h: fl * 2 + 0.16 + rise };
  };

  /* multi-storey block: slab bands, window grid, parapet */
  ARCH.block = function (l, w, h, st, P) {
    var g = new THREE.Group();
    var floors = Math.max(2, Math.min(8, Math.round(st) || 3));
    var fl = Math.max(3, h);
    for (var i = 0; i < floors; i++) {
      var y = i * fl;
      var body = slab(l, w, fl * 0.98, 0.05, mat(i % 2 ? P.shell2 : P.shell, 0.85));
      body.position.y = y;
      g.add(body);
      g.add(windows(l, w, fl * 0.5, y + fl * 0.26,
                    Math.max(3, Math.round(l / 3.4)), 1, P));
      g.add(box(l * 1.03, 0.18, w * 1.03, mat(P.accent, 0.6, 0.3), 0, y + fl, 0));
    }
    var top = floors * fl;
    g.add(box(l * 1.02, 0.55, w * 1.02, mat(P.shell2, 0.8), 0, top + 0.27, 0));
    g.add(box(l * 0.3, fl * 0.9, 0.08, glassMat(P.glass), -l * 0.3, fl * 0.45, w / 2 + 0.08));
    return { g: g, h: top + 0.55 };
  };

  /* long-span shed with an arched roof on columns */
  ARCH.shed = function (l, w, h, st, P) {
    var g = new THREE.Group();
    var ht = Math.max(h, 4);
    var arc = new THREE.Mesh(
      new THREE.CylinderGeometry(w / 2, w / 2, l, 28, 1, true, 0, Math.PI),
      mat(P.roof, 0.7, 0.25));
    arc.rotation.z = Math.PI / 2;
    arc.position.y = ht;
    arc.material.side = THREE.DoubleSide;
    arc.castShadow = true;
    g.add(arc);
    g.add(new THREE.LineSegments(
      new THREE.WireframeGeometry(arc.geometry),
      new THREE.LineBasicMaterial({ color: P.accent, transparent: true, opacity: 0.35 }))
      .translateY(ht).rotateZ(Math.PI / 2));
    var cm = mat(P.shell2, 0.7, 0.3);
    var n = Math.max(3, Math.round(l / 4));
    for (var i = 0; i <= n; i++) {
      var x = -l / 2 + i * (l / n);
      for (var s = -1; s <= 1; s += 2) {
        g.add(box(0.22, ht, 0.22, cm, x, ht / 2, s * w / 2));
      }
    }
    g.add(box(l, 0.12, w, mat(darken(P.shell, 0.95), 0.95), 0, 0.06, 0));
    return { g: g, h: ht + w / 2 };
  };

  /* geodesic glass dome */
  ARCH.dome = function (l, w, h, st, P) {
    var g = new THREE.Group(), r = l / 2;
    var geo = new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    geo.scale(1, Math.min(h / r, 1.15), 1);
    var skin = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: P.glass, roughness: 0.05, metalness: 0.35, flatShading: true,
      transparent: true, opacity: 0.46, side: THREE.DoubleSide }));
    skin.castShadow = true;
    g.add(skin);
    g.add(new THREE.LineSegments(new THREE.WireframeGeometry(geo),
      new THREE.LineBasicMaterial({ color: P.accent, transparent: true, opacity: 0.8 })));
    var ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 8, 48),
      mat(P.accent, 0.35, 0.75));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.06;
    g.add(ring);
    var base = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.06, r * 1.06, 0.14, 40),
      mat(P.shell, 0.8));
    base.position.y = 0.07; base.receiveShadow = true;
    g.add(base);
    return { g: g, h: h };
  };

  /* ── scene furniture ── */
  function person() {
    var g = new THREE.Group(), m = mat(FALLBACK.person, 0.9);
    var b = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 1.15, 12), m);
    b.position.y = 0.87;
    var hd = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), m);
    hd.position.y = 1.6;
    var lg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.6, 12), m);
    lg.position.y = 0.3;
    [b, hd, lg].forEach(function (x) { x.castShadow = true; g.add(x); });
    return g;
  }

  function fadeMap() {
    var cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    var cx = cv.getContext('2d');
    var gr = cx.createRadialGradient(128, 128, 20, 128, 128, 126);
    gr.addColorStop(0, '#fff');
    gr.addColorStop(0.55, 'rgba(255,255,255,.85)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(cv);
  }

  function label(text) {
    var pr = 2, pad = 10, fs = 30;
    var cv = document.createElement('canvas');
    var cx = cv.getContext('2d');
    cx.font = '600 ' + fs + 'px "IBM Plex Sans Arabic", system-ui, sans-serif';
    var w = cx.measureText(text).width;
    cv.width = (w + pad * 2) * pr; cv.height = (fs + pad * 2) * pr;
    cx = cv.getContext('2d'); cx.scale(pr, pr);
    cx.fillStyle = 'rgba(27,36,34,.9)';
    cx.beginPath();
    if (cx.roundRect) cx.roundRect(0, 0, cv.width / pr, cv.height / pr, 5);
    else cx.rect(0, 0, cv.width / pr, cv.height / pr);
    cx.fill();
    cx.font = '600 ' + fs + 'px "IBM Plex Sans Arabic", system-ui, sans-serif';
    cx.fillStyle = '#EFEBE3'; cx.textBaseline = 'middle';
    cx.fillText(text, pad, (fs + pad * 2) / 2);
    var t = new THREE.CanvasTexture(cv);
    t.minFilter = THREE.LinearFilter;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
    sp.scale.set(cv.width / pr / 46, cv.height / pr / 46, 1);
    return sp;
  }

  function dimension(a, b, text, offset, k) {
    var g = new THREE.Group();
    var A = a.clone().add(offset), B = b.clone().add(offset);
    var lm = new THREE.LineBasicMaterial({ color: 0xA8813F });
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([A, B]), lm));
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, A]), lm));
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([b, B]), lm));
    var dir = B.clone().sub(A).normalize();
    [[A, 1], [B, -1]].forEach(function (p) {
      var tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 8),
        new THREE.MeshBasicMaterial({ color: 0xA8813F }));
      tip.position.copy(p[0]);
      tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0),
        dir.clone().multiplyScalar(p[1]));
      g.add(tip);
    });
    var lb = label(text);
    lb.scale.multiplyScalar(k || 1);
    lb.position.copy(A.clone().add(B).multiplyScalar(0.5));
    g.add(lb);
    return g;
  }

  /* ═══════════════════ public API ═══════════════════ */
  function Viewer(canvas, geo, stories, opts) {
    if (!global.THREE) return null;
    opts = opts || {};
    var self = this, dark = !!opts.dark, pal = opts.pal || {};
    this.canvas = canvas;
    this.spin = true;

    var P = {
      shell:  hex(pal.shell,  FALLBACK.shell),
      shell2: hex(pal.shell2, FALLBACK.shell2),
      glass:  hex(pal.glass,  FALLBACK.glass),
      accent: hex(pal.accent, FALLBACK.accent)
    };
    P.roof = hex(pal.roof, darken(P.glass, 1.25) || FALLBACK.roof);

    var W = canvas.clientWidth || 600, H = canvas.clientHeight || 420;
    var renderer = this.renderer = new THREE.WebGLRenderer({
      canvas: canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(W, H, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;

    var scene = this.scene = new THREE.Scene();
    var camera = this.camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 400);

    var l = 8, w = 4, h = 3, isDome = false;
    if (geo && geo.shape === 'dome') { isDome = true; l = w = geo.d; h = geo.d * 0.55; }
    else if (geo) { l = geo.l || 8; w = geo.w || l * 0.42; h = geo.h || 3.2; }

    var name = opts.arch || (isDome ? 'dome' : 'container');
    var build = ARCH[name] || ARCH.container;
    var made = build(l, w, h, stories || 1, P);
    var model = this.model = made.g;
    var total = made.h || h;
    scene.add(model);

    var span = Math.max(l, w) * 2.1;
    var gp = new THREE.Mesh(new THREE.CircleGeometry(span, 48),
      dark ? new THREE.ShadowMaterial({ opacity: 0.34 })
           : new THREE.MeshStandardMaterial({ color: FALLBACK.ground, roughness: 1,
               transparent: true, alphaMap: fadeMap(), depthWrite: false }));
    gp.rotation.x = -Math.PI / 2;
    gp.receiveShadow = true;
    scene.add(gp);

    var gc = dark ? 0xFBFAF7 : 0x1B2422;
    var gspan = dark ? span * 1.1 : span * 2;
    var grid = new THREE.GridHelper(gspan, Math.round(gspan), gc, gc);
    grid.material.opacity = dark ? 0.07 : 0.09;
    grid.material.transparent = true;
    grid.position.y = 0.005;
    scene.add(grid);

    var ppl = this.ppl = person();
    ppl.position.set(l * 0.3, 0, w * 0.98);
    scene.add(ppl);

    var dims = this.dims = new THREE.Group();
    var lk = Math.max(0.34, Math.min(1.3, Math.max(l, w, total) / 12));
    var fm = function (v) { return (+v.toFixed(2)) + ' م'; };
    if (!isDome) {
      dims.add(dimension(new THREE.Vector3(-l / 2, 0.02, w / 2),
        new THREE.Vector3(l / 2, 0.02, w / 2), fm(l),
        new THREE.Vector3(0, 0, w * 0.5), lk));
      dims.add(dimension(new THREE.Vector3(l / 2, 0.02, -w / 2),
        new THREE.Vector3(l / 2, 0.02, w / 2), fm(w),
        new THREE.Vector3(l * 0.32, 0, 0), lk));
      dims.add(dimension(new THREE.Vector3(-l / 2, 0, w / 2),
        new THREE.Vector3(-l / 2, total, w / 2), fm(total),
        new THREE.Vector3(-l * 0.2, 0, 0), lk));
    } else {
      dims.add(dimension(new THREE.Vector3(-l / 2, 0.02, 0),
        new THREE.Vector3(l / 2, 0.02, 0), 'قطر ' + (+l.toFixed(2)) + ' م',
        new THREE.Vector3(0, 0, l * 0.72), lk));
    }
    scene.add(dims);

    scene.add(new THREE.HemisphereLight(0xFFFFFF, dark ? 0x3A4644 : 0xB6AE9E, dark ? 0.6 : 0.62));
    var sun = new THREE.DirectionalLight(0xFFF6E8, dark ? 1.5 : 1.35);
    sun.position.set(span * 0.7, span * 1.15, span * 0.55);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    var d = span * 1.4;
    Object.assign(sun.shadow.camera, { left: -d, right: d, top: d, bottom: -d, far: d * 4 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0012;
    scene.add(sun);
    scene.add(new THREE.DirectionalLight(0xDDE6E4, 0.35).translateX(-span));

    var fit = Math.max(l, w, total * 1.15) * 0.62, aspect = W / H;
    var radius = fit / Math.tan(camera.fov * Math.PI / 360) /
                 Math.min(1, aspect * 0.72) + Math.max(l, w) * 0.5;
    var az = -0.72, pol = 1.02, target = new THREE.Vector3(0, total * 0.42, 0);
    this.home = { r: radius };

    function place() {
      camera.position.set(
        target.x + radius * Math.sin(pol) * Math.sin(az),
        target.y + radius * Math.cos(pol),
        target.z + radius * Math.sin(pol) * Math.cos(az));
      camera.lookAt(target);
    }
    place();

    var drag = null;
    canvas.addEventListener('pointerdown', function (e) {
      drag = { x: e.clientX, y: e.clientY };
      self.spin = false;
      if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drag) return;
      az -= (e.clientX - drag.x) * 0.008;
      pol = Math.max(0.18, Math.min(1.52, pol - (e.clientY - drag.y) * 0.006));
      drag = { x: e.clientX, y: e.clientY };
      place();
    });
    addEventListener('pointerup', function () { drag = null; });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      radius = Math.max(Math.max(l, w) * 0.9,
        Math.min(Math.max(l, w) * 6, radius + e.deltaY * 0.012 * radius / 10));
      place();
    }, { passive: false });

    if (opts.glb && THREE.GLTFLoader) {
      new THREE.GLTFLoader().load(opts.glb, function (res) {
        var obj = res.scene;
        var bb = new THREE.Box3().setFromObject(obj);
        var size = bb.getSize(new THREE.Vector3());
        obj.scale.setScalar(Math.max(l, w) / Math.max(size.x, size.z || 1));
        bb.setFromObject(obj);
        var c = bb.getCenter(new THREE.Vector3());
        obj.position.set(-c.x, -bb.min.y, -c.z);
        obj.traverse(function (nd) {
          if (nd.isMesh) nd.castShadow = nd.receiveShadow = true; });
        scene.remove(model);
        model = self.model = obj;
        scene.add(obj);
      }, null, function () { /* keep the procedural model */ });
    }

    this.setView = function (v) {
      self.spin = false;
      var t = { iso: [-0.72, 1.02], front: [0, 1.42],
                side: [-Math.PI / 2, 1.42], top: [-0.72, 0.22] }[v];
      if (!t) return;
      az = t[0]; pol = t[1]; radius = self.home.r; place();
    };
    this.toggleSpin   = function (on) { self.spin = on; };
    this.toggleDims   = function (on) { dims.visible = on; };
    this.togglePerson = function (on) { ppl.visible = on; };
    this.resize = function () {
      var w2 = canvas.clientWidth, h2 = canvas.clientHeight;
      if (!w2 || !h2) return;
      renderer.setSize(w2, h2, false);
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
    };

    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var running = true;
    (function loop() {
      if (!running) return;
      requestAnimationFrame(loop);
      if (self.spin && !reduce) { az -= 0.0022; place(); }
      renderer.render(scene, camera);
    })();
    this.destroy = function () { running = false; renderer.dispose(); };
    addEventListener('resize', this.resize);
  }

  Viewer.archetypes = ARCH;
  global.UnitViewer = Viewer;
})(window);
