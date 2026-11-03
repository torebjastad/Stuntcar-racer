'use strict';

// AI driver: returns an input object for Physics.step. Pure (no DOM).
// Speed plan: each segment carries a target mph (seg.ai). The AI looks ahead
// and brakes early enough to meet lower targets. Targets ≥ 180 mph are
// "must hit" jump speeds and are not scaled down by skill.
const AI = (() => {
  const C = CFG;
  const PLAN_DECEL = 14;   // braking used when planning (m/s²)
  const LOOK = 70;         // segments of lookahead (350 m)

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  function controls(car, opp, trk, t, skill) {
    skill = skill || 1;
    const S = C.SEG_LEN, n = trk.segs.length;
    const zz = Track.wrap(trk, car.z);
    const i0 = Math.floor(zz / S);
    const into = zz - i0 * S;
    const sp = Math.max(0, car.speed);

    let target = Infinity, critical = false, liftAt = -1, featureNear = false;
    for (let k = 0; k < LOOK; k++) {
      const seg = trk.segs[(i0 + k) % n];
      const d = Math.max(0, k * S - into);
      const v = seg.ai / C.MPH;
      const allowed = Math.sqrt(v * v + 2 * PLAN_DECEL * d);
      if (allowed < target) { target = allowed; critical = seg.ai >= 180; }
      if (seg.lift && liftAt < 0) liftAt = d;
      if ((seg.gap || seg.ai >= 180) && d < 90) featureNear = true;
    }
    if (!critical) target *= skill;

    // Mild rubber band so races stay close
    if (opp && !critical) {
      const L = trk.len;
      const lead = (car.z - car.startZ) - (opp.z - opp.startZ);
      if (lead < -60) target *= 1.04;
      else if (lead > 80) target *= 0.97;
    }

    // Lift bridge: wait for it to be (and stay) down while we cross
    if (liftAt >= 0 && liftAt < 170) {
      const tArr = liftAt / Math.max(sp, 18);
      const a = Math.max(Track.liftAngle(t + tArr), Track.liftAngle(t + tArr + 0.9));
      if (a > 0.06) target = Math.min(target, Math.sqrt(2 * PLAN_DECEL * Math.max(0, liftAt - 15)));
    }

    const inp = { accel: false, brake: false, boost: false, steer: 0 };
    if (car.state === 'ground') {
      if (sp < target - 0.5) inp.accel = true;
      if (sp > target + 2.5) inp.brake = true;
      if (target > C.VMAX * car.power * 0.97 && sp < target - 1 && car.boost > 0) inp.boost = true;
    }

    // Steering: hold a lane, overtake slower cars, centre up for jumps
    let lane = car.lane !== undefined ? car.lane : 0;
    if (opp && (opp.state === 'ground' || opp.state === 'air')) {
      const L = trk.len;
      const dz = ((opp.z - car.z) % L + L * 1.5) % L - L / 2;
      if (dz > 0 && dz < 35 && sp > opp.speed + 0.5 && Math.abs(opp.x - lane) < 2.8) {
        lane = opp.x > 0 ? opp.x - 3.2 : opp.x + 3.2;
      }
    }
    if (featureNear) lane *= 0.3;
    lane = clamp(lane, -C.ROAD_W + 1.6, C.ROAD_W - 1.6);

    const seg = trk.segs[i0];
    const drift = -seg.curve * sp * sp * C.CENTRIFUGAL;
    const want = clamp((lane - car.x) * 1.3, -5, 5);
    const k = (C.STEER_BASE + sp * C.STEER_K) * Math.min(1, sp / 6);
    inp.steer = k > 0.1 ? clamp((want - drift) / k, -1, 1) : 0;
    return inp;
  }

  return { controls };
})();
