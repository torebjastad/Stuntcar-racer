'use strict';

// Track segment: { curve, pitch, noRoad, isDraw, color }
// curve: lateral bend per segment (-ve=left, +ve=right)
// pitch: vertical slope per segment (positive=uphill)
// noRoad: true for stepping-stone gaps
// isDraw: marks drawbridge segment

function seg(curve, pitch, noRoad, isDraw) {
  return { curve: curve || 0, pitch: pitch || 0, noRoad: !!noRoad, isDraw: !!isDraw };
}

// Expand a section definition into individual segments
function section(count, curve, pitch, noRoad, isDraw) {
  const arr = [];
  for (let i = 0; i < count; i++) arr.push(seg(curve, pitch, noRoad, isDraw));
  return arr;
}

function concat(...sections) {
  return [].concat(...sections);
}

// Precompute cumulative positions for a track
function buildTrack(segs) {
  let cx = 0, cy = 0;
  for (const s of segs) {
    s._cx = cx;
    s._cy = cy;
    cx += s.curve;
    cy += s.pitch;
  }
  return segs;
}

// --------------------------------------------------------------------------
// DIVISION 4 — BEGINNER
// --------------------------------------------------------------------------

// THE LITTLE RAMP
// One hump (max 200mph), then a ramp (min 130mph)
const LITTLE_RAMP = buildTrack(concat(
  section(40,  0.00,  0),      // straight approach
  section(8,   0.00,  1.2),    // hump up
  section(8,   0.00, -1.2),    // hump down
  section(20,  0.00,  0),      // flat run-up
  section(5,   0.02,  0),      // gentle right curve
  section(25,  0.00,  0),      // straight pre-ramp
  section(12,  0.00,  3.5),    // ramp up
  section(4,   0.00, -3.5),    // ramp crest/down
  section(15,  0.00, -0.5),    // landing run
  section(10, -0.02,  0),      // left curve
  section(40,  0.00,  0),      // back straight
  section(5,   0.02,  0),      // sweep right
  section(20,  0.00,  0),      // final straight
  // second half of lap repeat (mirror)
  section(40,  0.00,  0),
  section(8,   0.00,  1.2),
  section(8,   0.00, -1.2),
  section(20,  0.00,  0),
  section(5,  -0.02,  0),
  section(25,  0.00,  0),
  section(12,  0.00,  3.5),
  section(4,   0.00, -3.5),
  section(15,  0.00, -0.5),
  section(10,  0.02,  0),
  section(40,  0.00,  0),
  section(5,  -0.02,  0),
  section(20,  0.00,  0),
));

// THE HUMP BACK
// Single large central hump, max 130mph over it
const HUMP_BACK = buildTrack(concat(
  section(30,  0.00,  0),
  section(5,   0.01,  0),
  section(30,  0.00,  0),
  section(10,  0.00,  0.8),    // gentle rise
  section(12,  0.00,  2.5),    // steeper rise
  section(8,   0.00,  4.0),    // crest approach
  section(6,   0.00, -4.0),    // over the top
  section(12,  0.00, -2.5),    // down back
  section(10,  0.00, -0.8),    // levelling
  section(35,  0.00,  0),
  section(5,  -0.01,  0),
  section(25,  0.00,  0),
  // second hump (smaller)
  section(8,   0.00,  1.8),
  section(8,   0.00, -1.8),
  section(30,  0.00,  0),
  section(5,   0.01,  0),
  section(30,  0.00,  0),
  section(10,  0.00,  0.8),
  section(12,  0.00,  2.5),
  section(8,   0.00,  4.0),
  section(6,   0.00, -4.0),
  section(12,  0.00, -2.5),
  section(10,  0.00, -0.8),
  section(35,  0.00,  0),
  section(5,  -0.01,  0),
  section(25,  0.00,  0),
  section(8,   0.00,  1.8),
  section(8,   0.00, -1.8),
  section(20,  0.00,  0),
));

// --------------------------------------------------------------------------
// DIVISION 3 — INTERMEDIATE
// --------------------------------------------------------------------------

// THE STEPPING STONES
// Disconnected platform sections — gaps in between
// Must maintain constant speed for each gap
const STEPPING_STONES = buildTrack(concat(
  section(30,  0.00,  0),       // approach
  section(5,   0.00,  0, true), // GAP 1
  section(18,  0.00,  0),       // stone 1
  section(5,   0.00,  0, true), // GAP 2
  section(18,  0.00,  0),       // stone 2
  section(5,   0.00,  0, true), // GAP 3
  section(18,  0.00,  0),       // stone 3
  section(5,   0.00,  0, true), // GAP 4
  section(18,  0.00,  0),       // stone 4
  section(5,   0.00,  0, true), // GAP 5
  section(18,  0.00,  0),       // stone 5
  section(5,   0.00,  0, true), // GAP 6
  section(30,  0.00,  0),       // exit run
  section(5,  -0.01,  0),
  section(20,  0.00,  0),
  section(5,   0.01,  0),
  // repeat
  section(25,  0.00,  0),
  section(5,   0.00,  0, true),
  section(18,  0.00,  0),
  section(5,   0.00,  0, true),
  section(18,  0.00,  0),
  section(5,   0.00,  0, true),
  section(18,  0.00,  0),
  section(5,   0.00,  0, true),
  section(18,  0.00,  0),
  section(5,   0.00,  0, true),
  section(18,  0.00,  0),
  section(5,   0.00,  0, true),
  section(25,  0.00,  0),
  section(5,   0.01,  0),
  section(15,  0.00,  0),
));

