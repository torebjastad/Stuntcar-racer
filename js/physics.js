'use strict';

// Car physics: pure functions of (car, input, track, time). No DOM access.
//
// States: ground → air (crest/ramp/gap) → ground (landing, may damage)
//         air below road level → falling → crash on the ground → respawn
//         crack reaches 1 → wrecked
const Physics = (() => {
  const C = CFG;

  function createCar(opts) {
    const c = {
      z: 0, x: 0, y: 0, vy: 0, vx: 0, speed: 0,
      state: 'ground', timer: 0,
      steer: 0,
      boost: C.BOOST_MAX, boosting: false,
      crack: 0, holes: [], wrecked: false,
      power: 1,
      pitch: 0, roll: 0, shake: 0,
      startZ: 0, lapsDone: 0, lapTimes: [], lapStart: 0, bestLap: null,
      falls: 0, maxImpact: 0, airTime: 0, fallZ: 0,
    };
    Object.assign(c, opts || {});
    c.holes = (c.holes || []).slice();
    c.startZ = c.z;
    return c;
  }

  // ---- Damage ------------------------------------------------------------
  function advanceCrack(c, amt) {
    let left = amt;
    while (left > 0 && c.crack < 1) {
      const inHole = c.holes.some(h => c.crack >= h && c.crack < h + C.HOLE_W);
      const s = Math.min(left, 0.004);
      c.crack += s * (inHole ? C.HOLE_MULT : 1);
      left -= s;
    }
    if (c.crack >= 1) { c.crack = 1; c.wrecked = true; c.state = 'wrecked'; }
  }

  // Holes stack from the right edge of the chassis bar leftwards
  function addHole(c) {
    if (c.holes.length >= 8) return;
    c.holes.push(1 - C.HOLE_W * 1.5 * (c.holes.length + 1));
    c.holes.sort((a, b) => a - b);
  }

  function impact(c, v, ev) {
    if (v > c.maxImpact) c.maxImpact = v;
    c.shake = Math.min(1, c.shake + v / 22);
    if (v <= C.LAND_SAFE) {
      if (v > 2.5 && ev) ev('bump', c, 0.25 * v / C.LAND_SAFE);
      return;
    }
    advanceCrack(c, (v - C.LAND_SAFE) * C.DMG_K);
    if (v >= C.HOLE_V) addHole(c);
    if (ev) ev('impact', c, Math.min(1, 0.3 + (v - C.LAND_SAFE) / 18));
  }

  // ---- Falling & respawn ---------------------------------------------------
  function startFall(c, ev) {
    c.state = 'falling';
    c.timer = 1.8;
    c.falls++;
    c.fallZ = c.z;
    if (ev) ev('fall', c, 1);
  }

  // First position at/after z with 4 consecutive solid, non-lift segments
  function respawnPoint(trk, z) {
    const S = C.SEG_LEN, n = trk.segs.length;
    const zz = Track.wrap(trk, z), i = Math.floor(zz / S);
    const base = z - (zz - i * S);
    for (let k = 0; k < n; k++) {
      let ok = true;
      for (let j = 0; j < 4; j++) {
        const s = trk.segs[(i + k + j) % n];
        if (s.gap || s.lift) { ok = false; break; }
      }
      if (ok) return k === 0 ? z : base + k * S + S * 0.5;
    }
    return z;
  }

  function endFall(c, trk, t, ev) {
    advanceCrack(c, C.FALL_DMG);
    addHole(c);
    if (ev) ev('crash', c, 1);
    if (c.wrecked) return;
    c.z = respawnPoint(trk, c.fallZ);
    const g = Track.ground(trk, c.z, t);
    c.x = 0; c.y = g.h; c.vy = 0; c.vx = 0; c.speed = 0;
    c.steer = 0; c.pitch = 0; c.roll = 0;
    c.state = 'respawn';
    c.timer = C.RESPAWN_T;
    if (ev) ev('respawn', c, 0);
  }

  // ---- Main step -----------------------------------------------------------
  function step(c, inp, trk, t, dt, ev) {
    c.shake = Math.max(0, c.shake - dt * 2.5);

    if (c.state === 'respawn') {
      c.timer -= dt;
      c.speed = 0;
      if (c.timer <= 0) c.state = 'ground';
      return;
    }
    if (c.state === 'falling') {
      c.vy -= C.GRAVITY * dt;
      c.y += c.vy * dt;
      // can't fly forward through the face of the next platform
      const ahead = Track.ground(trk, c.z + c.speed * dt + C.CAR_LEN / 2, t);
      if (ahead.solid && c.y < ahead.h && c.y > ahead.h - C.THICK - 3) c.speed = 0;
      c.z += c.speed * dt;
      c.x += c.vx * dt;
      c.speed *= 1 - dt * 0.4;
      c.pitch += (-0.7 - c.pitch) * Math.min(1, dt * 1.5);
      c.timer -= dt;
      if (c.y <= C.GROUND_Y + 0.6 || c.timer <= 0) endFall(c, trk, t, ev);
      return;
    }
    if (c.state === 'wrecked') {
      c.speed = Math.max(0, c.speed - 30 * dt);
      c.z += c.speed * dt;
      const g = Track.ground(trk, c.z, t);
      if (g.solid) c.y = g.h;
      return;
    }

    const onGround = c.state === 'ground';

    // Steering (digital input is smoothed; AI may pass analogue inp.steer)
    const st = inp.steer !== undefined ? inp.steer : (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    c.steer += (st - c.steer) * Math.min(1, dt * (st === 0 ? 9 : 6));

    // Boost (only drains while held)
    c.boosting = !!inp.boost && c.boost > 0;
    if (c.boosting) c.boost = Math.max(0, c.boost - C.BOOST_DRAIN * dt);

    const g0 = Track.ground(trk, c.z, t);

    if (onGround) {
      const vmax = (c.boosting ? C.VMAX_BOOST : C.VMAX) * c.power;
      const sp = c.speed, sgn = Math.sign(sp);
      let a = 0;
      if (inp.accel || c.boosting) {
        const r = Math.max(0, sp) / vmax;
        a += (C.ACC + (c.boosting ? C.ACC_BOOST : 0)) * c.power * Math.max(0, 1 - r * r);
      }
      if (inp.brake && sp > 0) a -= Math.min(C.BRAKE, sp / dt);
      a -= sgn * (C.DRAG * (sp / C.VMAX) * (sp / C.VMAX) + C.ROLL);
      const slope = g0.solid ? g0.slope : 0;
      a -= C.GRAVITY * C.SLOPE_K * slope / Math.sqrt(1 + slope * slope);
      let ns = sp + a * dt;
      if (sgn !== 0 && Math.sign(ns) !== sgn && Math.abs(slope) < 0.02) ns = 0;
      c.speed = Math.max(-12, Math.min(C.VMAX_BOOST * c.power * 1.02, ns));

      // Lateral: steering + centrifugal drift on curves
      const spd = Math.max(0, c.speed);
      const steerV = c.steer * (C.STEER_BASE + spd * C.STEER_K) * Math.min(1, spd / 6);
      const drift = -g0.seg.curve * spd * spd * C.CENTRIFUGAL;
      c.vx = steerV + drift;
      c.x += c.vx * dt;
    } else {
      c.speed -= C.AIR_DRAG * dt * Math.sign(c.speed);
      c.x += c.vx * dt;
      c.airTime += dt;
    }

    // Advance and resolve vertical motion against the new ground
    const prevY = c.y, prevVy = c.vy;
    c.z += c.speed * dt;
    const g1 = Track.ground(trk, c.z, t);
    const support = g1.solid && Math.abs(c.x) <= C.ROAD_W + 0.4;

    if (onGround) {
      const yFree = prevY + prevVy * dt - 0.5 * C.GRAVITY * dt * dt;
      if (!support || yFree > g1.h + 0.03) {
        // Ground fell away faster than gravity (crest, lip, gap, edge): airborne
        c.state = 'air';
        c.y = yFree;
        c.vy = prevVy - C.GRAVITY * dt;
      } else if (g1.slope > C.MAX_CLIMB && c.speed > 0) {
        // Too steep to climb: it's a wall
        impact(c, Math.max(C.LAND_SAFE + 4, c.speed * 0.5), ev);
        c.z -= c.speed * dt;
        c.speed = 0;
      } else {
        const vyG = c.speed * g1.slope;
        const jolt = vyG - prevVy;            // ground pushing the car up abruptly
        if (jolt > C.LAND_SAFE * 0.6) impact(c, jolt, ev);
        c.y = g1.h;
        c.vy = vyG;
      }
    } else {
      c.vy -= C.GRAVITY * dt;
      c.y += c.vy * dt;
      if (support && c.y <= g1.h) {
        const depth = g1.h - c.y;
        const allowed = C.EDGE_CLIP + (Math.abs(c.vy) + Math.abs(c.speed * g1.slope)) * dt * 2;
        if (depth > allowed) {
          // Arrived below the surface: slammed into the edge of the platform
          impact(c, Math.max(C.LAND_SAFE + 6, c.speed * 0.35), ev);
          c.z -= 1.0;
          c.speed = 0;
          c.vx = 0;
          if (!c.wrecked) startFall(c, ev);
        } else {
          const vyG = c.speed * g1.slope;
          const v = (vyG - c.vy) / Math.sqrt(1 + g1.slope * g1.slope); // normal impact speed
          c.y = g1.h;
          c.vy = vyG;
          c.state = 'ground';
          c.airTime = 0;
          if (ev) ev('land', c, v);
          impact(c, v, ev);
        }
      } else if (c.y < g1.h - C.FALL_DEPTH) {
        startFall(c, ev);
      }
    }

    // Visual attitude (used by the renderer for camera pitch/roll)
    if (c.state === 'ground') {
      const tp = Math.atan(g1.solid ? g1.slope : 0);
      c.pitch += (tp - c.pitch) * Math.min(1, dt * 10);
    } else if (c.state === 'air') {
      const tp = Math.atan2(c.vy, Math.max(15, Math.abs(c.speed))) * 0.7;
      c.pitch += (tp - c.pitch) * Math.min(1, dt * 1.8);
    }
    const tr = c.state === 'ground' ? c.steer * Math.min(1, Math.max(0, c.speed) / 60) * 0.06 : c.roll;
    c.roll += (tr - c.roll) * Math.min(1, dt * 5);
  }

  // ---- Car-to-car contact ----------------------------------------------------
  function active(c) { return c.state === 'ground' || c.state === 'air'; }

  function collide(a, b, trk, ev) {
    if (!active(a) || !active(b)) return;
    const L = trk.len;
    const dz = ((b.z - a.z) % L + L * 1.5) % L - L / 2;
    const dx = b.x - a.x;
    if (Math.abs(dz) >= C.CAR_LEN || Math.abs(dx) >= C.CAR_W || Math.abs(b.y - a.y) > 1.5) return;
    const ovZ = C.CAR_LEN - Math.abs(dz), ovX = C.CAR_W - Math.abs(dx);
    if (ovX < ovZ * 0.6) {
      // Side swipe: push apart laterally
      const s = dx >= 0 ? 1 : -1;
      a.x -= s * ovX / 2; b.x += s * ovX / 2;
      const rv = Math.abs(a.vx - b.vx);
      a.vx = -s * 2; b.vx = s * 2;
      impact(a, rv * 0.5, ev); impact(b, rv * 0.5, ev);
    } else {
      const front = dz > 0 ? b : a, rear = dz > 0 ? a : b;
      const rel = rear.speed - front.speed;
      if (rel > 0) {
        rear.speed -= rel * 0.7;
        front.speed += rel * 0.5;
        impact(rear, rel * 0.45, ev);
        impact(front, rel * 0.45, ev);
      }
      rear.z -= ovZ;
    }
  }

  return { createCar, step, collide, respawnPoint, impact };
})();
