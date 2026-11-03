'use strict';

// All world units are metres / seconds.
const CFG = {
  // --- Track geometry ---
  SEG_LEN: 5,          // metres per track segment
  ROAD_W: 6,           // road half-width (m)
  THICK: 1.6,          // track slab thickness (m)
  GROUND_Y: -28,       // ground plane height (tracks are elevated above it)

  // --- Camera / rendering ---
  DRAW_SEGS: 190,      // segments drawn ahead (~950 m)
  CAM_H: 1.35,         // eye height above car base (m)
  FOV: 82,             // horizontal field of view (deg)
  NEAR: 0.6,           // near clip distance (m)
  HORIZON: 0.42,       // horizon position as fraction of screen height (level car)

  // --- Car ---
  VMAX: 86,            // top speed without boost (m/s ≈ 192 mph)
  VMAX_BOOST: 108,     // top speed with boost (m/s ≈ 242 mph)
  ACC: 15,             // engine acceleration at standstill (m/s²)
  ACC_BOOST: 13,       // extra acceleration while boosting
  BRAKE: 32,
  DRAG: 2.5,           // aero drag at VMAX (m/s²), scales with v²
  ROLL: 0.6,           // rolling resistance (m/s²)
  AIR_DRAG: 1.0,
  SLOPE_K: 0.85,       // fraction of gravity felt along slopes
  STEER_BASE: 3.0,     // lateral speed at full lock (m/s) ...
  STEER_K: 0.085,      // ... plus this × forward speed
  CENTRIFUGAL: 0.006,  // lateral drift = curve × v² × this
  MAX_CLIMB: 1.15,     // ground slope (rise/run) that acts as a wall
  CAR_LEN: 4.2,
  CAR_W: 2.0,
  GRAVITY: 17,         // stylised gravity (m/s²)
  MPH: 2.237,          // m/s → mph

  // --- Boost ---
  BOOST_MAX: 100,
  BOOST_DRAIN: 9,      // units per second (≈11 s of boost per race)

  // --- Damage ---
  LAND_SAFE: 6.5,      // impact speed (m/s) absorbed by suspension
  DMG_K: 0.018,        // crack advance per m/s over LAND_SAFE
  HOLE_V: 16,          // impact speed that punches a permanent hole
  HOLE_W: 0.055,       // hole width on the chassis bar (fraction)
  HOLE_MULT: 2.5,      // crack grows this much faster through a hole
  FALL_DMG: 0.28,      // crack added when the car falls off the track
  FALL_DEPTH: 2.5,     // metres below road level → falling
  EDGE_CLIP: 0.6,      // arriving this far below a surface = hitting its edge
  RESPAWN_T: 1.4,      // crane delay before the car can drive again

  // --- Race ---
  LAPS: 3,
  COUNTDOWN: 3,
};
