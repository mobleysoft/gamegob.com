// Shared host-owned input. move: x right/y forward in the unit disk;
// look: dx/dy pixels consumed once; buttons: semantic booleans.
// Worlds call state() each frame, or receive weyland:input-state via same-origin postMessage.
(function () {
  'use strict';
  if (window.WeylandInput) return;
  const KEYMAP = Object.freeze({
    KeyW: 'forward', ArrowUp: 'forward', KeyS: 'backward', ArrowDown: 'backward',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    Space: 'up', ControlLeft: 'down', ControlRight: 'down', KeyC: 'down',
    ShiftLeft: 'sprint', ShiftRight: 'sprint', KeyX: 'brake', KeyF: 'scan',
    KeyQ: 'rollLeft', KeyE: 'rollRight'
  });
  const fields = t => !!(t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable));
  const coarse = () => matchMedia('(hover: none) and (pointer: coarse)').matches;
  const neutral = () => ({ move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 }, buttons: {} });
  const finite = v => Number.isFinite(v) ? v : 0;
  function normalize(value) {
    const s = neutral();
    s.move.x = Math.max(-1, Math.min(1, finite(value?.move?.x)));
    s.move.y = Math.max(-1, Math.min(1, finite(value?.move?.y)));
    const len = Math.hypot(s.move.x, s.move.y);
    if (len > 1) { s.move.x /= len; s.move.y /= len; }
    s.look.dx = finite(value?.look?.dx); s.look.dy = finite(value?.look?.dy);
    for (const b of ['up', 'down', 'sprint', 'brake', 'scan', 'rollLeft', 'rollRight']) s.buttons[b] = value?.buttons?.[b] === true;
    return s;
  }
  function create(opts = {}) {
    let enabled = true, destroyed = false, raf = 0, held = new Set(), drag = null;
    let stickEl = null, knob = null, stickId = null, origin = null;
    const stick = { x: 0, y: 0 }, look = { dx: 0, dy: 0 }, listeners = [];
    const size = opts.stickSize || 140, inset = opts.stickInset ?? 18, radius = (size - 36) / 2, target = opts.lookTarget;
    let lastPoll = performance.now(), wasActive = false;
    const active = () => enabled && !document.hidden && !fields(document.activeElement) && (!opts.active || opts.active());
    const on = (el, type, fn, options) => { el.addEventListener(type, fn, options); listeners.push(() => el.removeEventListener(type, fn, options)); };
    function reset() {
      held.clear(); drag = null; stickId = null; stick.x = stick.y = 0;
      look.dx = look.dy = 0; lastPoll = performance.now();
      if (knob) knob.style.transform = '';
    }
    function clear() { reset(); send(true); }
    function action(code) {
      const bindings = opts.bindings ? opts.bindings() : {};
      const custom = Object.keys(bindings).find(k => bindings[k] === code);
      const mapped = KEYMAP[code];
      return custom || (bindings[mapped] && bindings[mapped] !== code && !/^(Arrow|ShiftRight)/.test(code) ? null : mapped);
    }
    function key(code, down) {
      if (!down) held.delete(code);
      else if (active() && action(code)) held.add(code);
      send();
    }
    on(window, 'keydown', e => {
      if (!active() || fields(e.target) || !action(e.code)) return;
      if (e.cancelable) e.preventDefault(); key(e.code, true);
    }, true);
    on(window, 'keyup', e => { if (held.has(e.code) && e.cancelable) e.preventDefault(); key(e.code, false); }, true);
    on(window, 'blur', clear);
    on(document, 'visibilitychange', clear);
    on(document, 'focusin', e => { if (fields(e.target)) clear(); });
    on(window, 'orientationchange', clear);
    on(window, 'resize', clear);
    if (target) {
      on(target, 'pointerdown', e => {
        if (!active() || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY, distance: 0 };
        try { target.setPointerCapture(e.pointerId); } catch (_) {}
        if (opts.pointerLock && e.pointerType === 'mouse' && !document.pointerLockElement) {
          try { const p = target.requestPointerLock(); if (p?.catch) p.catch(() => {}); } catch (_) {}
        }
        if (e.cancelable) e.preventDefault();
      });
      on(window, 'pointermove', e => {
        if (!active()) return;
        if (document.pointerLockElement === target && e.pointerType === 'mouse') {
          look.dx += e.movementX || 0; look.dy += e.movementY || 0;
        } else if (drag && drag.id === e.pointerId) {
          drag.distance += Math.hypot(e.clientX - drag.x, e.clientY - drag.y);
          look.dx += e.clientX - drag.x; look.dy += e.clientY - drag.y;
          drag.x = e.clientX; drag.y = e.clientY;
        }
      });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) on(target, type, e => { if (drag?.id === e.pointerId) { if (type === 'pointerup' && drag.distance < 6 && active() && opts.onTap) opts.onTap(e.clientX, e.clientY); drag = null; } });
      on(document, 'pointerlockchange', () => { if (document.pointerLockElement !== target) clear(); });
    }
    function moveStick(e) {
      let dx = e.clientX - origin.x, dy = e.clientY - origin.y;
      const len = Math.hypot(dx, dy);
      if (len > radius) { dx *= radius / len; dy *= radius / len; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      stick.x = len < radius * .12 ? 0 : dx / radius;
      stick.y = len < radius * .12 ? 0 : -dy / radius;
    }
    function drawStick(show) {
      if (show && !stickEl) {
        stickEl = document.createElement('div'); stickEl.className = 'weyland-stick';
        stickEl.setAttribute('role', 'group'); stickEl.setAttribute('aria-label', 'Drag stick to move; drag the view to look');
        stickEl.style.cssText = `position:${opts.stickParent ? 'absolute' : 'fixed'};${opts.stickSide === 'right' ? 'right' : 'left'}:max(${inset}px,env(safe-area-inset-${opts.stickSide === 'right' ? 'right' : 'left'}));bottom:max(22px,env(safe-area-inset-bottom));box-sizing:border-box;width:${size}px;height:${size}px;border-radius:50%;background:rgba(10,12,16,.28);border:2px solid rgba(255,255,255,.35);z-index:700;touch-action:none;pointer-events:auto;user-select:none;`;
        knob = document.createElement('div');
        knob.style.cssText = 'position:absolute;left:50%;top:50%;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:rgba(255,255,255,.75);box-shadow:0 2px 10px rgba(0,0,0,.4);pointer-events:none;';
        stickEl.appendChild(knob);
        on(stickEl, 'pointerdown', e => {
          if (!active() || stickId !== null) return;
          e.preventDefault(); e.stopPropagation(); stickId = e.pointerId;
          const r = stickEl.getBoundingClientRect(); origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          try { stickEl.setPointerCapture(e.pointerId); } catch (_) {}
          moveStick(e);
        });
        on(stickEl, 'pointermove', e => { if (e.pointerId === stickId) { e.preventDefault(); moveStick(e); } });
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) on(stickEl, type, e => {
          if (e.pointerId !== stickId) return;
          stickId = null; stick.x = stick.y = 0; knob.style.transform = ''; send();
        });
        (opts.stickParent || document.body).appendChild(stickEl);
      }
      if (stickEl) stickEl.style.display = show ? 'block' : 'none';
      if (!show) { stickId = null; stick.x = stick.y = 0; if (knob) knob.style.transform = ''; }
    }
    function state() {
      const now = performance.now(), dt = Math.min(.05, Math.max(0, (now - lastPoll) / 1000)); lastPoll = now;
      if (!active()) { reset(); return normalize(neutral()); }
      const pressed = {};
      for (const code of held) { const a = action(code); if (a) pressed[a] = true; }
      const s = { move: { x: stick.x + (+!!pressed.right) - (+!!pressed.left), y: stick.y + (+!!pressed.forward) - (+!!pressed.backward) }, look: { ...look }, buttons: pressed };
      look.dx = look.dy = 0;
      const dz = v => Math.abs(v || 0) < .15 ? 0 : v;
      for (const pad of (navigator.getGamepads ? navigator.getGamepads() : [])) {
        if (!pad?.connected) continue;
        s.move.x += dz(pad.axes[0]); s.move.y -= dz(pad.axes[1]);
        s.look.dx += dz(pad.axes[2]) * 840 * dt; s.look.dy += dz(pad.axes[3]) * 840 * dt;
        for (const [n, b] of [[0, 'up'], [1, 'down'], [10, 'sprint'], [2, 'brake']]) if (pad.buttons[n]?.pressed) s.buttons[b] = true;
      }
      return normalize(s);
    }
    function send(forceNeutral = false) {
      if (!opts.forward) return;
      const w = opts.forward(); if (!w) return;
      const s = forceNeutral ? normalize(neutral()) : state();
      w.postMessage({ type: 'weyland:input-state', ...s }, location.origin);
    }
    function tick() {
      if (destroyed) return;
      const live = active();
      if (wasActive && !live) clear();
      wasActive = live;
      drawStick(live && (opts.stick === true || (opts.stick !== false && coarse())));
      send(); raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return Object.freeze({ state, clear, key,
      setEnabled(on) { enabled = !!on; if (!enabled) { clear(); drawStick(false); } },
      get stickVisible() { return !!stickEl && stickEl.style.display !== 'none'; },
      destroy() { clear(); destroyed = true; cancelAnimationFrame(raf); for (const off of listeners) off(); if (stickEl) stickEl.remove(); }
    });
  }
  window.WeylandInput = Object.freeze({ create, normalize, neutral, KEYMAP });
}());
