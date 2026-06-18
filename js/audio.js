'use strict';

// Web Audio engine: synthesised sounds, no audio files needed
const Audio = (() => {
  let ctx = null;
  let engineNode = null;
  let engineGain = null;
  let boostGain  = null;
  let boostNode  = null;
  let enabled    = true;

  function init() {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      buildEngine();
    } catch (e) {
      enabled = false;
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function buildEngine() {
    // Engine oscillator: pitch tracks speed
    engineNode = ctx.createOscillator();
    engineNode.type = 'sawtooth';
    engineNode.frequency.value = 80;

    // Distortion for engine growl
    const wave = ctx.createWaveShaper();
    wave.curve = makeDistortionCurve(120);
    wave.oversample = '2x';

    engineGain = ctx.createGain();
    engineGain.gain.value = 0;

    engineNode.connect(wave);
    wave.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineNode.start();

    // Boost layer: brighter oscillator
    boostNode = ctx.createOscillator();
    boostNode.type = 'square';
    boostNode.frequency.value = 200;

    boostGain = ctx.createGain();
    boostGain.gain.value = 0;

    boostNode.connect(boostGain);
    boostGain.connect(ctx.destination);
    boostNode.start();
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

  function update(speed, boost, boostActive) {
    if (!enabled || !ctx) return;

    const t = ctx.currentTime;
    const freq = 60 + speed * 1.4;
    engineNode.frequency.setTargetAtTime(freq, t, 0.05);

    const vol = speed > 5 ? 0.08 : 0;
    engineGain.gain.setTargetAtTime(vol, t, 0.02);

    const boostVol = boostActive && boost > 0 ? 0.12 : 0;
    boostNode.frequency.setTargetAtTime(freq * 1.5, t, 0.05);
    boostGain.gain.setTargetAtTime(boostVol, t, 0.03);
  }

  function playImpact(velocity) {
    if (!enabled || !ctx || velocity < 50) return;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.min(0.4, velocity * 0.0008), ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.8;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(g);
    g.connect(ctx.destination);
    src.start();
  }

  return { init, resume, update, playImpact };
})();
