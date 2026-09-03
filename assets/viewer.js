/* ─────────────────────────────────────────────────────────────
   عارض ثلاثي الأبعاد
   يبني مجسّماً بمقياس رسم من الأبعاد الحقيقية المسجّلة للوحدة.
   ليس رندراً واقعياً للمنتج — بل نموذج كتلي دقيق النسب،
   بمرجع بشري بطول 1.75 م وخطوط أبعاد.
   ───────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  var C = {
    shell:  0xEDE9E1,
    shell2: 0xDDD7CB,
    glass:  0x2E3B3A,
    brass:  0xA8813F,
    ground: 0xDED8CC,
    ink:    0x1B2422,
    person: 0x8A9490
  };

  /* ── rounded-rectangle footprint, extruded to height ── */
  function volume(l, w, h, radius, color) {
    var r = Math.min(radius, l / 2 - 0.01, w / 2 - 0.01);
    var sh = new THREE.Shape();
    sh.moveTo(-l / 2 + r, -w / 2);
    sh.lineTo(l / 2 - r, -w / 2);
    sh.quadraticCurveTo(l / 2, -w / 2, l / 2, -w / 2 + r);
    sh.lineTo(l / 2, w / 2 - r);
    sh.quadraticCurveTo(l / 2, w / 2, l / 2 - r, w / 2);
    sh.lineTo(-l / 2 + r, w / 2);
    sh.quadraticCurveTo(-l / 2, w / 2, -l / 2, w / 2 - r);
    sh.lineTo(-l / 2, -w / 2 + r);
    sh.quadraticCurveTo(-l / 2, -w / 2, -l / 2 + r, -w / 2);

    var g = new THREE.ExtrudeGeometry(sh, {
      depth: h, bevelEnabled: true,
      bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 8
    });
    g.rotateX(-Math.PI / 2);   // extrusion runs along +Y, base at y=0
    var m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      color: color, roughness: 0.72, metalness: 0.04
    }));
    m.castShadow = m.receiveShadow = true;
    return m;
  }

  /* ── continuous glazing band on one long face ── */
  function glazing(l, w, h, y) {
    var gh = Math.min(h * 0.52, 1.9);
    var g = new THREE.BoxGeometry(l * 0.82, gh, 0.06);
    var m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      color: C.glass, roughness: 0.08, metalness: 0.5,
      transparent: true, opacity: 0.9
    }));
    m.position.set(0, y + h * 0.52, w / 2 + 0.14);
    var grp = new THREE.Group();
    grp.add(m);

    var f = new THREE.Mesh(
      new THREE.BoxGeometry(l * 0.82 + 0.1, gh + 0.1, 0.03),
      new THREE.MeshStandardMaterial({ color: C.brass, roughness: 0.35, metalness: 0.7 })
    );
    f.position.set(0, y + h * 0.52, w / 2 + 0.12);
    grp.add(f);
    return grp;
  }

  function door(l, w, h, y) {
    var dh = Math.min(h * 0.78, 2.1);
    var m = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, dh, 0.05),
      new THREE.MeshStandardMaterial({ color: C.shell2, roughness: 0.6 })
    );
    m.position.set(-l * 0.28, y + dh / 2, w / 2 + 0.13);
    return m;
  }

  function dome(d, h) {
    var r = d / 2;
    var g = new THREE.SphereGeometry(r, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(1, Math.min(h / r, 1.15), 1);
    var m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      color: 0x5E7370, roughness: 0.05, metalness: 0.35,
      transparent: true, opacity: 0.52, side: THREE.DoubleSide
    }));
    m.castShadow = true;
    var grp = new THREE.Group();
    grp.add(m);

    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.05, 8, 48),
      new THREE.MeshStandardMaterial({ color: C.brass, roughness: 0.35, metalness: 0.75 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    grp.add(ring);

    var base = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 1.04, r * 1.04, 0.12, 40),
      new THREE.MeshStandardMaterial({ color: C.shell2, roughness: 0.8 })
    );
    base.position.y = 0.06;
    base.receiveShadow = true;
    grp.add(base);
    return grp;
  }

  /* ── 1.75 m figure, so scale reads instantly ── */
  /* radial alpha so the ground dissolves into the page instead of ending */
  function fadeMap() {
    var cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    var cx = cv.getContext('2d');
    var g = cx.createRadialGradient(128, 128, 20, 128, 128, 126);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.55, 'rgba(255,255,255,.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = g;
    cx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(cv);
  }

  function person() {
    var g = new THREE.Group();
    var mat = new THREE.MeshStandardMaterial({ color: C.person, roughness: 0.9 });
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 1.15, 12), mat);
    body.position.y = 0.87;
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), mat);
    head.position.y = 1.6;
    var legs = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.6, 12), mat);
    legs.position.y = 0.3;
    [body, head, legs].forEach(function (m) { m.castShadow = true; g.add(m); });
    return g;
  }

  /* ── text label drawn to a canvas, shown as a sprite ── */
  function label(text) {
    var pr = 2, pad = 10, fs = 30;
    var cv = document.createElement('canvas');
    var cx = cv.getContext('2d');
    cx.font = '600 ' + fs + 'px "IBM Plex Sans Arabic", system-ui, sans-serif';
    var w = cx.measureText(text).width;
    cv.width = (w + pad * 2) * pr;
    cv.height = (fs + pad * 2) * pr;
    cx = cv.getContext('2d');
    cx.scale(pr, pr);
    cx.fillStyle = 'rgba(27,36,34,.9)';
    cx.beginPath();
    if (cx.roundRect) cx.roundRect(0, 0, cv.width / pr, cv.height / pr, 5);
    else cx.rect(0, 0, cv.width / pr, cv.height / pr);
    cx.fill();
    cx.font = '600 ' + fs + 'px "IBM Plex Sans Arabic", system-ui, sans-serif';
    cx.fillStyle = '#EFEBE3';
    cx.textBaseline = 'middle';
    cx.fillText(text, pad, (fs + pad * 2) / 2);

    var t = new THREE.CanvasTexture(cv);
    t.minFilter = THREE.LinearFilter;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
    sp.scale.set(cv.width / pr / 46, cv.height / pr / 46, 1);
    return sp;
  }

  /* ── dimension line with arrow ends and a value label ── */
  function dimension(a, b, text, offset, k) {
    var g = new THREE.Group();
    var A = a.clone().add(offset), B = b.clone().add(offset);
    var mat = new THREE.LineBasicMaterial({ color: C.brass });

    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([A, B]), mat));
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, A]), mat));
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([b, B]), mat));

    var dir = B.clone().sub(A).normalize();
    [[A, 1], [B, -1]].forEach(function (p) {
      var tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.09, 0.3, 8),
        new THREE.MeshBasicMaterial({ color: C.brass })
      );
      tip.position.copy(p[0]);
      tip.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), dir.clone().multiplyScalar(p[1])
      );
      g.add(tip);
    });

    var l = label(text);
    l.scale.multiplyScalar(k || 1);
    l.position.copy(A.clone().add(B).multiplyScalar(0.5));
    g.add(l);
    return g;
  }

  /* ═══════════════════ public API ═══════════════════ */
  function Viewer(canvas, geo, stories, opts) {
    opts = opts || {};
    var dark = !!opts.dark;
    if (!global.THREE) return null;
    var self = this;
    this.canvas = canvas;
    this.spin = true;

    var W = canvas.clientWidth || 600, H = canvas.clientHeight || 420;

    var renderer = this.renderer = new THREE.WebGLRenderer({
      canvas: canvas, antialias: true, alpha: true, powerPreference: 'low-power'
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(W, H, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;

    var scene = this.scene = new THREE.Scene();
    var camera = this.camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 400);

    /* geometry from the unit's own numbers */
    var l = 8, w = 4, h = 3, isDome = false;
    if (geo && geo.shape === 'dome') {
      isDome = true; l = w = geo.d; h = geo.d * 0.55;
    } else if (geo) {
      l = geo.l || 8; w = geo.w || l * 0.42; h = geo.h || 3.2;
    }

    var model = this.model = new THREE.Group();
    if (isDome) {
      model.add(dome(l, h));
    } else {
      var f1 = volume(l, w, h, Math.min(l, w) * 0.16, C.shell);
      model.add(f1, glazing(l, w, h, 0), door(l, w, h, 0));
      if (stories >= 2) {
        var l2 = l * 0.82, w2 = w, h2 = h;
        var f2 = volume(l2, w2, h2, Math.min(l2, w2) * 0.16, C.shell2);
        f2.position.set(-(l - l2) / 2 * 0.5, h + 0.12, 0);
        model.add(f2);
        var gl2 = glazing(l2, w2, h2, h + 0.12);
        gl2.position.x = -(l - l2) / 2 * 0.5;
        model.add(gl2);
        h = h * 2 + 0.12;
      }
      var capL = stories >= 2 ? l * 0.82 : l;
      var cap = new THREE.Mesh(
        new THREE.BoxGeometry(capL * 0.99, 0.05, w * 0.99),
        new THREE.MeshStandardMaterial({ color: C.brass, roughness: 0.4, metalness: 0.6 })
      );
      cap.position.set(stories >= 2 ? -(l - capL) / 2 * 0.5 : 0, h + 0.03, 0);
      model.add(cap);
    }
    scene.add(model);

    /* ground */
    var span = Math.max(l, w) * 2.1;
    var gp = new THREE.Mesh(
      new THREE.CircleGeometry(span, 48),
      dark
        ? new THREE.ShadowMaterial({ opacity: 0.34 })
        : new THREE.MeshStandardMaterial({
            color: C.ground, roughness: 1,
            transparent: true, alphaMap: fadeMap(), depthWrite: false
          })
    );
    gp.rotation.x = -Math.PI / 2;
    gp.receiveShadow = true;
    scene.add(gp);

    var gc = dark ? 0xFBFAF7 : C.ink;
    var gspan = dark ? span * 1.1 : span * 2;
    var grid = new THREE.GridHelper(gspan, Math.round(gspan), gc, gc);
    grid.material.opacity = dark ? 0.07 : 0.09;
    grid.material.transparent = true;
    grid.position.y = 0.005;
    scene.add(grid);

    /* scale figure */
    var ppl = this.ppl = person();
    ppl.position.set(l * 0.3, 0, w * 0.95);
    scene.add(ppl);

    /* dimension annotations */
    var dims = this.dims = new THREE.Group();
    var lk = Math.max(0.34, Math.min(1.3, Math.max(l, w, h) / 12));
    if (!isDome) {
      dims.add(dimension(
        new THREE.Vector3(-l / 2, 0.02, w / 2), new THREE.Vector3(l / 2, 0.02, w / 2),
        l.toFixed(1).replace(/\.0$/, '') + ' م', new THREE.Vector3(0, 0, w * 0.42), lk));
      dims.add(dimension(
        new THREE.Vector3(l / 2, 0.02, -w / 2), new THREE.Vector3(l / 2, 0.02, w / 2),
        w.toFixed(1).replace(/\.0$/, '') + ' م', new THREE.Vector3(l * 0.3, 0, 0), lk));
      dims.add(dimension(
        new THREE.Vector3(-l / 2, 0, w / 2), new THREE.Vector3(-l / 2, h, w / 2),
        h.toFixed(2).replace(/\.?0+$/, '') + ' م', new THREE.Vector3(-l * 0.18, 0, 0), lk));
    } else {
      dims.add(dimension(
        new THREE.Vector3(-l / 2, 0.02, 0), new THREE.Vector3(l / 2, 0.02, 0),
        'قطر ' + l + ' م', new THREE.Vector3(0, 0, l * 0.72), lk));
    }
    scene.add(dims);

    /* light */
    scene.add(new THREE.HemisphereLight(0xFFFFFF, dark ? 0x3A4644 : 0xC9C2B4, dark ? 0.6 : 0.85));
    var sun = new THREE.DirectionalLight(0xFFF6E8, 1.5);
    sun.position.set(span * 0.7, span * 1.1, span * 0.55);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    var d = span * 1.3;
    Object.assign(sun.shadow.camera, { left: -d, right: d, top: d, bottom: -d, far: d * 4 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0012;
    scene.add(sun);
    scene.add(new THREE.DirectionalLight(0xDDE6E4, 0.35).translateX(-span));

    /* orbit */
    var fit = Math.max(l, w) * 0.62, aspect = W / H;
    var radius = fit / Math.tan(camera.fov * Math.PI / 360) /
                 Math.min(1, aspect * 0.72) + Math.max(l, w) * 0.55;
    var az = -0.72, pol = 1.06, target = new THREE.Vector3(0, h * 0.42, 0);
    this.home = { az: az, pol: pol, r: radius };

    function place() {
      camera.position.set(
        target.x + radius * Math.sin(pol) * Math.sin(az),
        target.y + radius * Math.cos(pol),
        target.z + radius * Math.sin(pol) * Math.cos(az)
      );
      camera.lookAt(target);
    }
    place();

    var drag = null;
    function down(e) {
      drag = { x: e.clientX, y: e.clientY };
      self.spin = false;
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    }
    function move(e) {
      if (!drag) return;
      az -= (e.clientX - drag.x) * 0.008;
      pol = Math.max(0.18, Math.min(1.52, pol - (e.clientY - drag.y) * 0.006));
      drag = { x: e.clientX, y: e.clientY };
      place();
    }
    function up() { drag = null; }
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      radius = Math.max(Math.max(l, w) * 0.9,
               Math.min(Math.max(l, w) * 6, radius + e.deltaY * 0.012 * radius / 10));
      place();
    }, { passive: false });

    this.setView = function (name) {
      self.spin = false;
      var v = { iso: [-0.72, 1.06], front: [0, 1.42], side: [-Math.PI / 2, 1.42], top: [-0.72, 0.22] }[name];
      if (!v) return;
      az = v[0]; pol = v[1]; radius = self.home.r; place();
    };
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

  global.UnitViewer = Viewer;
})(window);
