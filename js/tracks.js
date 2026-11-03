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

// ---- Division 4 ----
defTrack('kicker', { name: 'Kicker Loop', div: 4, hint: 'One hump, one jump. Hit the kicker fast enough to clear the gap.' }, b => b
  .ai(165).flat(30).flat(22, 0.10).flat(18)
  .ai(140).hill(16, 5).hill(16, 0)
  .ai(160).flat(26, -0.10).flat(20)
  .ai(170).ramp(18, 5).gap(5).at(3).land(14, 0)
  .ai(160).flat(30, 0.12).flat(30).flat(26, -0.08).flat(24)
);

defTrack('camel', { name: 'Camel Hills', div: 4, hint: 'Rolling humps. Too fast over the big crests and you fly — and land hard.' }, b => b
  .ai(165).flat(30)
  .ai(150).hill(14, 4).hill(14, 0).flat(15)
  .ai(125).hill(18, 8).hill(18, 0)
  .ai(160).flat(25, 0.12).flat(20)
  .ai(150).hill(14, 4).hill(14, 0)
  .ai(160).flat(15, -0.10).flat(30)
  .ai(120).hill(20, 10).hill(20, 0)
  .ai(165).flat(30, 0.10).flat(30)
);

// ---- Division 3 ----
defTrack('islands', { name: 'Island Hop', div: 3, hint: 'Short platforms with gaps. Find one steady speed and hold it.' }, b => {
  b.ai(160).flat(30).flat(20, 0.10).flat(15).ai(140);
  for (let k = 0; k < 5; k++) b.flat(5).ramp(3, 0.8).gap(3).at(0);
  b.ai(160).flat(25, -0.12).flat(25).flat(20, 0.10).flat(20);
  b.ai(140);
  for (let k = 0; k < 4; k++) b.flat(5).ramp(3, 0.8).gap(3).at(0);
  return b.ai(160).flat(25, -0.08).flat(25);
});

defTrack('longramp', { name: 'Long Ramp', div: 3, hint: 'Two small kickers, then the big one. Commit to full boost for the long gap.' }, b => b
  .ai(165).flat(25)
  .ai(165).ramp(10, 2.5).gap(4).at(1.5).land(8, 0).flat(14)
  .ai(175).ramp(10, 3).gap(5).at(1.5).land(8, 0)
  .ai(175).flat(20, 0.10).flat(20)
  .ai(230).flat(30).ramp(24, 10).gap(12).at(6).land(20, 0)
  .ai(160).flat(25, -0.12).flat(30).flat(25, 0.10).flat(20)
);

// ---- Division 2 ----
defTrack('canyon', { name: 'The Canyon', div: 2, hint: 'One huge chasm. You need 200+ mph at the lip — boost from the last bend.' }, b => b
  .ai(170).flat(25).flat(25, 0.12).flat(20)
  .ai(235).flat(40).ramp(16, 6).gap(20).at(2).land(18, 0)
  .ai(160).flat(25, -0.14).flat(25).flat(20, 0.10)
  .ai(150).hill(16, 6).hill(16, 0)
  .ai(165).flat(30, -0.08).flat(30)
);

defTrack('switchback', { name: 'Switchback', div: 2, hint: 'A rollercoaster of crests and bends. Ease off over the big hill.' }, b => b
  .ai(160).flat(20)
  .ai(140).hill(14, 6).hill(14, 0, 0.12)
  .ai(120).hill(22, 14).hill(22, 2, -0.10)
  .ai(140).hill(14, 8).hill(14, 0, 0.12)
  .ai(160).flat(25, -0.14).flat(20)
  .ai(135).hill(16, 7).hill(16, 0)
  .ai(140).hill(12, 5, 0.10).hill(12, 0)
  .ai(165).flat(30, -0.10).flat(30)
);

// ---- Division 1 ----
defTrack('liftbridge', { name: 'Lift Bridge', div: 1, hint: 'The bridge rises and falls. Time your run — a raised leaf is a launch ramp.' }, b => b
  .ai(165).flat(30).flat(25, 0.12).flat(20)
  .ai(140).flat(20).lift(10).flat(15)
  .ai(155).hill(16, 6).hill(16, 0)
  .ai(160).flat(25, -0.14).flat(25)
  .ai(140).flat(20).lift(10).flat(15)
  .ai(165).flat(25, 0.10).flat(30)
);

defTrack('launchpad', { name: 'Launch Pad', div: 1, hint: 'The giant jump. Over 200 mph or you will not make the landing.' }, b => b
  .ai(170).flat(25).flat(25, -0.12).flat(20)
  .ai(240).flat(45).ramp(26, 14).gap(18).at(9).land(30, 0)
  .ai(160).flat(25, 0.14).flat(25)
  .ai(150).hill(14, 5).hill(14, 0)
  .ai(165).flat(25, -0.10).flat(30)
);

const DIVISION_TRACKS = {
  4: ['kicker', 'camel'],
  3: ['islands', 'longramp'],
  2: ['canyon', 'switchback'],
  1: ['liftbridge', 'launchpad'],
};
