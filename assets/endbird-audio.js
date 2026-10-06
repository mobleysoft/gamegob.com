/* EndBird synthesized sound palette (2026-10-06).
 * Angle: feel and juice (bass thump + pitched tail on eat, crunchy explode with a low-pass
 * sweep, brass tier-up fanfare, Vampire Survivors style pickup cascade).
 * Pure WebAudio: oscillators, noise buffers, biquad filters, gain envelopes. No audio files,
 * no CDN, no dependency. Every event takes an explicit start time t, so the same code renders
 * in an OfflineAudioContext for measurement and runs live with t = ctx.currentTime. */
(function (root) {
'use strict';

const PENT = [0, 2, 4, 7, 9, 12, 14, 16];          // major pentatonic, 1.5 octaves (combo ladder)
const PENT5 = [0, 2, 4, 7, 9];
const keyPc = tier => (2 + 7 * tier) % 12;            // circle of fifths: D A E B F# C# G# D# A# F
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const rootIn = (tier, lo) => { let f = hz(60 + keyPc(tier)); while (f < lo) f *= 2; while (f >= lo * 2) f /= 2; return f; };
const st = (f, s) => f * Math.pow(2, s / 12);
const ct = t => Math.max(0, Math.min(9, t | 0));

// Per-tier ambience. r = tier key root folded into [98,196) Hz; voices are multiples of r.
const AMB = [
  { name: 'Quantum', level: 0.12, lp: 2600, q: 0.7, lpLfo: [0.3, 400], vib: [5.5, 8], trem: [9, 0.3],
    voices: [{ w: 'triangle', m: 2, g: 0.4 }, { w: 'sine', m: 4, g: 0.5 }, { w: 'sine', m: 6, g: 0.3 }],
    noise: { f: 'highpass', hz: 5000, q: 0.7, g: 0.04 },
    pings: { kind: 'blip', rate: 3, lo: 1046, g: 0.4, dec: 0.025, echo: 0.5 }, echo: [0.12, 0.25] },
  { name: 'Atomic', level: 0.084, lp: 1800, q: 1, lpLfo: [0.25, 500],
    voices: [{ w: 'triangle', m: 2, g: 0.4 }, { w: 'sine', m: 2, g: 0.3, d: 7 }, { w: 'sine', m: 3, g: 0.4 }, { w: 'sine', m: 4, g: 0.2 }, { w: 'sine', m: 5, g: 0.15 }],
    pings: { kind: 'blip', rate: 1.2, lo: 880, g: 0.35, dec: 0.06, echo: 0.4 }, echo: [0.16, 0.3] },
  { name: 'Micro', level: 0.093, lp: 1400, q: 0.7, lpLfo: [0.18, 300],
    voices: [{ w: 'sine', m: 2, g: 0.5 }, { w: 'triangle', m: 3, g: 0.25 }],
    noise: { f: 'lowpass', hz: 900, q: 0.7, g: 0.12, am: [0.6, 0.5] },
    pings: { kind: 'bubble', rate: 1.5, lo: 400, g: 0.35, dec: 0.05, echo: 0.3 }, echo: [0.2, 0.3] },
  { name: 'Insect', level: 0.186, lp: 1600, q: 0.7, lpLfo: [0.2, 300],
    voices: [{ w: 'sawtooth', m: 2, g: 0.18 }, { w: 'triangle', m: 3, g: 0.3 }],
    buzz: { m: 4, hz: 1200, q: 3, g: 0.06, am: [23, 0.6] },
    pings: { kind: 'chitter', rate: 2, lo: 1500, g: 0.15, dec: 0.015, echo: 0.2 }, echo: [0.2, 0.25] },
  { name: 'Animal', level: 0.094, lp: 1200, q: 0.7, lpLfo: [0.12, 400], vib: [0.12, 4],
    voices: [{ w: 'triangle', m: 1, g: 0.25 }, { w: 'triangle', m: 1.5, g: 0.35 }, { w: 'sine', m: 2, g: 0.4 }, { w: 'sine', m: 3, g: 0.15 }],
    pings: { kind: 'chirp', rate: 0.4, lo: 1320, g: 0.2, dec: 0.06, echo: 0.4 }, echo: [0.24, 0.3] },
  { name: 'Mega', level: 0.186, lp: 800, q: 2, lpLfo: [0.1, 200],
    voices: [{ w: 'sawtooth', m: 1, g: 0.3 }, { w: 'sawtooth', m: 1.5, g: 0.22 }, { w: 'triangle', m: 2, g: 0.25 }],
    pings: { kind: 'stomp', period: 1.6, g: 0.6 }, echo: [0.28, 0.3] },
  { name: 'Planetary', level: 0.094, lp: 1300, q: 0.7, lpLfo: [0.07, 300],
    voices: [{ w: 'sine', m: 2, g: 0.3 }, { w: 'sine', m: 3, g: 0.4 }, { w: 'triangle', m: 4, g: 0.25 }],
    noise: { f: 'bandpass', hz: 500, q: 2, g: 0.25, sweep: [0.08, 300] }, echo: [0.32, 0.35] },
  { name: 'Stellar', level: 0.31, lp: 1500, q: 1.5, lpLfo: [0.15, 500], vib: [0.3, 6],
    voices: [{ w: 'sawtooth', m: 2, g: 0.18 }, { w: 'sawtooth', m: 3, g: 0.14, d: 5 }, { w: 'sawtooth', m: 5, g: 0.07, d: -5 }],
    noise: { f: 'highpass', hz: 4000, q: 0.7, g: 0.02 },
    pings: { kind: 'bell', rate: 0.5, lo: 1046, g: 0.3, dec: 0.5, echo: 0.6 }, echo: [0.38, 0.38] },
  { name: 'Galactic', level: 0.25, lp: 900, q: 6, lpLfo: [0.05, 700],
    voices: [{ w: 'sawtooth', m: 2, g: 0.2 }, { w: 'sawtooth', m: 3, g: 0.16 }, { w: 'triangle', m: 4, g: 0.15 }],
    pings: { kind: 'bell', rate: 0.6, lo: 1046, g: 0.3, dec: 0.6, echo: 0.7 }, echo: [0.42, 0.42] },
  { name: 'Cosmic', level: 0.122, lp: 1800, q: 0.7, lpLfo: [0.04, 600], ampLfo: [0.07, 0.11, 0.13, 0.17, 0.05],
    voices: [{ w: 'triangle', m: 1, g: 0.35 }, { w: 'sine', m: 2, g: 0.3 }, { w: 'sine', m: 3, g: 0.22 }, { w: 'sine', m: 4, g: 0.15 }, { w: 'sawtooth', m: 0.5, g: 0.15 }],
    noise: { f: 'highpass', hz: 6000, q: 0.7, g: 0.015 },
    pings: { kind: 'bell', rate: 0.8, lo: 1046, g: 0.3, dec: 0.7, echo: 0.8 }, echo: [0.45, 0.45] },
];

function createEndBirdAudio(ctx, opts) {
  opts = opts || {};
  const SR = ctx.sampleRate;
  const A = {};
  const S = { started: 0, kinds: {}, dropped: {}, stolen: 0, maxVoices: 0, nodes: 0, unlockTimes: [] };

  // ---- output graph: separate buses -> master, with headroom in the voice levels ----
  const master = ctx.createGain(); master.gain.value = opts.master != null ? opts.master : 0.25;
  const dest = opts.destination || ctx.destination;
  master.connect(dest);
  const mkBus = n => { const g = ctx.createGain(); g.connect(master); g._name = n; return g; };
  const pickBus = mkBus('pick'), fxBus = mkBus('fx'), uiBus = mkBus('ui'), ambBus = mkBus('amb');
  const echoIn = ctx.createGain();
  let echoDelay = ctx.createDelay(1), echoLp = ctx.createBiquadFilter(), echoFb = ctx.createGain();
  echoDelay.delayTime.value = 0.12; echoLp.type = 'lowpass'; echoLp.frequency.value = 2200; echoFb.gain.value = 0.25;
  echoIn.connect(echoDelay); echoDelay.connect(echoLp); echoLp.connect(echoFb); echoFb.connect(echoDelay); echoLp.connect(ambBus);

  // ---- noise buffers (built once) ----
  const white = ctx.createBuffer(1, SR, SR);
  { const d = white.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const crush = ctx.createBuffer(1, SR, SR);   // NES-style 15-bit LFSR, sample-and-hold at ~9 kHz, two levels
  { const d = crush.getChannelData(0); let r = 0x4001, v = 0.7; const hold = Math.max(1, Math.round(SR / 9000));
    for (let i = 0; i < d.length; i++) { if (i % hold === 0) { const b = (r ^ (r >> 1)) & 1; r = (r >> 1) | (b << 14); v = (r & 1) ? 0.7 : -0.7; } d[i] = v; } }

  // ---- node helpers ----
  const G = (to, v) => { const g = ctx.createGain(); g.gain.value = v == null ? 1 : v; if (to) g.connect(to); S.nodes++; return g; };
  const F = (type, f, q, to) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; if (to) b.connect(to); S.nodes++; return b; };
  const track = (v, s, stop) => { if (!v) return; v.srcs.push(s); if (stop > v.stopMax) { v.stopMax = stop; v.lastSrc = s; } };
  const O = (type, f, t, stop, to, v) => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.connect(to); o.start(t); o.stop(stop); S.nodes++; track(v, o, stop); return o; };
  const N = (buf, t, stop, to, v) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; if (to) s.connect(to); s.start(t, Math.random() * 0.8); s.stop(stop); S.nodes++; track(v, s, stop); return s; };
  const env = (p, t, peak, atk, dec) => { p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + atk); p.exponentialRampToValueAtTime(0.0001, t + atk + dec); return t + atk + dec; };

  // ---- voice manager: per-event gap + cap, global cap with priority stealing ----
  const PRIO = { death: 6, victory: 6, tierUp: 5, explode: 5, hurt: 4, unlock: 3, ready: 3, beat: 3, sting: 2, grow: 2, bonk: 2, deny: 2, eat: 1, click: 1 };
  const CAP = { death: 1, victory: 1, tierUp: 1, explode: 1, hurt: 1, unlock: 3, ready: 1, beat: 1, sting: 1, grow: 2, bonk: 2, deny: 1, eat: 3, click: 1 };
  const GAP = { death: 1, victory: 1, tierUp: 0.6, explode: 0.25, hurt: 0.3, unlock: 0.2, ready: 0.5, beat: 0.5, sting: 0, grow: 0.08, bonk: 0.07, deny: 0.15, eat: 0.06, click: 0.12 };
  const MAX_VOICES = 14;
  const voices = [], last = {};
  const drop = k => { S.dropped[k] = (S.dropped[k] || 0) + 1; return null; };
  const live = t => {
    // Scheduling a future reward must not forget a cue that is playing now.
    for (let i = voices.length - 1; i >= 0; i--) if (voices[i].end <= ctx.currentTime) voices.splice(i, 1);
    return voices.filter(v => !v.stolen && v.start <= t && v.end > t);
  };
  const steal = (v, t) => {
    if (v.stolen) return; v.stolen = true; S.stolen++;
    v.out.gain.setValueAtTime(1, t); v.out.gain.setTargetAtTime(0, t, 0.006);   // separate steal gain: click-free in every engine
    v.srcs.forEach(s => { try { s.stop(t + 0.05); } catch (e) {} }); v.end = t + 0.05;
  };
  const begin = (kind, t, bus) => {
    if (last[kind] != null && Math.abs(t - last[kind]) < GAP[kind]) return drop(kind);
    let act = live(t);
    const same = act.filter(v => v.kind === kind);
    if (same.length >= CAP[kind]) { steal(same[0], t); act = live(t); }
    if (act.length >= MAX_VOICES) {
      let vic = null;
      for (const v of act) if (!vic || PRIO[v.kind] < PRIO[vic.kind] || (PRIO[v.kind] === PRIO[vic.kind] && v.start < vic.start)) vic = v;
      if (PRIO[vic.kind] > PRIO[kind]) return drop(kind);
      steal(vic, t);
    }
    last[kind] = t;
    const v = { kind, start: t, end: t + 3, out: G(bus), srcs: [], stopMax: 0, lastSrc: null, stolen: false };
    voices.push(v); S.started++; S.kinds[kind] = (S.kinds[kind] || 0) + 1;
    S.maxVoices = Math.max(S.maxVoices, live(t).length);
    return v;
  };
  const finish = (v, end) => {
    v.end = end;
    if (v.lastSrc) v.lastSrc.onended = () => {
      v.srcs.forEach(s => { try { s.disconnect(); } catch (e) {} });
      try { v.out.disconnect(); } catch (e) {}
    };
  };

  // ---- ducking (depth = gain multiplier); overlapping ducks keep the deeper depth and the later release ----
  const ducks = {};
  const duck = (bus, t, depth, hold, rel) => {
    const s = ducks[bus._name] || { depth: 1, until: -1 };
    const active = t < s.until;
    const d = active ? Math.min(depth, s.depth) : depth;
    const until = Math.max(t + hold, active ? s.until : -1);
    bus.gain.cancelScheduledValues(t);
    bus.gain.setTargetAtTime(d, t, 0.012);
    bus.gain.setTargetAtTime(1, until, rel);
    ducks[bus._name] = { depth: d, until };
  };

  // ---- building blocks ----
  // thump: sine pitch-drop plus a triangle an octave up (the part a phone speaker can play)
  const thump = (v, t, f0, f1, sweep, dec, peak, harm) => {
    const g = G(v.out); env(g.gain, t, peak, 0.002, dec);
    const o1 = O('sine', f0, t, t + dec + 0.03, g, v); o1.frequency.exponentialRampToValueAtTime(f1, t + sweep);
    const o2 = O('triangle', f0 * 2, t, t + dec + 0.03, G(g, harm == null ? 0.55 : harm), v); o2.frequency.exponentialRampToValueAtTime(f1 * 2, t + sweep);
    return t + dec + 0.03;
  };
  const tick = (v, t, f, q, peak, dec, type) => { const g = G(v.out); env(g.gain, t, peak, 0.0005, dec); N(white, t, t + dec + 0.01, F(type || 'bandpass', f, q, g), v); return t + dec + 0.01; };
  const tone = (v, t, type, f, peak, atk, dec, lpf) => { const g = G(v.out); env(g.gain, t, peak, atk, dec); O(type, f, t, t + atk + dec + 0.02, lpf ? F('lowpass', lpf, 0.7, g) : g, v); return t + atk + dec + 0.02; };
  // brass: two sawtooths +-7 cents through a swelling low-pass; sustained notes get delayed vibrato
  const brass = (v, f, at, dur, peak, sustain) => {
    const g = G(v.out); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(peak, at + 0.012);
    let end;
    if (sustain) { g.gain.setTargetAtTime(peak * 0.75, at + 0.012, 0.1); g.gain.setTargetAtTime(0, at + dur, 0.12); end = at + dur + 0.7; }
    else { g.gain.exponentialRampToValueAtTime(0.0001, at + 0.012 + dur); end = at + dur + 0.05; }
    const lp = F('lowpass', 600, 1, g); lp.frequency.setValueAtTime(600, at); lp.frequency.exponentialRampToValueAtTime(3500, at + 0.03); lp.frequency.exponentialRampToValueAtTime(1400, at + 0.35);
    let vib = null;
    if (sustain) { vib = G(null, 0); vib.gain.setValueAtTime(0, at); vib.gain.linearRampToValueAtTime(12, at + 0.25); O('sine', 5.5, at, end, vib, v); }
    [-7, 7].forEach(c => { const o = O('sawtooth', f, at, end, lp, v); o.detune.setValueAtTime(c, at); if (vib) vib.connect(o.detune); });
    return end;
  };

  // ---- ambience ----
  let amb = null, heat = 0, heatT = 0, schedUntil = 0;
  const ambienceBeds = new Set(), ambiencePings = new Set();
  const buildAmb = (tier, mode, t) => {
    const P = AMB[tier], r = rootIn(tier, 98), menu = mode === 'menu';
    const a = { tier, mode, P, r, level: P.level * (menu ? 0.5 : 1), lpBase: P.lp * (menu ? 0.6 : 1), srcs: [] };
    ambienceBeds.add(a);
    a.g = G(ambBus, 0); a.g.gain.setValueAtTime(0, t); a.g.gain.setTargetAtTime(a.level, t + 0.05, 0.5);
    a.lp = F('lowpass', a.lpBase, P.q, a.g); a.lp.frequency.setValueAtTime(a.lpBase, t);
    const mix = G(a.lp, 1);
    const persist = (type, f, to) => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.connect(to); o.start(t); a.srcs.push(o); S.nodes++; return o; };
    const lfo = (rate, depth, param) => { const g = G(null, depth); persist('sine', rate, g); g.connect(param); };
    if (P.lpLfo) lfo(P.lpLfo[0], P.lpLfo[1] * (menu ? 0.6 : 1), a.lp.frequency);
    let vib = null; if (P.vib) { vib = G(null, P.vib[1]); persist('sine', P.vib[0], vib); }
    if (P.trem) { mix.gain.value = 1 - P.trem[1]; lfo(P.trem[0], P.trem[1], mix.gain); }
    P.voices.forEach((vc, i) => {
      const vg = G(mix, vc.g);
      if (P.ampLfo) { vg.gain.value = vc.g * 0.7; lfo(P.ampLfo[i % P.ampLfo.length], vc.g * 0.3, vg.gain); }
      const o = persist(vc.w, r * vc.m, vg); if (vc.d) o.detune.setValueAtTime(vc.d, t); if (vib) vib.connect(o.detune);
    });
    if (P.noise) {
      const n = P.noise, ng = G(a.g, n.g);
      if (n.am) { ng.gain.value = n.g * (1 - n.am[1] / 2); lfo(n.am[0], n.g * n.am[1] / 2, ng.gain); }
      const nf = F(n.f, n.hz, n.q, ng); if (n.sweep) lfo(n.sweep[0], n.sweep[1], nf.frequency);
      const s = ctx.createBufferSource(); s.buffer = white; s.loop = true; s.connect(nf); s.start(t, Math.random() * 0.8); a.srcs.push(s); S.nodes++;
    }
    if (P.buzz) { const z = P.buzz, zg = G(a.g, z.g * (1 - z.am[1] / 2)); lfo(z.am[0], z.g * z.am[1] / 2, zg.gain); persist('sawtooth', r * z.m, F('bandpass', z.hz, z.q, zg)); }
    a.ping = G(a.g, 1);
    if (P.pings && P.pings.echo) { a.send = G(echoIn, P.pings.echo * a.level); a.ping.connect(a.send); }
    echoDelay.delayTime.setTargetAtTime(P.echo[0], t, 0.3); echoFb.gain.setTargetAtTime(P.echo[1], t, 0.3);
    return a;
  };
  const dropAmb = (a, t, tau) => {
    if (!a) return;
    a.g.gain.cancelScheduledValues(t); a.g.gain.setTargetAtTime(0, t, tau);
    const end = t + tau * 7;
    a.srcs.forEach(s => { try { s.stop(end); } catch (e) {} });
    if (a.srcs.length) a.srcs[a.srcs.length - 1].onended = () => {
      a.srcs.forEach(s => { try { s.disconnect(); } catch (e) {} });
      a.g.disconnect(); if (a.send) a.send.disconnect();
      ambienceBeds.delete(a);
    };
    if (a.send) a.send.gain.setTargetAtTime(0, t, tau);
  };
  A.setAmbience = (tier, mode, t) => {
    if (mode === 'off') { dropAmb(amb, t, 0.4); amb = null; return; }
    tier = ct(tier);
    if (amb && amb.tier === tier) {
      if (amb.mode === mode) return;
      const menu = mode === 'menu';
      amb.mode = mode; amb.level = amb.P.level * (menu ? 0.5 : 1); amb.lpBase = amb.P.lp * (menu ? 0.6 : 1);
      amb.g.gain.cancelScheduledValues(t); amb.g.gain.setTargetAtTime(amb.level, t, 0.25);
      amb.lp.frequency.cancelScheduledValues(t); amb.lp.frequency.setTargetAtTime(amb.lpBase, t, 0.25);
      return;
    }
    dropAmb(amb, t, 0.3);
    amb = buildAmb(tier, mode, t + 0.4);
    schedUntil = t + 0.4;
  };
  const ping = (a, P, t) => {
    const v = { out: G(a.ping), srcs: [], stopMax: 0, lastSrc: null };
    ambiencePings.add(v);
    const pingOsc = (type, f, at, end, to) => O(type, f, at, end, to, v);
    const base = rootIn(a.tier, P.lo || 440);
    let f = st(base, PENT5[(Math.random() * 5) | 0]);
    if (P.kind === 'blip' && f < 1600 && Math.random() < 0.3) f *= 2;
    const g = G(v.out);
    if (P.kind === 'blip') { env(g.gain, t, P.g, 0.002, P.dec); pingOsc('sine', f, t, t + P.dec + 0.01, g); }
    else if (P.kind === 'bubble') { env(g.gain, t, P.g, 0.004, P.dec); const o = pingOsc('sine', f, t, t + P.dec + 0.01, g); o.frequency.exponentialRampToValueAtTime(f * 1.8, t + 0.04); }
    else if (P.kind === 'chitter') { for (let i = 0; i < 3; i++) { const gi = G(v.out); env(gi.gain, t + i * 0.03, P.g, 0.001, P.dec); pingOsc('square', f * (1 + i * 0.06), t + i * 0.03, t + i * 0.03 + P.dec + 0.01, F('lowpass', 3500, 0.7, gi)); } }
    else if (P.kind === 'chirp') { [0, 0.09].forEach(dt => { const gi = G(v.out); env(gi.gain, t + dt, P.g, 0.005, P.dec); const o = pingOsc('sine', f, t + dt, t + dt + P.dec + 0.01, gi); o.frequency.exponentialRampToValueAtTime(f * 1.25, t + dt + P.dec * 0.8); }); }
    else if (P.kind === 'bell') { env(g.gain, t, P.g, 0.002, P.dec); pingOsc('triangle', f, t, t + P.dec + 0.01, g); const h = G(v.out); env(h.gain, t, P.g * 0.3, 0.001, P.dec * 0.25); pingOsc('sine', f * 4, t, t + P.dec * 0.25 + 0.01, h); }
    else if (P.kind === 'stomp') { env(g.gain, t, P.g, 0.003, 0.25); const o = pingOsc('sine', a.r * 2, t, t + 0.27, g); o.frequency.exponentialRampToValueAtTime(a.r, t + 0.08); const o2 = pingOsc('triangle', a.r * 4, t, t + 0.27, G(g, 0.4)); o2.frequency.exponentialRampToValueAtTime(a.r * 2, t + 0.08); }
    finish(v, v.stopMax);
    const cleanup = v.lastSrc.onended;
    v.lastSrc.onended = () => { cleanup(); ambiencePings.delete(v); };
  };
  // lookahead scheduler for ambient pings; call every ~100 ms with now = ctx.currentTime
  A.tick = now => {
    if (!amb || !amb.P.pings) return;
    const P = amb.P.pings, horizon = now + 0.3;
    if (schedUntil < now) schedUntil = now;
    if (P.kind === 'stomp') {
      if (amb.nextStomp == null) amb.nextStomp = schedUntil;
      if (amb.nextStomp < now) amb.nextStomp = now;
      while (amb.nextStomp < horizon) { ping(amb, P, amb.nextStomp); amb.nextStomp += P.period; }
      schedUntil = horizon; return;
    }
    let t = schedUntil;
    for (;;) { t += -Math.log(1 - Math.random()) / P.rate; if (t >= horizon) break; ping(amb, P, t); }
    schedUntil = horizon;
  };
  // combo heat: every eat opens the ambience low-pass a little; it relaxes back with a 1.5 s time constant
  const bumpHeat = t => {
    heat = heat * Math.exp(-Math.max(0, t - heatT) / 1.5) + 0.08; if (heat > 1) heat = 1; heatT = t;
    if (!amb) return;
    const p = amb.lp.frequency; p.cancelScheduledValues(t);
    p.setTargetAtTime(amb.lpBase * (1 + 1.2 * heat), t, 0.05); p.setTargetAtTime(amb.lpBase, t + 0.2, 1.5);
    const q = amb.g.gain; q.cancelScheduledValues(t);
    q.setTargetAtTime(amb.level * (1 + 0.4 * heat), t, 0.05); q.setTargetAtTime(amb.level, t + 0.2, 1.5);
  };

  // ---- combo ladder + milestone stings ("combo tiers") ----
  let comboHigh = 0, lastEatT = -9;
  const sting = (level, tier, t) => {
    const v = begin('sting', t, pickBus); if (!v) return;
    const b = rootIn(tier, 440); let end = t;
    if (level === 1) { [7, 12].forEach((s, i) => { end = Math.max(end, tone(v, t + i * 0.045, 'square', st(b, s), 0.16, 0.003, 0.1, 3500)); }); }
    else {
      const lift = level === 3 ? 7 : 0, notes = level >= 4 ? [0, 4, 7, 12, 16] : [0, 4, 7, 12];
      const oct = st(b, notes[notes.length - 1] + lift) > 2400 ? 0.5 : 1;
      notes.forEach((s, i) => { end = Math.max(end, tone(v, t + i * 0.035, 'square', st(b, s + lift) * oct, 0.15, 0.003, 0.11, 3500)); });
      const w = G(v.out); env(w.gain, t, 0.08, 0.01, 0.12); const o = O('sine', 600, t, t + 0.15, w, v); o.frequency.exponentialRampToValueAtTime(1500, t + 0.12);
      end = Math.max(end, tick(v, t + 0.05, 6000, 0.7, [0, 0, 0.05, 0.07, 0.09][level], [0, 0, 0.18, 0.25, 0.35][level], 'highpass'));
      if (level >= 4) end = Math.max(end, tone(v, t, 'square', b / 2, 0.12, 0.004, 0.25, 1800));
    }
    finish(v, end);
  };
  A.combo = (n, tier, t) => {
    n = Math.max(1, n | 0); tier = ct(tier);
    if (n < comboHigh) comboHigh = 0;                      // the chain broke and restarted
    const idx = n <= 8 ? n - 1 : 4 + ((n - 9) % 4);        // climb 8 notes, then roll the top four
    const freq = rootIn(tier, 440) * Math.pow(2, PENT[idx] / 12);
    let level = 0;
    [[5, 1], [10, 2], [25, 3]].forEach(([m, L]) => { if (comboHigh < m && n >= m) level = Math.max(level, L); });
    if (n >= 50 && Math.floor(n / 50) > Math.floor(comboHigh / 50)) level = 4;
    comboHigh = Math.max(comboHigh, n);
    if (level && t != null) sting(level, tier, t + 0.04);
    return { freq, idx, level };
  };

  // ---- events ----
  A.eat = (n, tier, t) => {
    tier = ct(tier);
    const c = A.combo(n, tier, t);                         // milestones fire even when this eat is coalesced
    bumpHeat(t);
    const gap = t - lastEatT;
    const v = begin('eat', t, pickBus); if (!v) return c;
    lastEatT = t;
    const k = tier / 9, jit = 1 + (Math.random() - 0.5) * 0.06, weight = gap < 0.12 ? 0.7 : 1;
    let end = thump(v, t, (340 - 140 * k) * jit, 120 - 50 * k, 0.04 + 0.035 * k, 0.09 + 0.08 * k, 0.55 * weight);
    end = Math.max(end, tick(v, t, 2500, 1.2, 0.18, 0.012));
    const tt = t + 0.012, tdec = 0.09 + Math.min(0.04, 0.005 * n);
    const taper = Math.pow(440 / c.freq, 0.35) * (1 - 0.25 * Math.min(1, Math.max(0, n - 10) / 30));
    const g = G(v.out); env(g.gain, tt, 0.3 * taper * jit, 0.003, tdec);
    const o = O('square', c.freq * 0.94, tt, tt + tdec + 0.03, F('lowpass', Math.min(3200, c.freq * 3), 0.7, g), v);
    o.frequency.exponentialRampToValueAtTime(c.freq, tt + 0.015);
    finish(v, Math.max(end, tt + tdec + 0.03));
    return c;
  };
  A.grow = (tier, t) => {
    tier = ct(tier);
    const v = begin('grow', t, pickBus); if (!v) return false;
    const k = tier / 9;
    let end = thump(v, t, 300 - 120 * k, 90 - 25 * k, 0.06 + 0.03 * k, 0.2 + 0.08 * k, 0.7);
    const ng = G(v.out); env(ng.gain, t, 0.24, 0.001, 0.09);
    const bp = F('bandpass', 1800, 0.9, ng); bp.frequency.setValueAtTime(1800, t); bp.frequency.exponentialRampToValueAtTime(500, t + 0.08);
    N(crush, t, t + 0.11, bp, v);
    const r = rootIn(tier, 220);
    const wg = G(v.out); wg.gain.setValueAtTime(0, t + 0.03); wg.gain.linearRampToValueAtTime(0.2, t + 0.05); wg.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    const o = O('triangle', r, t + 0.03, t + 0.28, F('lowpass', 2000, 0.7, wg), v); o.frequency.exponentialRampToValueAtTime(r * 3, t + 0.21);
    end = Math.max(end, tone(v, t + 0.2, 'triangle', st(rootIn(tier, 440), 7), 0.18, 0.003, 0.16));
    finish(v, Math.max(end, t + 0.28)); return true;
  };
  A.hurt = (tier, t, lowHp) => {
    const v = begin('hurt', t, fxBus); if (!v) return false;
    duck(ambBus, t, 0.5, 0.25, 0.2); duck(pickBus, t, 0.5, 0.15, 0.1);
    const g = G(v.out); env(g.gain, t, 0.5, 0.003, 0.2);
    const o = O('square', 240, t, t + 0.23, F('lowpass', 1200, 4, g), v); o.frequency.exponentialRampToValueAtTime(90, t + 0.14);
    const ng = G(v.out); env(ng.gain, t, 0.3, 0.001, 0.06); N(crush, t, t + 0.08, F('bandpass', 700, 1, ng), v);
    let end = t + 0.23;
    if (lowHp) end = Math.max(end, tone(v, t + 0.2, 'square', 990, 0.12, 0.002, 0.05, 3000), tone(v, t + 0.29, 'square', 740, 0.12, 0.002, 0.07, 3000));
    finish(v, end); return true;
  };
  A.bonk = (tier, t) => {
    const v = begin('bonk', t, pickBus); if (!v) return false;
    const g = G(v.out); env(g.gain, t, 0.45, 0.002, 0.07);
    const o = O('triangle', 520, t, t + 0.09, g, v); o.frequency.exponentialRampToValueAtTime(260, t + 0.04);
    finish(v, Math.max(t + 0.09, tick(v, t, 1800, 1.5, 0.12, 0.01))); return true;
  };
  A.deny = t => {
    const v = begin('deny', t, uiBus); if (!v) return false;
    let end = tone(v, t, 'square', 233, 0.22, 0.003, 0.07, 1400);
    end = Math.max(end, tone(v, t + 0.1, 'square', 220, 0.22, 0.003, 0.09, 1400));
    finish(v, end); return true;
  };
  A.click = t => {
    const v = begin('click', t, uiBus); if (!v) return false;
    const g = G(v.out); env(g.gain, t, 0.3, 0.001, 0.035);
    const o = O('sine', 1400, t, t + 0.045, g, v); o.frequency.exponentialRampToValueAtTime(900, t + 0.025);
    finish(v, Math.max(t + 0.045, tick(v, t, 3000, 0.7, 0.1, 0.006, 'highpass'))); return true;
  };
  A.explode = (tier, t) => {
    const v = begin('explode', t, fxBus); if (!v) return false;
    duck(ambBus, t, 0.2, 0.45, 0.5); duck(pickBus, t, 0.5, 0.3, 0.15);
    let end = thump(v, t, 180, 60, 0.3, 0.6, 0.8);
    const cg = G(v.out); cg.gain.setValueAtTime(0, t); cg.gain.linearRampToValueAtTime(0.55, t + 0.001); cg.gain.setValueAtTime(0.55, t + 0.04); cg.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    const lp = F('lowpass', 6000, 1.5, cg); lp.frequency.setValueAtTime(6000, t); lp.frequency.exponentialRampToValueAtTime(180, t + 0.8);
    const s = N(crush, t, t + 1.02, lp, v); s.playbackRate.setValueAtTime(1, t); s.playbackRate.exponentialRampToValueAtTime(0.25, t + 0.7);
    end = Math.max(end, tick(v, t, 2000, 0.7, 0.4, 0.025, 'highpass'));
    for (let i = 0; i < 8; i++) tick(v, t + 0.15 + Math.random() * 0.75, 1500 + Math.random() * 2500, 2, 0.12 - i * 0.01, 0.008);
    finish(v, Math.max(end, t + 1.02)); return true;
  };
  let holdUntil = 0; const uq = [];
  A.tierUp = (tier, t) => {
    tier = ct(tier);
    const v = begin('tierUp', t, fxBus); if (!v) return false;
    holdUntil = Math.max(holdUntil, t + 0.9);
    duck(ambBus, t, 0.3, 0.9, 0.4); duck(pickBus, t, 0.6, 0.5, 0.2);
    const k = tier / 9;
    let end = thump(v, t, 300 - 120 * k, 90 - 25 * k, 0.05, 0.25, 0.6);
    const sg = G(v.out); env(sg.gain, t, 0.08, 0.01, 0.25);
    const sb = F('bandpass', 2000, 2, sg); sb.frequency.setValueAtTime(2000, t); sb.frequency.exponentialRampToValueAtTime(8000, t + 0.25); N(white, t, t + 0.28, sb, v);
    const R = rootIn(tier, 262); v.out.connect(G(echoIn, 0.15));
    [0, 4, 7].forEach((s, i) => { end = Math.max(end, brass(v, st(R, s), t + i * 0.08, 0.12, 0.14, false)); });
    [0, 7, 12, 16].forEach(s => { end = Math.max(end, brass(v, st(R, s), t + 0.24, 0.6, 0.1, true)); });
    finish(v, end);
    if (opts.autoAmbience !== false) A.setAmbience(tier, 'play', t + 0.6);
    return true;
  };
  A.victory = t => {
    const v = begin('victory', t, fxBus); if (!v) return false;
    holdUntil = Math.max(holdUntil, t + 3.0);
    voices.filter(x => !x.stolen).forEach(x => { if (x !== v) steal(x, t); });
    A.setAmbience(0, 'off', t); duck(pickBus, t, 0.3, 2.5, 0.3);
    const R = rootIn(0, 262); v.out.connect(G(echoIn, 0.15));       // home key D: the journey resolves where it began
    let end = thump(v, t, 260, 80, 0.06, 0.3, 0.7);
    [0, 4, 7].forEach((s, i) => { end = Math.max(end, brass(v, st(R, s), t + i * 0.08, 0.12, 0.14, false)); });
    [[5, 9, 12, 17], [7, 11, 14, 19]].forEach((ch, i) => ch.forEach(s => { end = Math.max(end, brass(v, st(R, s), t + 0.3 + i * 0.3, 0.26, 0.085, false)); }));
    [0, 7, 12, 16].forEach(s => { end = Math.max(end, brass(v, st(R, s), t + 0.9, 1.6, 0.095, true)); });
    thump(v, t + 0.9, 220, 70, 0.08, 0.35, 0.5);
    end = Math.max(end, tick(v, t + 0.9, 5000, 0.7, 0.05, 2.0, 'highpass'));
    finish(v, end); return true;
  };
  A.death = (tier, t) => {
    tier = ct(tier);
    const v = begin('death', t, fxBus); if (!v) return false;
    voices.filter(x => !x.stolen).forEach(x => { if (x !== v) steal(x, t); });
    A.setAmbience(0, 'off', t); duck(pickBus, t, 0.0001, 1.5, 0.3);
    holdUntil = Math.max(holdUntil, t + 1.3);
    const g = G(v.out); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32, t + 0.005); g.gain.setValueAtTime(0.32, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    const lp = F('lowpass', 3000, 6, g); lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(200, t + 0.9);
    const lg = G(null, 40); O('sine', 7, t, t + 1.15, lg, v);
    const o1 = O('sawtooth', 440, t, t + 1.15, lp, v); o1.frequency.exponentialRampToValueAtTime(70, t + 0.9); lg.connect(o1.detune);
    const o2 = O('square', 440, t, t + 1.15, G(lp, 0.6), v); o2.detune.setValueAtTime(-15, t); o2.frequency.exponentialRampToValueAtTime(70, t + 0.9); lg.connect(o2.detune);
    const ng = G(v.out); env(ng.gain, t, 0.4, 0.002, 0.45);
    const nl = F('lowpass', 1200, 0.8, ng); nl.frequency.setValueAtTime(1200, t); nl.frequency.exponentialRampToValueAtTime(150, t + 0.4); N(crush, t, t + 0.5, nl, v);
    const R = rootIn(tier, 262);
    let end = tone(v, t + 0.6, 'triangle', R, 0.22, 0.004, 0.35);
    end = Math.max(end, tone(v, t + 0.9, 'triangle', st(R, -3), 0.22, 0.004, 0.5));
    finish(v, Math.max(end, t + 1.15)); return true;
  };
  const chime = (u, t) => {
    const v = begin('unlock', t, fxBus); if (!v) return;
    const b = rootIn(u.tier, 523), purchase = u.variant === 'purchase';
    const notes = purchase ? [0, 7, 12] : [0, 4, 7, 12], step = purchase ? 0.045 : 0.07;
    v.out.connect(G(echoIn, 0.3));
    let end = t;
    notes.forEach((s, i) => { const at = t + i * step, f = st(b, s); end = Math.max(end, tone(v, at, 'triangle', f, 0.3, 0.002, 0.26)); tone(v, at, 'sine', f * 4, 0.08, 0.001, 0.06); });
    end = Math.max(end, tick(v, t + notes.length * step, 7000, 0.7, 0.06, 0.3, 'highpass'));
    finish(v, end);
  };
  A.unlock = (tier, variant) => { uq.push({ tier: ct(tier), variant: variant || 'unlock' }); while (uq.length > 3) uq.shift(); };
  A.flushUnlocks = t => { let at = Math.max(t, holdUntil); uq.splice(0).forEach(u => { chime(u, at); S.unlockTimes.push(Math.round(at * 1000) / 1000); at += 0.24; }); };
  A.ready = (tier, t) => {
    const v = begin('ready', t, fxBus); if (!v) return false;
    const R = rootIn(ct(tier), 262);
    const lp = F('lowpass', 500, 2, G(v.out)); lp.frequency.setValueAtTime(500, t); lp.frequency.exponentialRampToValueAtTime(4000, t + 0.2);
    let end = t;
    [0, 7, 12, 19].forEach((s, i) => { const at = t + i * 0.045, gg = G(lp); env(gg.gain, at, 0.3, 0.002, 0.09); O('square', st(R, s), at, at + 0.11, gg, v); end = at + 0.11; });
    const ng = G(v.out); env(ng.gain, t, 0.06, 0.15, 0.05);
    const nb = F('bandpass', 800, 1.5, ng); nb.frequency.setValueAtTime(800, t); nb.frequency.exponentialRampToValueAtTime(5000, t + 0.18); N(white, t, t + 0.22, nb, v);
    finish(v, Math.max(end, t + 0.22)); return true;
  };
  A.beat = (tier, t) => {
    const v = begin('beat', t, fxBus); if (!v) return false;
    let end = thump(v, t, 240, 110, 0.05, 0.12, 0.32, 1.0);
    end = Math.max(end, thump(v, t + 0.14, 200, 95, 0.05, 0.14, 0.24, 1.0));
    finish(v, end); return true;
  };

  // Mute, interruption and a new run discard scheduled cues on the audio clock.
  A.clear = t => {
    voices.splice(0).forEach(v => {
      v.out.gain.cancelScheduledValues(t); v.out.gain.setValueAtTime(0, t);
      v.srcs.forEach(s => { try { s.stop(t); s.disconnect(); } catch (e) {} });
      v.out.disconnect();
    });
    ambiencePings.forEach(v => {
      v.srcs.forEach(s => { try { s.stop(t); s.disconnect(); } catch (e) {} });
      v.out.disconnect();
    });
    ambiencePings.clear();
    // Fading beds are still live graphs, even after the current tier changes.
    ambienceBeds.forEach(a => {
      a.srcs.forEach(s => { try { s.stop(t); s.disconnect(); } catch (e) {} });
      a.g.disconnect(); if (a.send) a.send.disconnect();
    });
    ambienceBeds.clear(); amb = null;
    // Break and reconnect the echo loop to discard its buffered tail.
    echoIn.disconnect(); echoDelay.disconnect(); echoLp.disconnect(); echoFb.disconnect();
    echoDelay = ctx.createDelay(1); echoLp = ctx.createBiquadFilter(); echoFb = ctx.createGain();
    echoDelay.delayTime.value = 0.12; echoLp.type = 'lowpass'; echoLp.frequency.value = 2200; echoFb.gain.value = 0.25;
    echoIn.connect(echoDelay); echoDelay.connect(echoLp); echoLp.connect(echoFb); echoFb.connect(echoDelay); echoLp.connect(ambBus);
    [pickBus, fxBus, uiBus, ambBus].forEach(b => { b.gain.cancelScheduledValues(t); b.gain.setValueAtTime(1, t); });
    Object.keys(ducks).forEach(k => delete ducks[k]); Object.keys(last).forEach(k => delete last[k]);
    uq.length = 0; holdUntil = t; comboHigh = 0; lastEatT = -9; heat = 0; heatT = t; schedUntil = t;
  };
  A.resetCombo = () => { comboHigh = 0; };
  A.stageUntil = () => holdUntil;

  A.stats = () => ({ started: S.started, kinds: Object.assign({}, S.kinds), dropped: Object.assign({}, S.dropped), stolen: S.stolen, maxVoices: S.maxVoices, nodes: S.nodes, unlockTimes: S.unlockTimes.slice() });
  A.master = master; A.buses = { pickBus, fxBus, uiBus, ambBus };
  A.ambInfo = () => (amb ? { tier: amb.tier, mode: amb.mode, level: amb.level } : null);
  return A;
}

root.createEndBirdAudio = createEndBirdAudio;
root.EndBirdAudioKeys = { rootIn, keyPc, PENT, AMB };
})(typeof window !== 'undefined' ? window : globalThis);
