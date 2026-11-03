'use strict';

// ---------------------------------------------------------------------------
// Track model
//   A track is a closed loop of segments, each CFG.SEG_LEN metres long.
//   seg = { y1, y2, curve, gap, lift, ai }
//     y1/y2 : road height (m) at segment start/end (may jump after a gap)
//     curve : lateral bend (+ right, - left); also drives centrifugal drift
//     gap   : no road surface (jump it or fall)
//     lift  : part of a lift bridge (heights depend on time)
//     ai    : AI target speed (mph) for this segment
// ---------------------------------------------------------------------------

const EASE = {
  lin:    t => t,
  smooth: t => (1 - Math.cos(Math.PI * t)) / 2, // S-curve, flat both ends
  in:     t => t * t,                           // flat start, steep end (kicker)
  out:    t => 1 - (1 - t) * (1 - t),           // steep start, flat end (landing)
};

function TrackBuilder() {
  const segs = [];
  const lifts = [];
  let h = 0, ai = 150;

  const b = {
    ai(mph) { ai = mph; return b; },
    shape(n, toH, curve, ease) {
      const h0 = h, e = EASE[ease];
      for (let i = 0; i < n; i++) {
        segs.push({
          y1: h0 + (toH - h0) * e(i / n),
          y2: h0 + (toH - h0) * e((i + 1) / n),
          curve: curve || 0, gap: false, lift: false, ai,
        });
      }
      h = toH;
      return b;
    },
    flat(n, curve)       { return b.shape(n, h, curve, 'lin'); },
    hill(n, toH, curve)  { return b.shape(n, toH, curve, 'smooth'); },
    lin(n, toH, curve)   { return b.shape(n, toH, curve, 'lin'); },
    ramp(n, toH, curve)  { return b.shape(n, toH, curve, 'in'); },
    land(n, toH, curve)  { return b.shape(n, toH, curve, 'out'); },
    gap(n) {
      for (let i = 0; i < n; i++) segs.push({ y1: h, y2: h, curve: 0, gap: true, lift: false, ai });
      return b;
    },
    at(height) { h = height; return b; },  // set height (use right after a gap)
    lift(n) {
      lifts.push({ i0: segs.length, n, base: h });
      for (let i = 0; i < n; i++) segs.push({ y1: h, y2: h, curve: 0, gap: false, lift: true, ai });
      return b;
    },
    build(meta) {
      if (Math.abs(h) > 0.01) throw new Error(`Track ${meta.name} ends at height ${h}, must end at 0`);
      return Object.assign({}, meta, { segs, lifts, len: segs.length * CFG.SEG_LEN });
    },
  };
  return b;
}

// ---------------------------------------------------------------------------
// Queries shared by physics, AI and renderer (pure functions)
// ---------------------------------------------------------------------------
const Track = (() => {
  const LIFT_PERIOD = 12;     // seconds per raise/lower cycle
  const LIFT_MAX = 0.62;      // max leaf angle (rad)

  function wrap(trk, z) { const L = trk.len; return ((z % L) + L) % L; }

  // Leaf angle of every lift bridge at race time t (all bridges in sync)
  function liftAngle(t) {
    const p = ((t % LIFT_PERIOD) + LIFT_PERIOD) % LIFT_PERIOD;
    const s = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
    if (p < 4)  return 0;                                 // down
    if (p < 6)  return LIFT_MAX * s((p - 4) / 2);         // raising
    if (p < 9)  return LIFT_MAX;                          // up
    if (p < 11) return LIFT_MAX * (1 - s((p - 9) / 2));   // lowering
    return 0;
  }

  function liftOf(trk, i) {
    for (const lf of trk.lifts) if (i >= lf.i0 && i < lf.i0 + lf.n) return lf;
    return null;
  }

  // Surface height of a lift bridge at distance d (m) from its start
  function liftSurface(lf, d, t) {
    const S = CFG.SEG_LEN, half = lf.n * S / 2, a = liftAngle(t);
    const ta = Math.tan(a), reach = half * Math.cos(a);
    if (d <= half) {                       // near leaf, hinged at start
      return { solid: d <= reach, h: lf.base + d * ta, slope: ta };
    }
    const d2 = lf.n * S - d;               // far leaf, hinged at end
    return { solid: d2 <= reach, h: lf.base + d2 * ta, slope: -ta };
  }

  // Road surface under track position z at time t.
  // Returns { solid, h, slope, seg, i }. For gaps, h is the nominal height.
  function ground(trk, z, t) {
    const S = CFG.SEG_LEN;
    const zz = wrap(trk, z);
    const i = Math.min(trk.segs.length - 1, Math.floor(zz / S));
    const seg = trk.segs[i];
    if (seg.gap) return { solid: false, h: seg.y1, slope: 0, seg, i };
    if (seg.lift) {
      const lf = liftOf(trk, i);
      const r = liftSurface(lf, zz - lf.i0 * S, t);
      r.seg = seg; r.i = i;
      return r;
    }
    const f = (zz - i * S) / S;
    return { solid: true, h: seg.y1 + (seg.y2 - seg.y1) * f, slope: (seg.y2 - seg.y1) / S, seg, i };
  }

  // Segment endpoint heights for rendering (handles lift bridges)
  function segHeights(trk, i, t) {
    const seg = trk.segs[i];
    if (!seg.lift) return [seg.y1, seg.y2, !seg.gap];
    const lf = liftOf(trk, i), S = CFG.SEG_LEN;
    const d1 = (i - lf.i0) * S, d2 = d1 + S;
    const a = liftSurface(lf, d1 + 0.01, t), b = liftSurface(lf, d2 - 0.01, t);
    const mid = liftSurface(lf, d1 + S / 2, t);
    return [a.h, b.h, mid.solid];
  }

  return { wrap, ground, segHeights, liftAngle, liftOf, LIFT_PERIOD };
})();

