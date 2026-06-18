'use strict';

// AI driver: simple look-ahead speed control + rubber banding
const AI = (() => {

  // Per-track recommended speeds (index into track, mph target)
  // Falls back to a default curve-aware speed if not specified
  const TRACK_PROFILES = {
    littleRamp:     { defaultSpeed: 160, humpSpeed: 130, rampBoostAt: 140 },
    humpBack:       { defaultSpeed: 120, humpSpeed: 110 },
    steppingStones: { defaultSpeed: 155, gapSpeed: 155 },
    bigRamp:        { defaultSpeed: 170, bigRampBoostAt: 190 },
    highJump:       { defaultSpeed: 200, jumpBoostAt: 180 },
    rollercoaster:  { defaultSpeed: 150, crestMaxSpeed: 155 },
    drawbridge:     { defaultSpeed: 145, bridgeSpeed: 140 },
    skiJump:        { defaultSpeed: 190, jumpBoostAt: 185 },
  };

  function createAI(trackId) {
    return {
      profile: TRACK_PROFILES[trackId] || { defaultSpeed: 160 },
      boostUsed: 0,
    };
  }

  function update(aiCar, playerCar, track, aiState, dt) {
    if (aiCar.finished || aiCar.destroyed) return;

    const tLen    = track.length;
    const segIdx  = Math.floor(aiCar.trackPos % tLen);
    const profile = aiState.profile;

    // Look ahead for obstacles (gaps, ramps)
    let lookAheadPitch = 0;
    let hasGapAhead    = false;
    let hasDrawAhead   = false;
    for (let i = 0; i < 15; i++) {
      const s = track[(segIdx + i) % tLen];
      lookAheadPitch += s.pitch;
      if (s.noRoad) hasGapAhead = true;
      if (s.isDraw) hasDrawAhead = true;
    }

    // Target speed (mph → world units/s)
    let targetMph = profile.defaultSpeed;

    // Slow for downhill (avoid overshoot)
    if (lookAheadPitch < -5) targetMph *= 0.85;

    // Boost approaching a big ramp or jump
    const needsBoost = (hasGapAhead || lookAheadPitch > 8) &&
                       aiCar.speed * CFG.MPH_SCALE < (profile.jumpBoostAt || profile.bigRampBoostAt || 190);

    // Bridge: time carefully
    if (hasDrawAhead) {
      targetMph = Math.min(targetMph, (profile.bridgeSpeed || 140));
    }

    const targetSpeed = targetMph / CFG.MPH_SCALE;

    // Rubber-band to keep race close
    const gap = aiCar.trackPos - playerCar.trackPos;
    let rubberFactor = 1;
    if (gap < -10) rubberFactor = 1 + CFG.AI_RUBBER_BAND;       // AI behind → faster
    if (gap > 15)  rubberFactor = 1 - CFG.AI_RUBBER_BAND * 0.5; // AI ahead → slightly slower

    const adjustedTarget = targetSpeed * CFG.AI_SPEED_FACTOR * rubberFactor;

    // Throttle / brake decision
    const inp = {
      accel: aiCar.speed < adjustedTarget,
      brake: aiCar.speed > adjustedTarget * 1.08,
      boost: needsBoost && aiCar.boost > 5,
      left:  false,
      right: false,
    };

    // Steering: return to lane centre + avoid edges
    const seg = track[segIdx];
    const steerCorrect = -aiCar.laneOffset * 0.7;
    const steerCurve   = -seg.curve * 3;  // counter the curve centrifugal
    const totalSteer   = Math.max(-1, Math.min(1, steerCorrect + steerCurve));

    if (totalSteer < -0.1) inp.left  = true;
    if (totalSteer > 0.1)  inp.right = true;
    if (Math.abs(totalSteer) <= 0.1) { inp.left = false; inp.right = false; }

    // Run same physics as player
    Physics.update(aiCar, inp, track, dt);
  }

  return { createAI, update };
})();
