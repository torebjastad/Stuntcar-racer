'use strict';

const CFG = {
  // Rendering
  SEGMENT_LENGTH: 200,   // world units per segment
  ROAD_WIDTH: 2800,      // world units (half-width used in projection)
  DRAW_DISTANCE: 220,    // segments to render ahead
  CAMERA_HEIGHT: 1100,   // nominal camera height above track
  CAMERA_DEPTH: 0.84,    // 1/tan(50deg) ≈ FOV 100deg

  // Speed & physics
  MAX_SPEED: 280,        // world units/sec at 250 mph
  ACCEL: 55,             // throttle acceleration (wu/s²)
  DECEL: 18,             // natural deceleration / drag
  BRAKE: 130,            // braking deceleration
  BOOST_ACCEL: 90,       // extra acceleration when boosting
  OFFROAD_DECEL: 70,     // extra decel when off track surface
  CENTRIFUGAL: 0.3,      // lateral drift on curves
  GRAVITY: 1400,         // world units/sec² (vertical)
  BOUNCE_DAMPING: 0.45,  // suspension rebound (0=rigid, 1=rubber)
  SUSPENSION_K: 0.18,    // spring stiffness

  // Speed to MPH conversion: 250mph ≈ MAX_SPEED world units/s
  MPH_SCALE: 250 / 280,

  // Boost
  MAX_BOOST: 100,
  BOOST_DRAIN: 25,       // units/sec while boosting

  // Damage
  IMPACT_CRACK_SCALE: 0.0008,  // crack per (wu/s) impact
  IMPACT_HOLE_THRESHOLD: 400,  // impact velocity that creates a hole
  CRACK_THROUGH_HOLE_MULT: 2.2, // crack rate multiplier through holes
  FALL_DAMAGE: 0.6,       // instant crack for falling off track

  // AI
  AI_SPEED_FACTOR: 0.88,  // fraction of player's max speed AI targets
  AI_RUBBER_BAND: 0.06,   // extra AI speed factor when behind

  // Race
  LAPS: 3,

  // Colours
  SKY_TOP: '#0d0d1a',
  SKY_HORIZON: '#1a1a33',
  VOID_COLOR: '#080808',
  TRACK_LIGHT: '#888888',
  TRACK_DARK: '#777777',
  TRACK_EDGE: '#ffffff',
  TRACK_STRIPE: '#cccccc',
  DIRT_COLOR: '#5a3a1a',
  RUMBLE_RED: '#cc2222',
  RUMBLE_WHITE: '#eeeeee',
};