// ---------------------------------------------------------------------------
// Tracks (original designs). Lengths are in segments (5 m each), heights in m.
// ---------------------------------------------------------------------------
const TRACKS = {};
function defTrack(id, meta, fn) { TRACKS[id] = fn(TrackBuilder()).build(Object.assign({ id }, meta)); }

// Sharp crest: parabolic rise then parabolic drop. The kink at the apex is what
// launches the car; landing impact is roughly speed x kink, so a crest with
// kink k is "clean" up to about 8.2 / k m/s.
function crest(b, base, H, nUp, nDn) { return b.ramp(nUp, base + H).land(nDn, base); }

// A kicker ramp, a gap, and a landing slope down to `toH`.
//   B: approach height, n1/H1: ramp length (segs) and rise, g: gap (segs),
//   hLand: surface height just past the gap, nl: landing length (segs)
function jump(b, B, n1, H1, g, hLand, nl, toH) {
  return b.ramp(n1, B + H1).gap(g).at(hLand).land(nl, toH);
}

// A row of short platforms, each with a small kicker and a gap after it.
function islands(b, base, k) {
  for (let i = 0; i < k; i++) b.flat(2).ramp(3, base + 0.6).gap(6).at(base);
  return b;
}

// Hops: a row of bare 10 m kickers over 25 m gaps (no platform in between), so
// being too slow drops short and being too fast lands in the next gap.
function hops(b, base, k) {
  for (let i = 0; i < k; i++) b.ramp(2, base + 0.4).gap(5).at(base);
  return b;
}

// ---- Division 4 ----
defTrack('kicker', { name: 'Kicker Loop', div: 4, hint: 'A small hump, then one kicker over a gap. Roughly 120-170 mph clears it.' }, b => {
  b.ai(165).flat(26).flat(18, 0.10).flat(8);
  b.ai(140); crest(b, 0, 2.4, 16, 16);
  b.ai(160).flat(10).flat(20, -0.10).flat(10);
  b.ai(150).hill(16, 7).flat(14);
  jump(b, 7, 10, 1.5, 6, 8.0, 30, 0);
  b.ai(160).flat(22, 0.12).flat(8);
  b.ai(140); crest(b, 0, 2.4, 16, 16);
  return b.ai(160).flat(16, -0.08).flat(20);
});

defTrack('camel', { name: 'Camel Hills', div: 4, hint: 'Rolling humps. Ease off over the sharp crest or you fly and land hard.' }, b => {
  b.ai(165).flat(26);
  b.ai(150).hill(14, 4).hill(14, 0).flat(8);
  b.ai(160).flat(20, 0.12).flat(10);
  b.ai(135).hill(14, 5); crest(b, 5, 2.0, 14, 14); b.hill(14, 0);
  b.ai(160).flat(10).flat(20, -0.10).flat(6);
  b.ai(150).hill(20, 13).hill(20, 0);
  return b.ai(165).flat(20, 0.10).flat(26);
});

// ---- Division 3 ----
defTrack('islands', { name: 'Island Hop', div: 3, hint: 'Short platforms with gaps. Too slow drops short, too fast overshoots: hold about 130 mph.' }, b => {
  b.ai(160).flat(20).flat(16, 0.10).flat(6);
  b.ai(150).hill(16, 12).flat(8);
  b.ai(135); islands(b, 12, 5);
  b.ai(150).flat(10).hill(16, 0);
  b.ai(160).flat(18, -0.12).flat(14, 0.10).flat(8);
  b.ai(135); islands(b, 0, 4);
  return b.ai(160).flat(12).flat(18, -0.08).flat(14);
});

