#!/usr/bin/env node
// Headless playability simulator.
//   node tools/sim.js [trackId ...] [--race] [--features] [--bots]
//                     [--skill 0.9] [--divskill] [--trace]
//   --skill s     AI skill used for --race (default 1)
//   --divskill    use each division's lowest AI skill (div4 .85, div3 .90, div2 .94, div1 .97)
//   --trace       list every damaging impact / fall during the --race run
// Loads config/tracks/physics/ai exactly as the browser does and reports:
//   --race      AI drives 3 laps (lap times, falls, damage, max impact)
//   --features  for each jump/gap and crest: approach-speed windows (mph)
//               "clean" = no fall and < 0.03 crack, "survive" = no fall
//   --bots      naive drivers: full throttle (no boost), throttle+boost, and
//               steer+throttle (AI steering, always accelerating, never braking/boosting)
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

function race(trk, ctrl, maxT, opts, log) {
  const c = Physics.createCar(Object.assign({ x: 0, z: 0 }, opts || {}));
  let t = 0, maxAir = 0, laps = [], lastLapT = 0, airT = 0;
  const L = trk.len;
  const S = CFG.SEG_LEN;
  // gap starts (for per-lap lip speed / boost reports)
  const lips = [];
  trk.segs.forEach((sg, i) => { if (sg.gap && !trk.segs[(i - 1 + trk.segs.length) % trk.segs.length].gap) lips.push(i * S); });
  const lipLog = [];
  let prevZ = c.z;
  const ev = (k, car, x) => {
    if (log && (k === 'fall' || (k === 'impact' && car.maxImpact > 0))) log.push(`${k}@${(((car.z % L) + L) % L).toFixed(0)}m lap${Math.floor(car.z / L) + 1} v=${(car.speed * MPH).toFixed(0)}mph imp=${car.maxImpact.toFixed(1)} crack=${car.crack.toFixed(2)}`);
  };
  while (t < maxT && !c.wrecked) {
    Physics.step(c, ctrl(c, t), trk, t, DT, ev);
    for (const lz of lips) {
      const a = Track.wrap(trk, prevZ), b2 = a + (c.z - prevZ);
      if (a < lz && b2 >= lz) lipLog.push({ z: lz, lap: Math.floor(c.z / L) + 1, mph: c.speed * MPH, boost: c.boost });
    }
    prevZ = c.z;
    t += DT;
    if (c.state === 'air') { airT += DT; maxAir = Math.max(maxAir, airT); } else airT = 0;
    const done = Math.floor((c.z - c.startZ) / L);
    while (laps.length < done) { laps.push(t - lastLapT); lastLapT = t; }
    if (laps.length >= CFG.LAPS) break;
  }
  return { c, t, laps, maxAir, lipLog };
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
  // Start on solid road at least ~200 m before the feature (never inside a gap/lift)
  const S = CFG.SEG_LEN, n = trk.segs.length;
  let z0 = f.z - 220;
  for (let k = 0; k < 400; k++, z0 -= S) {
    const i0 = Math.floor(Track.wrap(trk, z0) / S);
    let ok = true;
    for (let j = 0; j < 8; j++) { const sg = trk.segs[(i0 + j) % n]; if (sg.gap || sg.lift) { ok = false; break; } }
    if (ok) break;
  }
  const c = Physics.createCar({ z: z0, x: 0 });
  const g = Track.ground(trk, c.z, 0);
  c.y = g.h; c.speed = v; c.vy = v * g.slope;
  const startCrack = c.crack;
  // Lift bridges: start the clock so the first bridge ahead is down when we reach it
  let t = liftT || 0, fell = false, landImpact = 0;
  for (let k = 0, zz = z0; k < 120 && !liftT; k++, zz += S) {
    const sg = trk.segs[Math.floor(Track.wrap(trk, zz) / S)];
    if (sg.lift) { const tA = (zz - z0) / v; t = ((0.6 - tA) % 12 + 12) % 12; break; }
  }
  const ev = (k, car, s) => { if (k === 'fall') fell = true; };
  const end = f.z + (f.len || 0) + 300;
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

  let r_ = null, evlog = null;
  if (all || flags.has('--race')) {
    const sk = flags.has('--divskill') ? ({ 4: 0.85, 3: 0.90, 2: 0.94, 1: 0.97 })[trk.div] : SKILL;
    evlog = flags.has('--trace') ? [] : null;
    const r = r_ = race(trk, (c, t) => AI.controls(c, null, trk, t, sk), 400, null, evlog);
    console.log(`AI race s=${fmt(sk, 2)} : ${r.laps.length >= CFG.LAPS ? 'FINISHED' : r.c.wrecked ? 'WRECKED' : 'DNF'} t=${fmt(r.t)}s laps=[${r.laps.map(x => fmt(x)).join(', ')}]` +
      ` falls=${r.c.falls} crack=${fmt(r.c.crack, 2)} holes=${r.c.holes.length} maxImpact=${fmt(r.c.maxImpact)} maxAir=${fmt(r.maxAir, 2)}s boostLeft=${fmt(r.c.boost, 0)}`);
  }
  if (r_ && r_.lipLog.length) {
    const byZ = {};
    for (const l of r_.lipLog) (byZ[l.z] = byZ[l.z] || []).push(`${l.mph.toFixed(0)}mph/boost${l.boost.toFixed(0)}`);
    console.log('  lip speeds per lap: ' + Object.entries(byZ).map(([z, a]) => `@${z}m ${a.join(' ')}`).join(' | '));
  }
  if (evlog && evlog.length) console.log('  ' + evlog.join('\n  '));
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
