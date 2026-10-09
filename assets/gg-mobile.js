/* gg-mobile.js — GameGob shared mobile runtime (2026-10-04).
 * Loaded synchronously in <head> by every game page. Provides shared features no
 * game should have to reimplement, without touching any game's own code:
 *   1. Pause on hide: requestAnimationFrame callbacks queue while the tab or
 *      app is hidden and flush when it returns, so no game burns CPU in the
 *      background and no physics step sees a 30-second frame.
 *   2. Audio unlock: every AudioContext the page creates is resumed on the
 *      first touch/key, which is what iOS and Chrome require.
 *   3. Gesture lock: no pinch zoom, no double-tap zoom, no scroll bounce on
 *      canvas drags. Scrollable UI outside a canvas keeps scrolling.
 *   4. Virtual keypad: for games that only listen to the keyboard
 *      (<html data-gg-keypad="arrows space enter">), an on-screen d-pad and
 *      buttons dispatch real KeyboardEvents on touch devices.
 *   5. SightX input: GG.createInput(options) loads the vendored WeylandInput
 *      and resolves to its controller. New games read controller.state()
 *      each frame for stick + WASD/arrows; no hold/double-tap recognizers.
 * It also exposes window.GG with the native-shell flag the ad loader uses.
 */
(function () {
  'use strict';
  if (window.GG) return;
  var native = !!(window.Capacitor || navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
  var coarse = !!(window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches);
  var GG = window.GG = { version: '20261009', native: native, coarse: coarse, paused: false, keypad: null };

  // SightX is the input base for new games. Resolve beside this kit so the
  // same local vendor works on the web, under a subpath, and in native bundles.
  // Load on demand: legacy games keep their controls until migrated.
  var kitURL = document.currentScript && document.currentScript.src;
  var inputLibrary = null;
  GG.createInput = function (options) {
    if (!inputLibrary) {
      inputLibrary = new Promise(function (resolve, reject) {
        if (window.WeylandInput) { resolve(window.WeylandInput); return; }
        var script = document.createElement('script');
        script.src = new URL('weyland-input.js?v=100073ef1640', kitURL || new URL('assets/gg-mobile.js', document.baseURI)).href;
        script.onload = function () {
          if (window.WeylandInput) resolve(window.WeylandInput);
          else reject(new Error('SightX input did not initialize'));
        };
        script.onerror = function () { reject(new Error('SightX input could not load')); };
        document.head.appendChild(script);
      });
    }
    return inputLibrary.then(function (input) { return input.create(options); });
  };

  // ---- 1. Pause on hide (rAF gate) --------------------------------------
  var realRAF = window.requestAnimationFrame.bind(window);
  var realCAF = window.cancelAnimationFrame.bind(window);
  var queued = []; var nextId = 1e9;
  window.requestAnimationFrame = function (cb) {
    if (!document.hidden) return realRAF(cb);
    var id = nextId++;
    queued.push({ id: id, cb: cb });
    return id;
  };
  window.cancelAnimationFrame = function (id) {
    if (id >= 1e9) { queued = queued.filter(function (q) { return q.id !== id; }); return; }
    realCAF(id);
  };
  document.addEventListener('visibilitychange', function () {
    GG.paused = document.hidden;
    if (document.hidden) return;
    var pending = queued; queued = [];
    pending.forEach(function (q) { realRAF(q.cb); });
    try { document.dispatchEvent(new CustomEvent('gg:resume')); } catch (e) {}
  });

  // ---- 2. Audio unlock ----------------------------------------------------
  var contexts = [];
  ['AudioContext', 'webkitAudioContext'].forEach(function (name) {
    var Orig = window[name];
    if (typeof Orig !== 'function') return;
    function Patched() {
      var ctx = new (Function.prototype.bind.apply(Orig, [null].concat([].slice.call(arguments))))();
      contexts.push(ctx);
      return ctx;
    }
    Patched.prototype = Orig.prototype;
    window[name] = Patched;
  });
  function unlock() {
    contexts.forEach(function (c) { if (c.state === 'suspended' && c.resume) c.resume().catch(function () {}); });
  }
  ['pointerdown', 'touchend', 'keydown'].forEach(function (t) { document.addEventListener(t, unlock, { passive: true }); });

  // ---- 3. Gesture lock ----------------------------------------------------
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', function (e) { if (e.target && e.target.tagName === 'CANVAS') e.preventDefault(); }, { passive: false });
  document.addEventListener('touchmove', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'CANVAS' || t === document.body || t === document.documentElement)) e.preventDefault();
  }, { passive: false });

  // ---- 4. Virtual keypad --------------------------------------------------
  function keyEvent(type, key, code, keyCode) {
    var ev = new KeyboardEvent(type, { key: key, code: code, keyCode: keyCode, which: keyCode, bubbles: true, cancelable: true });
    try { Object.defineProperty(ev, 'keyCode', { get: function () { return keyCode; } }); Object.defineProperty(ev, 'which', { get: function () { return keyCode; } }); } catch (e) {}
    document.dispatchEvent(ev);
  }
  var KEYS = {
    up: ['ArrowUp', 'ArrowUp', 38], down: ['ArrowDown', 'ArrowDown', 40], left: ['ArrowLeft', 'ArrowLeft', 37], right: ['ArrowRight', 'ArrowRight', 39],
    space: [' ', 'Space', 32], enter: ['Enter', 'Enter', 13], w: ['w', 'KeyW', 87], a: ['a', 'KeyA', 65], s: ['s', 'KeyS', 83], d: ['d', 'KeyD', 68], esc: ['Escape', 'Escape', 27]
  };
  function mountKeypad(spec) {
    if (!coarse || document.getElementById('gg-keypad')) return;
    var wants = spec.split(/[\s,]+/).filter(Boolean);
    var root = document.createElement('div'); root.id = 'gg-keypad'; root.setAttribute('aria-label', 'Game controls');
    var html = '';
    if (wants.indexOf('arrows') !== -1 || wants.indexOf('wasd') !== -1) {
      var p = wants.indexOf('wasd') !== -1 && wants.indexOf('arrows') === -1 ? { up: 'w', left: 'a', down: 's', right: 'd' } : { up: 'up', left: 'left', down: 'down', right: 'right' };
      html += '<div class="gg-dpad"><button data-k="' + p.up + '" class="u" aria-label="Up">&#9650;</button><button data-k="' + p.left + '" class="l" aria-label="Left">&#9664;</button><button data-k="' + p.right + '" class="r" aria-label="Right">&#9654;</button><button data-k="' + p.down + '" class="d" aria-label="Down">&#9660;</button></div>';
    }
    var acts = wants.filter(function (w) { return w !== 'arrows' && w !== 'wasd'; });
    if (acts.length) html += '<div class="gg-actions">' + acts.map(function (k) { return '<button data-k="' + k + '" aria-label="' + k + '">' + (k === 'space' ? 'A' : k === 'enter' ? 'B' : k.toUpperCase()) + '</button>'; }).join('') + '</div>';
    root.innerHTML = html;
    document.body.appendChild(root);
    var held = {};
    function press(k, down) {
      var def = KEYS[k]; if (!def) return;
      if (down && held[k]) return;
      held[k] = down;
      keyEvent(down ? 'keydown' : 'keyup', def[0], def[1], def[2]);
    }
    root.querySelectorAll('button').forEach(function (b) {
      var k = b.getAttribute('data-k');
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('on'); press(k, true); });
      var up = function () { b.classList.remove('on'); press(k, false); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    });
    GG.keypad = root;
  }
  // ---- 4b. Canvas type (2026-10-05) -------------------------------------
  // 1,079 ctx.font assignments across the fleet name 'Courier New' or bare
  // monospace. JetBrains Mono (self-hosted, same 0.6em advance) is swapped in
  // under those stacks at assignment time, so every game's canvas text
  // sharpens without touching a game. Courier New stays as the fallback
  // until the woff2 has loaded; the games redraw every frame anyway.
  (function () {
    var proto = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
    if (!proto) return;
    var d = Object.getOwnPropertyDescriptor(proto, 'font');
    if (!d || !d.set || !d.get) return;
    var FAM = "'JetBrains Mono', 'Courier New', monospace";
    var re = /^(.*?\d(?:\.\d+)?(?:px|pt|em|rem|%)(?:\s*\/\s*[\d.]+(?:px|em|%)?)?\s+)(.+)$/;
    Object.defineProperty(proto, 'font', {
      configurable: true, enumerable: d.enumerable,
      get: function () { return d.get.call(this); },
      set: function (v) {
        var s = String(v), m = re.exec(s);
        if (m && /courier|monospace/i.test(m[2]) && !/jetbrains|press start/i.test(m[2])) s = m[1] + FAM;
        d.set.call(this, s);
      }
    });
    try { if (document.fonts) { document.fonts.load("12px 'JetBrains Mono'"); document.fonts.load("bold 12px 'JetBrains Mono'"); } } catch (e) {}
  })();

  // ---- 4c. Touch copy (2026-10-05) -------------------------------------------
  // 35 games tell the player to "Press ENTER", use "Arrow Keys / WASD" or
  // "Click to Start" in canvas text and overlays. On a coarse pointer those
  // phrases are rewritten at draw time to their touch equivalents. Only
  // phrases with a known-true touch counterpart are touched: an "or Tap"
  // alternative already in the string, click->tap, and the direction keys
  // (every pad-driven game maps its pad to those keys).
  var COPY = [
    [/Press (?:ENTER|Enter|SPACE|Space|Any Key|any key|START|Start)(?:\s*\/\s*\w+)?,? or Tap to (\w+)/g, 'Tap to $1'],
    [/Press (?:ENTER|Enter|SPACE|Space|ESC|Esc|P)(?:\s*\/\s*\w+)? or Tap to (\w+)/g, 'Tap to $1'],
    [/Press Any Key \/ Tap to (\w+)/g, 'Tap to $1'],
    [/Click to Start/g, 'Tap to Start'], [/Click or Tap/gi, 'Tap'], [/Click a card/g, 'Tap a card'], [/Click anywhere/gi, 'Tap anywhere'],
    [/Arrow Keys \/ WASD/g, 'D-pad'], [/ARROW KEYS \/ WASD/g, 'D-PAD'], [/ARROWS\s*\/\s*WASD/g, 'D-PAD'], [/WASD\s*\/\s*Arrows/gi, 'D-pad'], [/WASD\/ARROWS/g, 'D-PAD'],
    [/\[Arrow Keys\]/g, '[D-pad]'], [/Arrow Keys/g, 'D-pad'], [/ARROW KEYS/g, 'D-PAD'],
    // title / game-over prompts: the touchstart handlers take the same path as Enter
    [/PRESS (?:ENTER|SPACE) TO (PLAY AGAIN|RESTART|START|PLAY|CONTINUE|SKIP)/g, 'TAP TO $1'],
    [/[Pp]ress (?:Enter|ENTER|Space|SPACE) to (\w[\w ]*?)(?=[.!]|$)/g, 'Tap to $1'],
  ];
  function fixCopy(t) {
    if (typeof t !== 'string' || t.length < 6) return t;
    var hit = fixCopy.cache.get(t);
    if (hit !== undefined) return hit;
    var out = t;
    for (var i = 0; i < COPY.length; i++) out = out.replace(COPY[i][0], COPY[i][1]);
    if (fixCopy.pad) out = fixCopy.pad(out);
    if (fixCopy.cache.size > 2000) fixCopy.cache.clear();
    fixCopy.cache.set(t, out);
    return out;
  }
  fixCopy.cache = new Map();
  if (coarse && window.CanvasRenderingContext2D) {
    ['fillText', 'strokeText', 'measureText'].forEach(function (name) {
      var orig = CanvasRenderingContext2D.prototype[name];
      if (!orig) return;
      CanvasRenderingContext2D.prototype[name] = function (t) { arguments[0] = fixCopy(t); return orig.apply(this, arguments); };
    });
    var fixDom = function () {
      var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      var n; while ((n = w.nextNode())) {
        var pn = n.parentNode && n.parentNode.nodeName;
        if (pn === 'SCRIPT' || pn === 'STYLE' || pn === 'TEXTAREA') continue;
        if (n.nodeValue && n.nodeValue.length > 5 && /Press |Arrow|WASD|Click |\[[A-Za-z]\]|\b[A-Z]: |\bSpace\b|\bSPACE\b/.test(n.nodeValue)) { var v = fixCopy(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
      }
    };
    // tutorials and tips are injected while playing, so keep watching (debounced)
    var fixTimer = null;
    var scheduleFix = function () { if (fixTimer) return; fixTimer = setTimeout(function () { fixTimer = null; try { fixDom(); } catch (e) {} }, 250); };
    document.addEventListener('DOMContentLoaded', function () {
      fixDom(); setTimeout(fixDom, 1500);
      try { new MutationObserver(scheduleFix).observe(document.body, { childList: true, subtree: true, characterData: true }); } catch (e) {}
    });
  }

  // ---- 4d. Key badges -> pad labels (2026-10-05) -----------------------------
  // Tutorials in the flagship games show keycaps (Z, X, Space, W A S D). The
  // shared .mctl pad maps those keys to labelled buttons via setupBtn('mctl_a',
  // 'z') calls in the page's own script, so on a coarse pointer the keycap
  // text is replaced by the pad's label for that key.
  if (coarse) {
    var padMap = null;
    function buildPadMap() {
      var map = {}, dedicated = {};
      var src = [].map.call(document.scripts, function (s) { return s.src ? '' : s.textContent; }).join('\n');
      var re = /setupBtn\(\s*['"](mctl_\w+)['"]\s*,\s*['"]([^'"]*)['"]/g, m;
      while ((m = re.exec(src))) {
        var el = document.getElementById(m[1]);
        var label = el && el.textContent.trim();
        if (!label) continue;
        var keys = m[2].split(',').map(function (k) { k = k.trim().toLowerCase(); return k === 'space' ? ' ' : k; }).filter(Boolean);
        keys.forEach(function (k) {
          // keys arrive as a comma list ('z, , ' = z + space; 'x,Shift'); a
          // button that fires only this key owns its label over one that
          // fires it as a side effect (bullet_hell: Shift = FOCUS, not BOMB)
          if (!map[k] || (keys.length === 1 && !dedicated[k])) map[k] = label.toUpperCase();
          if (keys.length === 1) dedicated[k] = true;
        });
      }
      if (document.querySelector('.mctl-dpad')) ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', '←', '→', '↑', '↓', '← →', 'a d', 'w a s d', 'wasd'].forEach(function (k) { if (!map[k]) map[k] = 'D-PAD'; });
      // legend text: "[Z] Attack", "Z: Attack", "LMB / Space — Shoot" -> pad labels
      var keyed = Object.keys(map).filter(function (k) { return k.length === 1 && k !== ' ' || k === 'shift'; });
      if (keyed.length) {
        var alts = keyed.map(function (k) { return k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'); }).join('|');
        var reBr = new RegExp('\\[(' + alts + ')\\]', 'gi'), reCol = new RegExp('(^|[|\\s])(' + alts + '):(?=\\s)', 'gi');
        var reSp = map[' '] ? /\b(?:Space|SPACE)\b/g : null;
        fixCopy.pad = function (t) {
          if (reSp) t = t.replace(reSp, map[' ']); // first, so an inserted label is never re-matched
          return t.replace(reBr, function (_, k) { return '[' + map[k.toLowerCase()] + ']'; }).replace(reCol, function (_, pre, k) { return pre + map[k.toLowerCase()] + ':'; });
        };
        fixCopy.cache.clear();
      }
      return map;
    }
    var fixBadges = function () {
      if (!padMap) padMap = buildPadMap();
      if (!Object.keys(padMap).length) return;
      document.querySelectorAll('kbd, .tut-key, .tutKey, .key, .keycap, .tut-keys span, .controls span').forEach(function (el) {
        if (el.children.length || el.getAttribute('data-gg-badged')) return;
        var t = el.textContent.trim(), k = t.toLowerCase();
        if (k === 'space' || k === 'spc') k = ' ';
        if (k === 'enter' || k === 'esc' || k === 'escape') return;
        var label = padMap[k];
        if (!label && k.indexOf('/') > -1) {
          var parts = [];
          k.split('/').forEach(function (part) { part = part.trim(); if (part === 'space' || part === 'spc') part = ' '; var l = padMap[part]; if (l && parts.indexOf(l) < 0) parts.push(l); });
          if (parts.length) label = parts.join(' / ');
        }
        if (label && label !== t) {
          el.setAttribute('data-gg-badged', t); el.textContent = label;
          // "W A S D" / "← →" rows collapse to one D-PAD badge
          var prev = el.previousElementSibling;
          if (prev && prev.getAttribute('data-gg-badged') && prev.textContent === label) el.style.display = 'none';
          // keyboard-only leftovers in a row that now names a pad control
          // ("Space" beside D-PAD, "or D-pad" after a D-PAD badge) say nothing on a phone
          [].forEach.call(el.parentNode ? el.parentNode.children : [], function (sib) {
            if (sib === el || sib.getAttribute('data-gg-badged')) return;
            var st = sib.textContent.trim().toLowerCase();
            if (/^(or d-pad|or arrow keys|or arrows|space|spc|shift|ctrl|alt|tab|[a-z]|[\u2190-\u2193]( [\u2190-\u2193])*)$/.test(st) && !padMap[st === 'space' || st === 'spc' ? ' ' : st]) sib.style.display = 'none';
          });
        }
      });
    };
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(fixBadges, 300); setTimeout(fixBadges, 1800);
      try { new MutationObserver(function () { setTimeout(fixBadges, 300); }).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    });
  }

  // ---- 5. Fit: fixed-size canvas games -------------------------------------
  // <html data-gg-fit="#selector [WxH]"> scales that element (a canvas, or a
  // wrapper holding several) to fit the viewport with a CSS transform, and
  // shrinks its layout box with negative margins so flex-centred bodies stay
  // centred and nothing overflows. Transforms keep input correct for both
  // coordinate styles the games use: offsetX/offsetY is reported in the
  // element's own (unscaled) space, and getBoundingClientRect() reports the
  // scaled rect that rect-mapping code divides by.
  function mountFit(spec) {
    var parts = spec.trim().split(/\s+/);
    var el = document.querySelector(parts[0]); if (!el) return;
    var fixed = /^(\d+)x(\d+)$/.exec(parts[1] || '');
    // A transformed element becomes the containing block for position:fixed
    // descendants, so full-screen overlays nested in the fitted wrapper shrink
    // with it (bullet_hell's #charSelect: SELECT button off-screen in
    // landscape). Hoist the outermost fixed descendants to <body> once.
    try {
      [].slice.call(el.querySelectorAll('*')).forEach(function (n) {
        if (getComputedStyle(n).position !== 'fixed') return;
        for (var a = n.parentNode; a && a !== el; a = a.parentNode) if (getComputedStyle(a).position === 'fixed') return;
        document.body.appendChild(n);
      });
    } catch (e) {}
    function apply() {
      el.style.transform = ''; el.style.marginRight = ''; el.style.marginBottom = '';
      var lw = el.offsetWidth, lh = el.offsetHeight;          // layout box
      var w = fixed ? +fixed[1] : lw, h = fixed ? +fixed[2] : lh; // visual extent to fit (may exceed the box: hung-off sidebars)
      if (!w || !h) return;
      // Chrome on Android widens the layout viewport to overflowing content
      // before any script runs, so innerWidth can already be the canvas width;
      // bound it by the visual viewport and the device's longer screen edge.
      // (iOS keeps screen.width at the portrait value in landscape, so the
      // shorter edge would shrink a landscape game to ~60%.)
      var edge = Math.max((screen && screen.width) || 0, (screen && screen.height) || 0) || Infinity;
      var vv = window.visualViewport;
      var vw = Math.min(window.innerWidth, (vv && vv.width) || Infinity, edge);
      var vh = Math.min(window.innerHeight, (vv && vv.height) || Infinity, edge);
      var s = Math.min(vw / w, vh / h, 1);
      GG.fit = { el: el, scale: s, w: w, h: h, vw: vw, vh: vh };
      if (s > 0.999) return;
      el.style.transformOrigin = '0 0';
      el.style.transform = 'scale(' + s + ')';
      el.style.marginRight = (w * s - lw) + 'px';   // margin box = visual width
      el.style.marginBottom = (h * s - lh) + 'px';
    }
    apply();
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', function () { setTimeout(apply, 60); });
    // games that size their canvas after load
    setTimeout(apply, 250); setTimeout(apply, 1200);
  }
  // ---- 11. Landscape gate (2026-10-05) --------------------------------------
  // <html data-gg-landscape>: the game is built wide (canvas aspect >= 1.3) and
  // renders at a third of a portrait phone. On a coarse pointer in portrait,
  // ask for a sideways phone; "play small anyway" is one tap and remembered
  // for the session. Nothing is shown on desktops or in landscape.
  function mountRotateGate() {
    if (!coarse) return;
    var gate = document.createElement('div');
    gate.id = 'gg-rotate';
    gate.innerHTML = '<div class="gg-rotate-phone" aria-hidden="true"></div><strong>TURN YOUR PHONE SIDEWAYS</strong>' +
      '<p>This one is built wide. In portrait it plays at a third of the screen.</p>' +
      '<button type="button" class="gg-rotate-skip">PLAY SMALL ANYWAY</button>';
    document.body.appendChild(gate);
    var skipped = false;
    try { skipped = sessionStorage.getItem('gg-rotate-skip:' + location.pathname) === '1'; } catch (e) {}
    function update() {
      var portrait = window.innerHeight > window.innerWidth;
      gate.classList.toggle('on', portrait && !skipped);
    }
    gate.querySelector('.gg-rotate-skip').addEventListener('click', function () {
      skipped = true; try { sessionStorage.setItem('gg-rotate-skip:' + location.pathname, '1'); } catch (e) {}
      update();
    });
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', function () { setTimeout(update, 80); });
    update();
  }
  // ---- 12. Taps become clicks; holds stay in the game (2026-10-05) ---------
  // iOS Safari (and Chrome) withhold the synthesized click when a page calls
  // preventDefault() on touchstart/touchend. 23 games do exactly that on
  // their canvas to stop scrolling and zooming, then run their menus from
  // 'click' handlers (upgrade cards, START, difficulty) - so on a phone those
  // taps did nothing (EndBird: title -> upgrade screen, then stuck). When a
  // short, still touch ends with its default prevented, dispatch the click
  // the browser withheld. One synthetic click per touch, never for native
  // controls, which get their own clicks.
  function tapToClick() {
    var start = null;
    document.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { start = null; return; }
      var t = e.touches[0];
      start = { x: t.clientX, y: t.clientY, at: performance.now(), target: e.target };
    }, { capture: true, passive: true });
    document.addEventListener('touchend', function (e) {
      var s = start; start = null;
      if (!s || !e.defaultPrevented || e.touches.length) return;
      var t = e.changedTouches && e.changedTouches[0]; if (!t) return;
      if (performance.now() - s.at > 450 || Math.hypot(t.clientX - s.x, t.clientY - s.y) > 12) return;
      var el = e.target && e.target.nodeType === 1 ? e.target : document.elementFromPoint(t.clientX, t.clientY);
      if (!el || (el.closest && el.closest('button, a, input, select, textarea, label, [role=button], .mctl-overlay, #gg-pad, #gg-rotate'))) return;
      var ev = new MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX: t.clientX, clientY: t.clientY, screenX: t.screenX, screenY: t.screenY, button: 0 });
      ev.ggSynthetic = true;
      el.dispatchEvent(ev);
    }, { capture: false, passive: true });
    // A held finger is play, not a request for a context menu.
    document.addEventListener('contextmenu', function (e) {
      if (e.target && e.target.closest && e.target.closest('input, textarea, a[href^="http"]')) return;
      e.preventDefault();
    });
  }
  function boot() {
    if (native) {
      document.documentElement.classList.add('gg-native');
      // Storefront copy written for the web ("no installs") reads wrong inside
      // the installed app; the bundle is local, so "play offline" is true.
      document.querySelectorAll('p, h2, div, span').forEach(function (el) {
        if (el.children.length === 0 && /^Free Browser Games/.test(el.textContent.trim())) el.textContent = 'Free games. Play offline.';
      });
      document.querySelectorAll('.header-stat').forEach(function (st) { if (/installs needed/i.test(st.textContent)) st.style.display = 'none'; });
    }
    var spec = document.documentElement.getAttribute('data-gg-keypad');
    if (spec) mountKeypad(spec);
    var fit = document.documentElement.getAttribute('data-gg-fit');
    if (fit) mountFit(fit);
    if (document.documentElement.hasAttribute('data-gg-landscape')) mountRotateGate();
    if (coarse && document.documentElement.hasAttribute('data-gg-game')) tapToClick();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