defTrack('longramp', { name: 'Long Ramp', div: 3, hint: 'Three quick hops, a kicker, then the long one. No boost needed, but you must carry speed.' }, b => {
  b.ai(165).flat(16).flat(16, 0.10).flat(6);
  b.ai(140).hill(12, 4).flat(6);
  b.ai(125); hops(b, 4, 3);
  b.ai(150).flat(8).hill(14, 0);
  b.ai(160).flat(14, -0.14).flat(6);
  b.ai(145).hill(12, 6).flat(6);
  jump(b, 6, 10, 1.9, 7, 7.6, 26, 0);
  b.ai(170).hill(14, 10, 0.10).flat(44);
  jump(b, 10, 10, 1.25, 8, 10.5, 50, 0);
  return b.ai(160).flat(14, -0.10).flat(16);
});

// ---- Division 2 ----
defTrack('canyon', { name: 'The Canyon', div: 2, hint: 'One huge chasm. You need 200+ mph at the lip: boost down the long straight.' }, b => {
  b.ai(165).flat(10).flat(16, 0.12).flat(4);
  b.ai(130).hill(14, 6); crest(b, 6, 2.0, 12, 12); b.hill(12, 0);
  b.ai(160).flat(12, -0.14).flat(4);
  b.ai(170).hill(18, 15);
  b.ai(180).flat(28).ai(208).flat(40);
  jump(b, 15, 10, 0.75, 9, 15.65, 60, 0);
  b.ai(160).flat(14, 0.12).flat(6);
  b.ai(130).hill(12, 5); crest(b, 5, 2.0, 12, 12); b.hill(12, 0);
  return b.ai(165).flat(12, -0.10).flat(4);
});

defTrack('switchback', { name: 'Switchback', div: 2, hint: 'A rollercoaster of sharp crests and bends, then a broken stretch of three hops. Ease off over each crest.' }, b => {
  b.ai(160).flat(16);
  b.ai(130).hill(12, 6); crest(b, 6, 2.2, 14, 14); b.hill(12, 0, 0.12);
  b.ai(125).hill(20, 20); crest(b, 20, 2.4, 16, 16); b.hill(20, 2, -0.10);
  b.ai(130).hill(12, 8); crest(b, 8, 2.2, 14, 14); b.hill(12, 0, 0.12);
  b.ai(160).flat(20, -0.14).flat(10);
  b.ai(150).flat(10).ai(125); hops(b, 0, 3);
  b.ai(160).flat(10);
  return b.ai(165).flat(18, -0.10).flat(16);
});

// ---- Division 1 ----
defTrack('liftbridge', { name: 'Lift Bridge', div: 1, hint: 'A lift bridge rises and falls. Cross while it is down: a raised leaf is a wall.' }, b => {
  b.ai(165).flat(26).flat(18, 0.12).flat(8);
  b.ai(160).flat(14, -0.14).flat(6);
  b.ai(140).flat(34).lift(12).flat(14);
  b.ai(130).hill(12, 8); crest(b, 8, 2.2, 14, 14); b.hill(12, 0);
  b.ai(160).flat(16, 0.10).flat(10);
  b.ai(130).hill(12, 6); crest(b, 6, 2.2, 14, 14); b.hill(10, 0);
  b.ai(140).hill(18, 13).hill(18, 0);
  return b.ai(165).flat(12, -0.10).flat(4);
});

defTrack('launchpad', { name: 'Launch Pad', div: 1, hint: 'The giant jump. Boost past 200 mph down the straight or you will not reach the landing.' }, b => {
  b.ai(170).flat(8).flat(14, -0.12).flat(4);
  b.ai(130).hill(14, 8); crest(b, 8, 2.2, 14, 14); b.hill(12, 0);
  b.ai(160).flat(12, 0.14).flat(4);
  b.ai(175).hill(20, 22);
  b.ai(180).flat(28).ai(208).flat(40);
  jump(b, 22, 16, 2.8, 7, 26.7, 60, 0);
  b.ai(160).flat(12, 0.14).flat(4);
  b.ai(130).hill(12, 6); crest(b, 6, 2.2, 14, 14); b.hill(10, 0);
  return b.ai(165).flat(8, -0.10).flat(4);
});

const DIVISION_TRACKS = {
  4: ['kicker', 'camel'],
  3: ['islands', 'longramp'],
  2: ['canyon', 'switchback'],
  1: ['liftbridge', 'launchpad'],
};
