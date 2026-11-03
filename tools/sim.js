#!/usr/bin/env node
// Headless playability simulator.
//   node tools/sim.js [trackId ...] [--race] [--features] [--bots]
// Loads config/tracks/physics/ai exactly as the browser does and reports:
//   --race      AI drives 3 laps (lap times, falls, damage, max impact)
//   --features  for each jump/gap and crest: approach-speed windows (mph)
//               "clean" = no fall and < 0.03 crack, "survive" = no fall
//   --bots      naive drivers: full throttle (no boost) and throttle+boost
// Default: all three.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = { console, Math, Object, Array, Error, Infinity, Float32Array };
vm.createContext(ctx);
for (const f of ['config', 'tracks', 'physics', 'ai']) {
  const src = fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8')
    .replace(/^(const|let) (\w+)\s*=/gm, 'var $2 =');
  vm.runInContext(src, ctx, { filename: f + '.js' });
}
const { CFG, TRACKS, Physics, AI, Track } = ctx;
const DT = 1 / 120;
const MPH = CFG.MPH;

const args = process.argv.slice(2);
const skIdx = args.indexOf('--skill');
const SKILL = skIdx >= 0 ? parseFloat(args[skIdx + 1]) : 1;
const flags = new Set(args.filter(a => a.startsWith('--')));
let ids = args.filter((a, i) => !a.startsWith('--') && !(skIdx >= 0 && i === skIdx + 1));
if (!ids.length) ids = Object.keys(TRACKS);
const all = !flags.size;

function race(trk, ctrl, maxT, opts) {
  const c = Physics.createCar(Object.assign({ x: 0, z: 0 }, opts || {}));
  let t = 0, maxAir = 0, laps = [], lastLapT = 0, airT = 0;
  const L = trk.len;
  while (t < maxT && !c.wrecked) {
    Physics.step(c, ctrl(c, t), trk, t, DT, null);
    t += DT;
    if (c.state === 'air') { airT += DT; maxAir = Math.max(maxAir, airT); } else airT = 0;
    const done = Math.floor((c.z - c.startZ) / L);
    while (laps.length < done) { laps.push(t - lastLapT); lastLapT = t; }
    if (laps.length >= CFG.LAPS) break;
  }
  return { c, t, laps, maxAir };
}

function fmt(n, d = 1) { return n.toFixed(d); }

// Features: gaps (grouped) and crests (local height maxima > 2 m)
function features(trk) {
  const S = CFG.SEG_LEN, segs = trk.segs, out = [];
  for (let i = 0; i < segs.length; i++) {
    if (segs[i].gap && (i === 0 || !segs[i - 1].gap)) {
      let j = i; while (segs[j].gap) j++;
      out.push({ kind: 'gap', i, z: i * S, len: (j - i) * S, ai: segs[Math.max(0, i - 1)].ai });
    }
    if (segs[i].lift && (i === 0 || !segs[i - 1].lift)) out.push({ kind: 'lift', i, z: i * S, ai: segs[i].ai });
    const s = segs[i], p = segs[(i - 1 + segs.length) % segs.length];
    if (!s.gap && !p.gap && !s.lift && s.y1 > 2 && p.y2 - p.y1 > 0.0001 && s.y2 - s.y1 <= 0.0001) {
      if (!out.some(f => f.kind === 'gap' && f.i > i && f.i - i < 12)) out.push({ kind: 'crest', i, z: i * S, h: s.y1, ai: s.ai });
    }
  }
  return out;
}

