'use strict';

// Synthesised audio (Web Audio API only, no sound files).
// The AudioContext is created lazily on the first resume() call, because
// browsers only allow audio after a user gesture. Every public function is a
// no-op when Web Audio is unavailable or the graph has not been built yet.
const Audio = (() => {
  const MAX_MPH        = 260;
  const ENGINE_IDLE_HZ = 42;    // pitch at 0 mph
  const ENGINE_SPAN_HZ = 286;   // pitch rises by this much at 260 mph

  let ctx        = null;
  let enabled    = true;        // false when Web Audio is missing or failed
  let built      = false;       // true once the node graph exists
  let master     = null;

  let engineOsc1 = null;        // sawtooth
  let engineOsc2 = null;        // detuned square
  let engineMix  = null;
  let engineFilter = null;
  let engineGain   = null;

  let boostGain   = null;       // bus for boost layer (silent by default)
  let boostOsc    = null;
  let boostNoiseFilter = null;
  let noiseBuffer = null;       // created once, reused by impacts and boost hiss

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  function makeDistortionCurve(amount) {
    const n = 256;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  function makeNoiseBuffer() {
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function buildGraph() {
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);

    noiseBuffer = makeNoiseBuffer();

    // Engine: two slightly detuned oscillators -> mild distortion -> lowpass
    engineOsc1 = ctx.createOscillator();
    engineOsc1.type = 'sawtooth';
    engineOsc1.frequency.value = ENGINE_IDLE_HZ;

    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'square';
    engineOsc2.frequency.value = ENGINE_IDLE_HZ;
    engineOsc2.detune.value = -9;   // cents; produces slow beating

    engineMix = ctx.createGain();
    engineMix.gain.value = 0.45;

    const shaper = ctx.createWaveShaper();
    shaper.curve = makeDistortionCurve(6);   // slight growl
    shaper.oversample = '2x';

    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 450;
    engineFilter.Q.value = 1.2;

    engineGain = ctx.createGain();
    engineGain.gain.value = 0;

    engineOsc1.connect(engineMix);
    engineOsc2.connect(engineMix);
    engineMix.connect(shaper);
    shaper.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);

    // Boost: rough detuned oscillator plus bandpassed noise hiss
    boostGain = ctx.createGain();
    boostGain.gain.value = 0;
    boostGain.connect(master);

    boostOsc = ctx.createOscillator();
    boostOsc.type = 'sawtooth';
    boostOsc.frequency.value = ENGINE_IDLE_HZ * 2;
    boostOsc.connect(boostGain);

    const hiss = ctx.createBufferSource();
    hiss.buffer = noiseBuffer;
    hiss.loop = true;
    boostNoiseFilter = ctx.createBiquadFilter();
    boostNoiseFilter.type = 'bandpass';
    boostNoiseFilter.frequency.value = 1400;
    boostNoiseFilter.Q.value = 0.8;
    hiss.connect(boostNoiseFilter);
    boostNoiseFilter.connect(boostGain);

    engineOsc1.start();
    engineOsc2.start();
    boostOsc.start();
    hiss.start();

    built = true;
  }

  // Records that audio is wanted. The AudioContext itself is created in resume().
  function init() {
    enabled = !!(window.AudioContext || window.webkitAudioContext);
  }

  function ensureGraph() {
    if (built) return true;
    if (!enabled) return false;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      ctx = new Ctor();
      buildGraph();
      return true;
    } catch (e) {
      enabled = false;
      built = false;
      ctx = null;
      return false;
    }
  }

  // Creates the context on first call and resumes it if suspended. Safe to call anytime.
  function resume() {
    if (!ensureGraph()) return;
    if (ctx.state === 'suspended') {
      try {
        const p = ctx.resume();
        if (p && p.catch) p.catch(() => {});
      } catch (e) { /* ignore */ }
    }
  }

  // mph: 0..260, boost: truthy while the turbo is firing, airborne: car is in the air.
  function update(opts) {
    if (!built) return;
    const o = opts || {};
    const speed = clamp(Number(o.mph) || 0, 0, MAX_MPH) / MAX_MPH;
    const t = ctx.currentTime;

    let freq = ENGINE_IDLE_HZ + speed * ENGINE_SPAN_HZ;
    let gain = 0.035 + 0.1 * speed;          // idle hum never fully silent
    if (o.airborne) {                        // no load in the air: revs up a little
      freq *= 1.12;
      gain *= 1.15;
    }

    engineOsc1.frequency.setTargetAtTime(freq, t, 0.06);
    engineOsc2.frequency.setTargetAtTime(freq, t, 0.06);
    engineFilter.frequency.setTargetAtTime(450 + speed * 2600, t, 0.1);
    engineGain.gain.setTargetAtTime(gain, t, 0.08);

    const boostOn = !!o.boost;
    boostOsc.frequency.setTargetAtTime(freq * 2.01, t, 0.05);
    boostGain.gain.setTargetAtTime(boostOn ? 0.07 : 0, t, 0.05);
  }

  // Fades engine and boost to silence (menus, pause).
  function silence() {
    if (!built) return;
    const t = ctx.currentTime;
    engineGain.gain.setTargetAtTime(0, t, 0.05);
    boostGain.gain.setTargetAtTime(0, t, 0.05);
  }

  // strength 0..1: short low-passed noise thump, louder and longer when stronger.
  function impact(strength) {
    if (!built) return;
    const s = clamp(Number(strength) || 0, 0, 1);
    if (s <= 0) return;
    const t = ctx.currentTime;
    const dur = 0.12 + 0.28 * s;

    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.playbackRate.value = 0.8 + Math.random() * 0.2;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(260 + 900 * s, t);
    lp.frequency.exponentialRampToValueAtTime(120, t + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05 + 0.5 * s, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(lp);
    lp.connect(g);
    g.connect(master);
    src.onended = () => { src.disconnect(); lp.disconnect(); g.disconnect(); };
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }

  // Countdown beep. high = true is the GO beep (higher and longer).
  function beep(high) {
    if (!built) return;
    const t = ctx.currentTime;
    const dur = high ? 0.4 : 0.18;

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = high ? 880 : 440;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.01);
    g.gain.setValueAtTime(0.18, t + dur - 0.05);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);

    osc.connect(g);
    g.connect(master);
    osc.onended = () => { osc.disconnect(); g.disconnect(); };
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  return { init, resume, update, silence, impact, beep };
})();