// THE BIG RAMP
// Two small ramps (160-180mph), then enormous main ramp (210+mph)
const BIG_RAMP = buildTrack(concat(
  section(25,  0.00,  0),
  // small ramp 1
  section(8,   0.00,  2.5),
  section(4,   0.00, -2.5),
  section(12,  0.00,  0),
  // small ramp 2
  section(8,   0.00,  3.0),
  section(4,   0.00, -3.0),
  section(15,  0.00,  0),
  section(5,   0.01,  0),
  section(12,  0.00,  0),
  // THE MASSIVE RAMP
  section(5,   0.00,  1.0),    // pre-ramp gentle slope
  section(15,  0.00,  6.5),    // steep ramp face
  section(6,   0.00,  2.0),    // ramp lip
  section(8,   0.00, -2.0),    // descent begins
  section(8,   0.00, -6.5),    // steep landing
  section(10,  0.00, -1.0),    // landing run
  section(5,  -0.01,  0),
  section(30,  0.00,  0),
  section(5,   0.01,  0),
  section(15,  0.00,  0),
  // second pass
  section(25,  0.00,  0),
  section(8,   0.00,  2.5),
  section(4,   0.00, -2.5),
  section(12,  0.00,  0),
  section(8,   0.00,  3.0),
  section(4,   0.00, -3.0),
  section(15,  0.00,  0),
  section(5,  -0.01,  0),
  section(12,  0.00,  0),
  section(5,   0.00,  1.0),
  section(15,  0.00,  6.5),
  section(6,   0.00,  2.0),
  section(8,   0.00, -2.0),
  section(8,   0.00, -6.5),
  section(10,  0.00, -1.0),
  section(5,   0.01,  0),
  section(25,  0.00,  0),
));

// --------------------------------------------------------------------------
// DIVISION 2 — ADVANCED
// --------------------------------------------------------------------------

// THE HIGH JUMP
// Single massive jump chasm — must hit 200+mph or crash
const HIGH_JUMP = buildTrack(concat(
  section(20,  0.00,  0),
  section(5,   0.01,  0),
  section(20,  0.00,  0),
  // approach ramp
  section(6,   0.00,  3.0),
  section(4,   0.00,  1.0),
  // THE CHASM — long gap
  section(14,  0.00,  0, true),  // THE VOID
  // landing ramp (sloped receiver)
  section(4,   0.00, -3.5),
  section(6,   0.00, -1.0),
  section(8,   0.00,  0),
  section(5,  -0.01,  0),
  section(20,  0.00,  0),
  section(5,   0.01,  0),
  section(20,  0.00,  0),
  // second approach
  section(6,   0.00,  3.0),
  section(4,   0.00,  1.0),
  section(14,  0.00,  0, true),  // THE VOID again
  section(4,   0.00, -3.5),
  section(6,   0.00, -1.0),
  section(8,   0.00,  0),
  section(5,  -0.01,  0),
  section(20,  0.00,  0),
));

// THE ROLLERCOASTER
// Undulating hills — main crest max 160mph
const ROLLERCOASTER = buildTrack(concat(
  section(15,  0.00,  0),
  section(8,   0.00,  1.5),
  section(8,   0.00, -1.5),
  section(10,  0.00,  0),
  section(5,   0.01,  0),
  // MAIN CREST
  section(8,   0.00,  1.5),
  section(10,  0.00,  3.5),
  section(6,   0.00,  1.5),
  section(6,   0.00, -1.5),
  section(10,  0.00, -3.5),
  section(8,   0.00, -1.5),
  section(10,  0.00,  0),
  section(5,  -0.01,  0),
  section(15,  0.00,  0),
  section(5,   0.01,  0),
  section(8,   0.00,  2.0),
  section(8,   0.00, -2.0),
  section(8,   0.00,  2.5),
  section(8,   0.00, -2.5),
  section(10,  0.00,  0),
  // second main crest
  section(8,   0.00,  1.5),
  section(10,  0.00,  3.5),
  section(6,   0.00,  1.5),
  section(6,   0.00, -1.5),
  section(10,  0.00, -3.5),
  section(8,   0.00, -1.5),
  section(10,  0.00,  0),
  section(5,  -0.01,  0),
  section(15,  0.00,  0),
  section(8,   0.00,  1.5),
  section(8,   0.00, -1.5),
  section(8,   0.00,  2.0),
  section(8,   0.00, -2.0),
  section(10,  0.00,  0),
));

// --------------------------------------------------------------------------
// DIVISION 1 — EXPERT
// --------------------------------------------------------------------------

