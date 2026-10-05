/* gg-mobile.js — GameGob shared mobile runtime (2026-10-04).
 * Loaded synchronously in <head> by every game page. Does four things no
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
 * It also exposes window.GG with the native-shell flag the ad loader uses.
 */
(function () {
  'use strict';
  if (window.GG) return;
  var native = !!(window.Capacitor || navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
  var coarse = !!(window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches);
  var GG = window.GG = { version: '20261004', native: native, coarse: coarse, paused: false, keypad: null };

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
  function boot() {
    var spec = document.documentElement.getAttribute('data-gg-keypad');
    if (spec) mountKeypad(spec);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