// Approach a feature holding a constant speed v (m/s), see what happens.
function probe(trk, f, v, liftT) {
  const c = Physics.createCar({ z: f.z - 220, x: 0 });
  const g = Track.ground(trk, c.z, 0);
  c.y = g.h; c.speed = v;
  const startCrack = c.crack;
  let t = liftT || 0, fell = false, landImpact = 0;
  const ev = (k, car, s) => { if (k === 'fall') fell = true; };
  const end = f.z + (f.len || 0) + 200;
  while (c.z < end && t < 40) {
    const inp = { accel: c.speed < v - 0.3, brake: c.speed > v + 2, boost: v > CFG.VMAX * 0.98 && c.speed < v - 0.3 };
    inp.steer = AI.controls(c, null, trk, t, 1).steer;
    if (c.z > f.z - 10) { inp.accel = c.speed < v - 0.3; inp.brake = false; }
    Physics.step(c, inp, trk, t, DT, ev);
    t += DT;
    if (fell || c.wrecked) break;
  }
  return { fell: fell || c.wrecked, dmg: c.crack - startCrack, impact: c.maxImpact };
}

function windows(trk, f) {
  const res = [];
  for (let mph = 60; mph <= 245; mph += 5) res.push({ mph, r: probe(trk, f, mph / MPH) });
  const ranges = pred => {
    const r = []; let s = null;
    for (const x of res) {
      if (pred(x.r)) { if (s === null) s = x.mph; }
      else if (s !== null) { r.push(s + '-' + (x.mph - 5)); s = null; }
    }
    if (s !== null) r.push(s + '-' + res[res.length - 1].mph);
    return r.join(',') || 'none';
  };
  return {
    clean: ranges(r => !r.fell && r.dmg < 0.03),
    survive: ranges(r => !r.fell),
  };
}

for (const id of ids) {
  const trk = TRACKS[id];
  if (!trk) { console.log('unknown track', id); continue; }
  console.log(`\n=== ${id} "${trk.name}" div ${trk.div}  len ${trk.len} m (${trk.segs.length} segs)`);

  if (all || flags.has('--race')) {
    const sk = flags.has('--divskill') ? ({ 4: 0.85, 3: 0.90, 2: 0.94, 1: 0.97 })[trk.div] : SKILL;
    const r = race(trk, (c, t) => AI.controls(c, null, trk, t, sk), 400);
    console.log(`AI race s=${fmt(sk, 2)} : ${r.laps.length >= CFG.LAPS ? 'FINISHED' : r.c.wrecked ? 'WRECKED' : 'DNF'} t=${fmt(r.t)}s laps=[${r.laps.map(x => fmt(x)).join(', ')}]` +
      ` falls=${r.c.falls} crack=${fmt(r.c.crack, 2)} holes=${r.c.holes.length} maxImpact=${fmt(r.c.maxImpact)} maxAir=${fmt(r.maxAir, 2)}s boostLeft=${fmt(r.c.boost, 0)}`);
  }
  if (all || flags.has('--bots')) {
    const bots = [['throttle', () => ({ accel: true })], ['throttle+boost', () => ({ accel: true, boost: true })],
      ['steer+throttle', (c, t) => { const a = AI.controls(c, null, trk, t, 1); return { accel: true, brake: false, boost: false, steer: a.steer }; }]];
    for (const [name, fn] of bots) {
      const r = race(trk, fn, 400);
      console.log(`${name.padEnd(15)}: ${r.laps.length >= CFG.LAPS ? 'FINISHED' : r.c.wrecked ? 'WRECKED' : 'DNF'} t=${fmt(r.t)}s laps=${r.laps.length} falls=${r.c.falls} crack=${fmt(r.c.crack, 2)} maxImpact=${fmt(r.c.maxImpact)}`);
    }
  }
  if (all || flags.has('--features')) {
    for (const f of features(trk)) {
      if (f.kind === 'lift') { console.log(`  lift  @${f.z}m (ai ${f.ai}) — timing dependent`); continue; }
      const w = windows(trk, f);
      const desc = f.kind === 'gap' ? `gap   @${f.z}m len ${f.len}m` : `crest @${f.z}m h ${fmt(f.h)}m`;
      console.log(`  ${desc.padEnd(26)} ai=${f.ai}  clean: ${w.clean}  survive: ${w.survive}`);
    }
  }
}