// THE DRAWBRIDGE
// Moving drawbridge (isDraw flags) at ~140mph approach
// Bridge cycles open/closed
const DRAWBRIDGE = buildTrack(concat(
  section(25,  0.00,  0),
  section(5,   0.01,  0),
  section(15,  0.00,  0),
  section(8,   0.00,  0.5),
  section(8,   0.00, -0.5),
  section(15,  0.00,  0),
  // DRAWBRIDGE SEGMENTS
  section(1,   0.00,  0, false, true),  // bridge segment A
  section(8,   0.00,  0, false, true),  // bridge span
  section(1,   0.00,  0, false, true),  // bridge segment B
  section(15,  0.00,  0),
  section(8,   0.00,  1.5),
  section(8,   0.00, -1.5),
  section(20,  0.00,  0),
  section(5,  -0.01,  0),
  section(25,  0.00,  0),
  section(5,   0.01,  0),
  section(15,  0.00,  0),
  section(8,   0.00,  0.5),
  section(8,   0.00, -0.5),
  section(15,  0.00,  0),
  // DRAWBRIDGE SEGMENTS (second pass)
  section(1,   0.00,  0, false, true),
  section(8,   0.00,  0, false, true),
  section(1,   0.00,  0, false, true),
  section(15,  0.00,  0),
  section(8,   0.00,  1.5),
  section(8,   0.00, -1.5),
  section(20,  0.00,  0),
  section(5,  -0.01,  0),
  section(15,  0.00,  0),
));

// THE SKI JUMP
// Massive ski jump — must be 200+mph
const SKI_JUMP = buildTrack(concat(
  section(20,  0.00,  0),
  section(5,  -0.01,  0),
  section(20,  0.00,  0),
  section(5,   0.01,  0),
  section(10,  0.00,  0),
  // build-up slope
  section(8,   0.00,  1.0),
  section(8,   0.00,  2.0),
  // THE SKI JUMP — mega ramp
  section(6,   0.00,  5.0),
  section(8,   0.00,  8.0),    // steep main face
  section(6,   0.00,  4.0),    // lip
  section(4,   0.00, -4.0),    // over the top
  section(6,   0.00, -8.0),    // steep descent
  section(6,   0.00, -5.0),    // landing angle
  section(8,   0.00, -2.0),
  section(8,   0.00, -1.0),
  section(15,  0.00,  0),
  section(5,   0.01,  0),
  section(15,  0.00,  0),
  section(5,  -0.01,  0),
  section(15,  0.00,  0),
  // second pass
  section(8,   0.00,  1.0),
  section(8,   0.00,  2.0),
  section(6,   0.00,  5.0),
  section(8,   0.00,  8.0),
  section(6,   0.00,  4.0),
  section(4,   0.00, -4.0),
  section(6,   0.00, -8.0),
  section(6,   0.00, -5.0),
  section(8,   0.00, -2.0),
  section(8,   0.00, -1.0),
  section(15,  0.00,  0),
  section(5,  -0.01,  0),
  section(10,  0.00,  0),
));

// --------------------------------------------------------------------------
// Track registry
// --------------------------------------------------------------------------
const TRACKS = {
  littleRamp:     { segs: LITTLE_RAMP,    name: 'The Little Ramp',    div: 4, minSpeed: 130, maxSpeed: 200, hint: 'Hit ramp at 130+mph. Stay under 200mph on hump.' },
  humpBack:       { segs: HUMP_BACK,      name: 'The Hump Back',      div: 4, minSpeed: 0,   maxSpeed: 130, hint: 'Keep under 130mph over the hump or you crash.' },
  steppingStones: { segs: STEPPING_STONES,name: 'The Stepping Stones',div: 3, minSpeed: 140, maxSpeed: 165, hint: 'Find the constant speed (≈150mph) and hold it over every stone.' },
  bigRamp:        { segs: BIG_RAMP,       name: 'The Big Ramp',       div: 3, minSpeed: 160, maxSpeed: null,hint: 'Small ramps: 160-180mph. Main ramp: 210+mph with full boost.' },
  highJump:       { segs: HIGH_JUMP,      name: 'The High Jump',      div: 2, minSpeed: 200, maxSpeed: null,hint: 'Must be 200+mph to clear the chasm. Use boost early.' },
  rollercoaster:  { segs: ROLLERCOASTER,  name: 'The Rollercoaster',  div: 2, minSpeed: 0,   maxSpeed: 160, hint: 'Max 160mph over the main crest. Open throttle on downslope.' },
  drawbridge:     { segs: DRAWBRIDGE,     name: 'The Drawbridge',     div: 1, minSpeed: 0,   maxSpeed: null,hint: 'Approach bridge at ~140mph. Time it carefully.' },
  skiJump:        { segs: SKI_JUMP,       name: 'The Ski Jump',       div: 1, minSpeed: 200, maxSpeed: null,hint: 'Must exceed 200mph on the jump. Full throttle and boost from turn-in.' },
};

// Division track assignments
const DIVISION_TRACKS = {
  4: ['littleRamp', 'humpBack'],
  3: ['steppingStones', 'bigRamp'],
  2: ['highJump', 'rollercoaster'],
  1: ['drawbridge', 'skiJump'],
};
