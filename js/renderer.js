'use strict';

const Renderer = (() => {
  let canvas, ctx, W, H, viewH;

  // Drawbridge animation state
  let bridgeAngle = 0;
  let bridgeDir   = 1;

  // --- Projection constants (tuned for phone landscape) ---
  const ROAD_HW      = 0.40;   // road half-width at z=1 (fraction of W)
  const CAMERA_H     = 0.18;   // camera height above road at z=1
  const PITCH_SCALE  = 0.015;  // pitch units → camera-height fraction
  const CURVE_SCALE  = 4.0;    // curve accumulator → lateral shift
  const CAM_Y_SCALE  = 0.0008; // car yPos (wu) → camera-height fraction

  function init(c) {
    canvas = c;
    ctx    = c.getContext('2d');
    resize();
  }

  function resize() {
    W     = canvas.width  = window.innerWidth;
    H     = canvas.height = window.innerHeight;
    viewH = Math.floor(H * 0.68);  // 3D view height
  }

  // Filled quadrilateral helper
  function quad(x1, y1, x2, y2, x3, y3, x4, y4, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  }

  function updateBridge(dt) {
    const SPEED = Math.PI / 6;
    bridgeAngle += bridgeDir * SPEED * dt;
    if (bridgeAngle >= Math.PI / 2) { bridgeAngle = Math.PI / 2; bridgeDir = -1; }
    if (bridgeAngle <= 0)           { bridgeAngle = 0;            bridgeDir = 1;  }
  }

  // ---------- MAIN ENTRY ----------
  function render(state) {
    if (!ctx) return;
    updateBridge(state.dt || 0);
    ctx.clearRect(0, 0, W, H);

    if (state.screen === 'race') {
      renderRace(state);
    } else {
      ctx.fillStyle = '#050510';
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------- RACE SCENE ----------
  function renderRace(state) {
    const { player, ai, trackSegs, trackInfo, elapsed } = state;
    const track = trackSegs;
    const tLen  = track.length;

    // 1 ── BACKGROUND (sky / void) ──────────────────────────────────────
    const horizon = viewH * 0.48;
    // sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizon);
    skyGrad.addColorStop(0, '#07071a');
    skyGrad.addColorStop(1, '#12123a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, horizon);
    // void (ground below elevated track)
    ctx.fillStyle = '#090909';
    ctx.fillRect(0, horizon, W, viewH - horizon);
    // subtle ground gradient
    const gGrad = ctx.createLinearGradient(0, horizon, 0, viewH);
    gGrad.addColorStop(0, '#0d0d10');
    gGrad.addColorStop(1, '#060608');
    ctx.fillStyle = gGrad;
    ctx.fillRect(0, horizon, W, viewH - horizon);

    // 2 ── ROAD PROJECTION ───────────────────────────────────────────────
    const startSeg  = Math.floor(Math.abs(player.trackPos)) % tLen;
    const camHeight = CAMERA_H + player.yPos * CAM_Y_SCALE;

    // AI relative segment depth
    const aiRelDepth = ((Math.floor(ai.trackPos) - Math.floor(player.trackPos)) % tLen + tLen) % tLen;

    let cumulCurve = 0;
    let cumulPitch = 0;
    // "prevX/Y/W" = bottom edge of next strip (starts at screen bottom-center)
    let prevX = W * 0.5;
    let prevY = viewH;
    let prevW = 0;

    for (let i = 0; i < CFG.DRAW_DISTANCE; i++) {
      const segIdx = (startSeg + i) % tLen;
      const s      = track[segIdx];

      cumulCurve += s.curve;
      cumulPitch += s.pitch;

      // Perspective depth (normalized: z=1 is nearest segment)
      const z  = i + 1;
      const sc = CFG.CAMERA_DEPTH / z;

      // Project road center
      const projW = ROAD_HW * sc * W;
      const projX = W * 0.5
                  - cumulCurve * sc * W * CURVE_SCALE
                  + player.laneOffset * projW;  // laneOffset pushes opposite (road shifts)
      const projY = viewH * 0.5
                  + (camHeight - cumulPitch * PITCH_SCALE) * sc * viewH;

      // Hill occlusion: only draw if this strip is above the previous
      if (projY >= prevY) continue;

      // Clip to view boundaries
      const y1 = Math.min(prevY, viewH);
      const y2 = Math.max(projY, -50);  // allow slight overshoot (canvas clips)
      if (y1 <= y2) { prevY = projY; prevX = projX; prevW = projW; continue; }

      // ── Draw road surface ──────────────────────────────────────────
      if (!s.noRoad && !s.isDraw) {
        // Alternating light/dark strips for distance cue
        const even    = (segIdx & 2) === 0;
        const roadCol = even ? '#7f7f7f' : '#717171';

        // Road surface trapezoid
        quad(prevX - prevW, y1, prevX + prevW, y1,
             projX + projW,  y2, projX - projW,  y2, roadCol);

        // Rumble strips every 8 segments
        if ((segIdx & 7) === 0) {
          const rw = Math.max(1, projW * 0.13);
          const rc = even ? '#dd2222' : '#eeeeee';
          quad(prevX - prevW,      y1, prevX - prevW + rw * 1.5, y1,
               projX - projW + rw, y2, projX - projW,            y2, rc);
          quad(prevX + prevW - rw * 1.5, y1, prevX + prevW,  y1,
               projX + projW,            y2, projX + projW - rw, y2, rc);
        }

        // White track-edge lines
        const ew = Math.max(1, projW * 0.035);
        quad(prevX - prevW,      y1, prevX - prevW + ew,      y1,
             projX - projW + ew, y2, projX - projW,            y2, '#ddd');
        quad(prevX + prevW - ew, y1, prevX + prevW,            y1,
             projX + projW,      y2, projX + projW - ew,      y2, '#ddd');

        // Track side faces (depth below road edge)
        const sideH = (y1 - y2) * 0.18;
        const sideCol = '#2a2a2a';
        quad(prevX - prevW, y1, projX - projW, y2,
             projX - projW, y2 + sideH, prevX - prevW, y1 + sideH, sideCol);
        quad(prevX + prevW, y1, projX + projW, y2,
             projX + projW, y2 + sideH, prevX + prevW, y1 + sideH, sideCol);

      } else if (s.isDraw) {
        // Drawbridge segment
        drawBridgeSegment(prevX, y1, prevW, projX, y2, projW);
      }
      // noRoad = gap → draw nothing (void background shows through)

      // ── Opponent car at this depth ─────────────────────────────────
      if (i === aiRelDepth && aiRelDepth < CFG.DRAW_DISTANCE) {
        drawOpponent(projX, y2, sc, ai.laneOffset);
      }

      prevY = projY;
      prevX = projX;
      prevW = projW;
    }

    // 3 ── COCKPIT OVERLAY ───────────────────────────────────────────────
    renderCockpit(player);

    // 4 ── HUD ───────────────────────────────────────────────────────────
    renderHUD(state);
  }

  // ---------- DRAWBRIDGE ----------
  function drawBridgeSegment(px, py, pw, cx, cy, cw) {
    const lift    = bridgeAngle * cw * 2.0;
    const raisedY = cy - lift;

    quad(px - pw, py, px + pw, py,
         cx + cw,  raisedY, cx - cw, raisedY, '#999');

    // Structural rails
    quad(px - pw, py, px - pw + 3, py,
         cx - cw + 3, raisedY, cx - cw, raisedY, '#ffcc00');
    quad(px + pw - 3, py, px + pw, py,
         cx + cw,  raisedY, cx + cw - 3, raisedY, '#ffcc00');

    // Blocking wall when raised
    if (bridgeAngle > 0.2) {
      const wallH = lift * 1.4;
      ctx.fillStyle = 'rgba(100,100,100,0.85)';
      ctx.fillRect(cx - cw, raisedY - wallH, cw * 2, wallH);
      ctx.fillStyle = '#ff6600';
      ctx.fillRect(cx - cw, raisedY - wallH, cw * 2, 3);
    }
  }

  // ---------- OPPONENT ----------
  function drawOpponent(cx, cy, sc, laneOff) {
    const bw = Math.max(6,  ROAD_HW * sc * W * 0.55);
    const bh = Math.max(4,  bw * 0.65);
    const ox = cx + laneOff * ROAD_HW * sc * W;
    // Body
    ctx.fillStyle = '#bb3300';
    ctx.fillRect(ox - bw * 0.5, cy - bh, bw, bh);
    // Roof
    ctx.fillStyle = '#881100';
    ctx.fillRect(ox - bw * 0.32, cy - bh - bh * 0.38, bw * 0.64, bh * 0.38);
    // Wheels
    ctx.fillStyle = '#222';
    ctx.fillRect(ox - bw * 0.54, cy - bh * 0.28, bw * 0.18, bh * 0.28);
    ctx.fillRect(ox + bw * 0.36, cy - bh * 0.28, bw * 0.18, bh * 0.28);
  }

  // ---------- COCKPIT OVERLAY ----------
  function renderCockpit(player) {
    const panelY = viewH;
    const panelH = H - viewH;

    // Instrument panel background
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, panelY, W, panelH);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, panelY);
    ctx.lineTo(W, panelY);
    ctx.stroke();

    // Side pillar left
    ctx.fillStyle = '#141414';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W * 0.10, 0);
    ctx.lineTo(W * 0.07, panelY);
    ctx.lineTo(0, panelY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Side pillar right
    ctx.fillStyle = '#141414';
    ctx.beginPath();
    ctx.moveTo(W, 0);
    ctx.lineTo(W * 0.90, 0);
    ctx.lineTo(W * 0.93, panelY);
    ctx.lineTo(W, panelY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Damage bar (across top of cockpit window)
    const bx = W * 0.13, by = 8, bw = W * 0.74, bh = 12;
    drawDamageBar(player, bx, by, bw, bh);

    // V8 engine block (centre of cockpit, lower part of 3D view)
    const ex = W * 0.5;
    const ey = panelY;
    const ew = W * 0.27;
    const eh = viewH * 0.32;

    ctx.fillStyle = '#1e1e1e';
    ctx.beginPath();
    ctx.moveTo(ex - ew * 0.5, ey);
    ctx.lineTo(ex - ew * 0.65, ey - eh * 0.28);
    ctx.lineTo(ex - ew * 0.42, ey - eh);
    ctx.lineTo(ex + ew * 0.42, ey - eh);
    ctx.lineTo(ex + ew * 0.65, ey - eh * 0.28);
    ctx.lineTo(ex + ew * 0.5, ey);
    ctx.closePath();
    ctx.fill();

    // Valve cover detail
    ctx.fillStyle = '#282828';
    ctx.fillRect(ex - ew * 0.3, ey - eh * 0.88, ew * 0.6, eh * 0.38);

    // Exhaust pipes
    ctx.fillStyle = '#181818';
    const pipeW = ew * 0.10;
    const pipeH = eh * 0.36;
    ctx.fillRect(ex - ew * 0.7, ey - eh * 0.55, pipeW, pipeH);
    ctx.fillRect(ex + ew * 0.60, ey - eh * 0.55, pipeW, pipeH);

    // Boost flames
    if (player.boostActive && player.boost > 0) {
      drawFlames(ex - ew * 0.64, ey - eh * 0.19, pipeW, eh * 0.5);
      drawFlames(ex + ew * 0.64, ey - eh * 0.19, pipeW, eh * 0.5);
    }
  }

  function drawFlames(x, y, w, maxH) {
    const t  = Date.now() * 0.05;
    const jit = () => (Math.random() - 0.5) * w;
    const h1 = maxH * (0.6 + Math.sin(t) * 0.2 + Math.random() * 0.2);
    const h2 = maxH * (0.4 + Math.cos(t * 1.3) * 0.15 + Math.random() * 0.15);

    ctx.fillStyle = '#ff5500';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.5, y);
    ctx.lineTo(x + w * 0.5, y);
    ctx.lineTo(x + w * 0.3 + jit(), y - h1);
    ctx.lineTo(x + jit(), y - h1 * 1.15);
    ctx.lineTo(x - w * 0.3 + jit(), y - h1);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.3, y);
    ctx.lineTo(x + w * 0.3, y);
    ctx.lineTo(x + jit() * 0.5, y - h2);
    ctx.closePath();
    ctx.fill();
  }

  // ---------- DAMAGE BAR ----------
  function drawDamageBar(player, bx, by, bw, bh) {
    // Background track
    ctx.fillStyle = '#111';
    ctx.fillRect(bx, by, bw, bh);

    // Permanent holes (from right → toward left as damage accumulates)
    for (const hp of (player.holes || [])) {
      const hx  = bx + hp * bw - 3;
      const hw  = Math.max(4, bw * 0.035);
      ctx.fillStyle = '#050505';
      ctx.fillRect(hx, by - 1, hw, bh + 2);
    }

    // Current crack (from left → right)
    if (player.crack > 0) {
      const cw = player.crack * bw;
      ctx.fillStyle = '#cc2222';
      ctx.fillRect(bx, by, cw, bh);

      // Jagged top for realism
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.moveTo(bx, by);
      for (let x = 0; x <= cw; x += 5) {
        const jag = Math.sin(x * 2.1 + Date.now() * 0.001) * bh * 0.3;
        ctx.lineTo(bx + x, by + bh * 0.5 + jag);
      }
      ctx.lineTo(bx + cw, by);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
  }

  // ---------- HUD ----------
  function renderHUD(state) {
    const { player, ai, elapsed } = state;
    const panelY = viewH + 6;
    const fs     = Math.max(11, Math.min(H * 0.034, 19));

    ctx.font         = `bold ${fs}px 'Courier New', monospace`;
    ctx.textBaseline = 'top';

    const rawMph    = player.speed * CFG.MPH_SCALE;
    const dispMph   = rawMph > 250 ? Math.floor(rawMph - 250 + 150) : Math.floor(rawMph);

    // Speed (left)
    ctx.fillStyle = '#ffcc00';
    ctx.fillText(`${dispMph}MPH`, 8, panelY);

    // Lap
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`L${player.lap}/${CFG.LAPS}`, 8 + fs * 5, panelY);

    // Boost (colour warn when low)
    ctx.fillStyle = player.boost > 25 ? '#ff8800' : (player.boost > 8 ? '#ffcc00' : '#ff2200');
    ctx.fillText(`B${Math.ceil(player.boost)}`, 8 + fs * 9.5, panelY);

    // Gap to opponent (centre)
    const gapSegs = player.trackPos - ai.trackPos;
    const gapM    = Math.round(Math.abs(gapSegs) * CFG.SEGMENT_LENGTH / 10);
    const ahead   = gapSegs >= 0;
    ctx.fillStyle = ahead ? '#44ee44' : '#ff4444';
    ctx.textAlign = 'center';
    ctx.fillText((ahead ? '-' : '+') + gapM + 'm', W * 0.5, panelY);
    ctx.textAlign = 'left';

    // Lap time (right)
    ctx.fillStyle = '#cccccc';
    ctx.textAlign = 'right';
    const lapSec  = ((elapsed || 0) / 1000).toFixed(1);
    ctx.fillText(lapSec + 's', W - 8, panelY);
    if (player.bestLap) {
      ctx.fillStyle = '#666';
      ctx.font      = `${Math.floor(fs * 0.8)}px 'Courier New', monospace`;
      ctx.fillText(`BEST ${(player.bestLap / 1000).toFixed(1)}s`, W - 8, panelY + fs + 2);
    }

    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // ---------- EXPORTS ----------
  return {
    init,
    resize,
    render,
    get bridgeAngle() { return bridgeAngle; },
  };
})();
