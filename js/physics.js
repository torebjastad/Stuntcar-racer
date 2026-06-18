'use strict';

const Physics = (() => {

  function createCar(isAI) {
    return {
      trackPos:   0,       // float segment index
      laneOffset: 0,       // -1 (left) to +1 (right)
      speed:      0,       // world units / second
      yPos:       0,       // height above road surface (0 = on road)
      yVel:       0,       // vertical velocity
      pitch:      0,       // visual pitch angle (rad)
      roll:       0,       // visual roll (not yet used in render)
      steer:      0,       // current steer value (-1..1, smoothed)
      steerTarget:0,
      boost:      CFG.MAX_BOOST,
      boostActive:false,
      crack:      0,       // 0..1 (1 = destroyed)
      holes:      [],      // array of 0..1 positions (permanent)
      lap:        1,
      lapStartTime: 0,
      bestLap:    null,
      lapTimes:   [],
      finished:   false,
      destroyed:  false,
      isAI:       !!isAI,
    };
  }

  function resetForRace(car, seasonHoles) {
    car.trackPos    = car.isAI ? -8 : 0;  // AI starts behind
    car.laneOffset  = car.isAI ? 0.25 : 0;
    car.speed       = 0;
    car.yPos        = 0;
    car.yVel        = 0;
    car.pitch       = 0;
    car.steer       = 0;
    car.steerTarget = 0;
    car.boost       = CFG.MAX_BOOST;
    car.boostActive = false;
    car.crack       = 0;
    car.holes       = seasonHoles ? seasonHoles.map(h => h) : [];
    car.lap         = 1;
    car.lapStartTime= 0;
    car.bestLap     = null;
    car.lapTimes    = [];
    car.finished    = false;
    car.destroyed   = false;
  }

  function update(car, input, track, dt) {
    if (car.finished || car.destroyed) return;

    const tLen = track.length;

    // ---- STEERING ----
    if (input.left)  car.steerTarget = -1;
    else if (input.right) car.steerTarget = 1;
    else car.steerTarget = 0;
    // Smooth steering (feels better on mobile)
    car.steer += (car.steerTarget - car.steer) * (input.left || input.right ? 0.20 : 0.12);

    // ---- BOOST ----
    car.boostActive = input.boost && car.boost > 0;
    if (car.boostActive) {
      car.boost = Math.max(0, car.boost - CFG.BOOST_DRAIN * dt);
    }

    // ---- LONGITUDINAL SPEED ----
    const onGround = car.yPos <= 0.1;
    const segIdx   = Math.floor(car.trackPos) % tLen;
    const seg      = track[((segIdx % tLen) + tLen) % tLen];

    if (onGround) {
      if (input.accel || input.boost) {
        const baseAccel = CFG.ACCEL + (car.boostActive ? CFG.BOOST_ACCEL : 0);
        car.speed += baseAccel * dt;
      }
      if (input.brake) {
        car.speed -= CFG.BRAKE * dt;
      }
      // Drag / natural decel
      car.speed -= CFG.DECEL * dt * (car.speed / CFG.MAX_SPEED + 0.1);

      // Off-road penalty
      if (Math.abs(car.laneOffset) > 0.9) {
        car.speed -= CFG.OFFROAD_DECEL * dt;
      }

      // Slope resistance
      car.speed -= seg.pitch * 0.3 * car.speed * dt;
    } else {
      // Airborne: drag only
      car.speed -= CFG.DECEL * 0.3 * dt;
    }
    car.speed = Math.max(0, Math.min(CFG.MAX_SPEED * (car.boostActive ? 1.18 : 1), car.speed));

    // ---- LATERAL (STEERING) ----
    if (onGround) {
      const turnRate = CFG.CENTRIFUGAL * (1 - car.speed / CFG.MAX_SPEED * 0.6);
      car.laneOffset += car.steer * turnRate * dt * Math.min(car.speed / 50, 1);
      // Curve pushes car outward
      car.laneOffset += seg.curve * car.speed * 0.0003 * dt;
      car.laneOffset  = Math.max(-1.1, Math.min(1.1, car.laneOffset));
    }

    // ---- VERTICAL (BOUNCE / AIRBORNE) ----
    // Simple model: track pitch causes impulse when going up/over crests
    const pitchDelta = seg.pitch;
    if (onGround) {
      // Launch off crest: positive pitch ahead while going fast
      const nextSeg = track[((segIdx + 3) % tLen + tLen) % tLen];
      const launchImpulse = -nextSeg.pitch * car.speed * 0.004;
      if (launchImpulse > 0) {
        car.yVel += launchImpulse * dt * 60;
      }
    }

    // Gravity always applies
    car.yVel -= CFG.GRAVITY * dt;
    car.yPos += car.yVel * dt;

    // Ground constraint
    if (car.yPos < 0) {
      const impactVel = -car.yVel;
      car.yPos = 0;
      car.yVel = 0;
      if (impactVel > 60) {
        applyImpact(car, impactVel);
        // Bounce (small rebound)
        car.yVel = impactVel * 0.08;
      }
    }

    // ---- ADVANCE TRACK POSITION ----
    car.trackPos += (car.speed * dt) / CFG.SEGMENT_LENGTH;

    // ---- FALL OFF TRACK ----
    if (seg.noRoad || Math.abs(car.laneOffset) > 1.08) {
      // Falling off
      applyImpact(car, 500);
      car.laneOffset = Math.sign(car.laneOffset) * 0.5;
      car.speed *= 0.3;
    }

    // ---- DRAWBRIDGE COLLISION ----
    if (seg.isDraw && Renderer.bridgeAngle > 0.3) {
      // Hit the raised bridge
      car.speed = 0;
      applyImpact(car, 250);
    }

    // ---- LAP TRACKING ----
    const lapLen = track.length;
    if (car.trackPos >= lapLen * car.lap) {
      const now = Date.now();
      const lapTime = now - car.lapStartTime;
      car.lapTimes.push(lapTime);
      if (!car.bestLap || lapTime < car.bestLap) car.bestLap = lapTime;
      car.lapStartTime = now;
      car.lap++;
      if (car.lap > CFG.LAPS) {
        car.finished = true;
        car.lap = CFG.LAPS;
      }
    }

    // Visual pitch from speed over crests
    const targetPitch = -seg.pitch * 0.04;
    car.pitch += (targetPitch - car.pitch) * 0.1;
  }

  function applyImpact(car, vel) {
    if (vel < 30) return;

    // Crack advance (faster if passing through existing holes)
    let holeMult = 1;
    for (const h of car.holes) {
      if (h > car.crack) holeMult += 0.5;
    }
    car.crack += (vel - 30) * CFG.IMPACT_CRACK_SCALE * holeMult;
    car.crack = Math.min(1, car.crack);

    // Permanent hole on very hard impact
    if (vel > CFG.IMPACT_HOLE_THRESHOLD) {
      car.holes.push(Math.min(0.95, car.crack + 0.05));
      car.holes.sort((a, b) => a - b);
    }

    if (car.crack >= 1) {
      car.destroyed = true;
    }
  }

  return { createCar, resetForRace, update, applyImpact };
})();
