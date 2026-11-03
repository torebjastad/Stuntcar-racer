'use strict';

// Pseudo-3D renderer for elevated tracks.
// World is projected per segment and painted far → near (painter's algorithm),
// so hills, platform walls, support pillars and the opponent occlude correctly.
const Renderer = (() => {
  let canvas, ctx, W = 0, H = 0, dpr = 1;
  let bgOffset = 0;
  let lowQ = false, slowEma = 0.016, slowT = 0;   // adaptive quality

  function init(c) {
    canvas = c;
    ctx = c.getContext('2d', { alpha: false });
    resize();
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, lowQ ? 1 : 1.5);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
  }

  // ---- Colours with distance fog (cached strings, no per-frame allocation) --
  const FOG = [168, 184, 206];
  const BANDS = 14;
  const PAL = {
    road1: [104, 108, 116], road2: [92, 96, 104],
    lift1: [150, 128, 60], lift2: [60, 56, 48],
    line: [235, 235, 225], kerbR: [205, 45, 40], kerbW: [235, 235, 235],
    wallA: [66, 74, 98], wallB: [54, 61, 82],
    face: [80, 88, 112], under: [34, 36, 46],
    pillar: [88, 92, 108], pillarD: [64, 68, 82],
    gnd1: [58, 92, 52], gnd2: [52, 84, 47],
    start1: [240, 240, 240], start2: [20, 20, 20],
    tree: [44, 96, 50], treeD: [34, 78, 40], trunk: [92, 66, 44],
    bldg: [150, 146, 140], bldgD: [116, 112, 108], roof: [120, 70, 60],
  };
  const cache = {};
  for (const k in PAL) {
    cache[k] = [];
    for (let b = 0; b < BANDS; b++) {
      const f = Math.pow(b / (BANDS - 1), 1.25) * 0.88;
      const c = PAL[k].map((v, i) => Math.round(v + (FOG[i] - v) * f));
      cache[k].push(`rgb(${c[0]},${c[1]},${c[2]})`);
    }
  }

  function quad(x1, y1, x2, y2, x3, y3, x4, y4, c) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  }

  // ---- Projection buffers (reused every frame) -----------------------------
  const MAXS = 400;
  const P = [];
  for (let i = 0; i < MAXS; i++) P.push({});

  // ---------------------------------------------------------------------------
  function adaptQuality(dt) {
    if (!dt || lowQ) return;
    slowEma += (dt - slowEma) * 0.05;
    slowT = slowEma > 0.026 ? slowT + dt : 0;
    if (slowT > 2) { lowQ = true; resize(); }
  }

  function render(st) {
    adaptQuality(st.dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!st.track || !st.player) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0b1230'); g.addColorStop(1, '#2a3d66');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      return;
    }
    const p = st.player;
    const shake = p.shake || 0;
    const sx = (Math.random() - 0.5) * shake * 7, sy = (Math.random() - 0.5) * shake * 9;

    ctx.save();
    ctx.translate(W / 2 + sx, H / 2 + sy);
    ctx.rotate(-(p.roll || 0));
    ctx.translate(-W / 2, -H / 2);
    renderWorld(st);
    ctx.restore();

    renderCockpit(st, sx, sy);
    renderHUD(st);
  }

  // ---------------------------------------------------------------------------
  function renderWorld(st) {
    const trk = st.track, p = st.player, o = st.ai, t = st.t || 0;
    const S = CFG.SEG_LEN, RW = CFG.ROAD_W, TH = CFG.THICK, NEAR = CFG.NEAR;
    const n = trk.segs.length, L = trk.len;
    const f = (W / 2) / Math.tan(CFG.FOV * Math.PI / 360);
    const camZ = Track.wrap(trk, p.z);
    const camY = p.y + CFG.CAM_H;
    const camX = p.x;
    const i0 = Math.floor(camZ / S);
    const into = camZ - i0 * S;
    const pitch = Math.max(-0.55, Math.min(0.55, p.pitch || 0));
    const hz = H * CFG.HORIZON + f * Math.tan(pitch);
    const N = Math.min(lowQ ? Math.round(CFG.DRAW_SEGS * 0.65) : CFG.DRAW_SEGS, n - 1, MAXS);
    const bandLen = N * S / BANDS;

    // Background parallax follows curvature
    bgOffset += trk.segs[i0].curve * Math.max(0, p.speed) * (st.dt || 0) * 1.2;

    drawSky(hz);
    drawGround(hz, camY, p.z, f);

    // ---- project ----
    let X = 0, dX = -trk.segs[i0].curve * (into / S);
    let count = 0, prevSolid = true;
    for (let k = 0; k < N; k++) {
      const idx = (i0 + k) % n;
      const seg = trk.segs[idx];
      const hs = Track.segHeights(trk, idx, t);
      let X1 = X, X2 = X + dX, Y1 = hs[0], Y2 = hs[1];
      let z1 = k * S - into, z2 = z1 + S;
      const solid = hs[2];
      const segDX = dX;
      X += dX; dX += seg.curve;
      if (z2 <= NEAR) { prevSolid = solid; continue; }
      if (z1 < NEAR) {
        const u = (NEAR - z1) / (z2 - z1);
        X1 += (X2 - X1) * u; Y1 += (Y2 - Y1) * u; z1 = NEAR;
      }
      const q = P[count++];
      q.k = k; q.idx = idx; q.seg = seg; q.solid = solid;
      q.front = solid && !prevSolid;
      q.X1 = X1; q.X2 = X2; q.Y1 = Y1; q.Y2 = Y2; q.z1 = z1; q.z2 = z2; q.dX = segDX;
      const s1 = f / z1, s2 = f / z2;
      q.x1 = W / 2 + (X1 - camX) * s1; q.y1 = hz - (Y1 - camY) * s1; q.w1 = RW * s1; q.t1 = TH * s1;
      q.x2 = W / 2 + (X2 - camX) * s2; q.y2 = hz - (Y2 - camY) * s2; q.w2 = RW * s2; q.t2 = TH * s2;
      q.s1 = s1;
      q.band = Math.min(BANDS - 1, Math.floor(z1 / bandLen));
      prevSolid = solid;
    }

    // Opponent placement (relative distance ahead)
    let oz = null, ok = -1;
    if (o && o.state !== 'hidden') {
      oz = ((o.z - p.z) % L + L * 1.5) % L - L / 2;
      if (oz > NEAR + 1.5 && oz < N * S) ok = Math.floor((oz + into) / S);
    }

    // ---- paint far → near ----
    for (let j = count - 1; j >= 0; j--) {
      const q = P[j];
      if (q.idx % 3 === 0) drawScenery(q, camX, camY, hz);
      if (q.solid) drawSegment(q, camX, camY, hz, f);
      if (q.k === ok) drawOpponent(o, q, oz, camX, camY, hz, f, into);
    }
  }

  function drawSegment(q, camX, camY, hz, f) {
    const S = CFG.SEG_LEN, RW = CFG.ROAD_W, TH = CFG.THICK;
    const b = q.band, idx = q.idx, seg = q.seg;
    const { x1, y1, w1, t1, x2, y2, w2, t2 } = q;

    // Support pillars under the deck
    if (idx % 7 === 0 && !seg.lift) {
      const top = hz - (q.Y1 - TH - camY) * q.s1;
      const bot = hz - (CFG.GROUND_Y - camY) * q.s1;
      const pw = 0.7 * q.s1;
      for (const side of [-1, 1]) {
        const px = W / 2 + (q.X1 + side * (RW - 1.4) - camX) * q.s1;
        ctx.fillStyle = cache.pillar[b];
        ctx.fillRect(px - pw, top, pw * 2, bot - top);
        ctx.fillStyle = cache.pillarD[b];
        ctx.fillRect(px + pw * 0.2, top, pw * 0.8, bot - top);
      }
    }

    // Side walls (slab thickness) — visible on the outside of bends / from off-track
    const wc = ((idx >> 1) & 1) ? cache.wallA[b] : cache.wallB[b];
    const lwx = q.X1 - RW - camX, rwx = q.X1 + RW - camX;
    if (S * lwx - q.dX * q.z1 > 0) quad(x1 - w1, y1, x2 - w2, y2, x2 - w2, y2 + t2, x1 - w1, y1 + t1, wc);
    if (S * rwx - q.dX * q.z1 < 0) quad(x1 + w1, y1, x2 + w2, y2, x2 + w2, y2 + t2, x1 + w1, y1 + t1, wc);

    // Leading face of a platform after a gap
    if (q.front) quad(x1 - w1, y1, x1 + w1, y1, x1 + w1, y1 + t1, x1 - w1, y1 + t1, cache.face[b]);

    // Top surface (only if the camera is above its plane), else underside
    const slope = (q.Y2 - q.Y1) / (q.z2 - q.z1);
    const planeAtCam = q.Y1 - slope * q.z1;
    if (camY > planeAtCam) {
      const alt = ((idx / 3) | 0) & 1;
      let rc;
      if (seg.lift) rc = ((idx & 1) ? cache.lift1 : cache.lift2)[b];
      else rc = (alt ? cache.road1 : cache.road2)[b];
      quad(x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, rc);
      // start/finish line: checkered strip at the start of segment 0
      if (idx === 0 && !seg.lift) {
        const u = 1.6 / S, xm = x1 + (x2 - x1) * u, ym = y1 + (y2 - y1) * u, wm = w1 + (w2 - w1) * u;
        for (let r = 0; r < 2; r++) {
          const ya = r ? (y1 + ym) / 2 : y1, yb = r ? ym : (y1 + ym) / 2;
          const xa = r ? (x1 + xm) / 2 : x1, xb = r ? xm : (x1 + xm) / 2;
          const wa = r ? (w1 + wm) / 2 : w1, wb2 = r ? wm : (w1 + wm) / 2;
          for (let c = 0; c < 10; c++) {
            if ((c + r) & 1) continue;
            const a0 = -1 + c * 0.2, a1 = a0 + 0.2;
            quad(xa + wa * a0, ya, xa + wa * a1, ya, xb + wb2 * a1, yb, xb + wb2 * a0, yb, cache.start1[b]);
          }
        }
      }
      // kerbs
      const kc = ((idx >> 1) & 1) ? cache.kerbR[b] : cache.kerbW[b];
      const k1 = w1 * 0.09, k2 = w2 * 0.09;
      quad(x1 - w1, y1, x1 - w1 + k1, y1, x2 - w2 + k2, y2, x2 - w2, y2, kc);
      quad(x1 + w1 - k1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 - k2, y2, kc);
      // centre dashes
      if (!seg.lift && ((idx >> 1) & 1)) {
        const c1 = w1 * 0.018, c2 = w2 * 0.018;
        quad(x1 - c1, y1, x1 + c1, y1, x2 + c2, y2, x2 - c2, y2, cache.line[b]);
      }
    } else if (camY < planeAtCam - TH) {
      quad(x1 - w1, y1 + t1, x1 + w1, y1 + t1, x2 + w2, y2 + t2, x2 - w2, y2 + t2, cache.under[b]);
    }
  }

  // Deterministic ground scenery (trees, blocks) far below the track
  function hash(i) { i = Math.imul(i ^ 0x5bd1e995, 2654435761) >>> 0; return (i ^ (i >>> 13)) >>> 0; }
  function drawScenery(q, camX, camY, hz) {
    const hsh = hash(q.idx);
    if ((hsh & 3) === 0) return;
    const s = q.s1, b = q.band;
    const gy = hz - (CFG.GROUND_Y - camY) * s;
    if (gy < hz - 1) return;
    for (let k = 0; k < 2; k++) {
      const r = hash(hsh + k * 7919);
      const side = (r & 1) ? 1 : -1;
      const off = side * (16 + (r >>> 3) % 110);
      const x = W / 2 + (q.X1 + off - camX) * s;
      if (x < -W * 0.5 || x > W * 1.5) continue;
      const kind = (r >>> 9) % 5;
      if (kind < 3) {                    // tree
        const h = (7 + (r >>> 12) % 7) * s, w = h * 0.38;
        ctx.fillStyle = cache.trunk[b];
        ctx.fillRect(x - w * 0.08, gy - h * 0.3, w * 0.16, h * 0.3);
        ctx.fillStyle = cache.tree[b];
        ctx.beginPath(); ctx.moveTo(x - w, gy - h * 0.25); ctx.lineTo(x + w, gy - h * 0.25); ctx.lineTo(x, gy - h); ctx.closePath(); ctx.fill();
        ctx.fillStyle = cache.treeD[b];
        ctx.beginPath(); ctx.moveTo(x, gy - h * 0.25); ctx.lineTo(x + w, gy - h * 0.25); ctx.lineTo(x, gy - h); ctx.closePath(); ctx.fill();
      } else {                           // block building
        const h = (8 + (r >>> 12) % 14) * s, w = (6 + (r >>> 16) % 8) * s;
        ctx.fillStyle = cache.bldg[b];
        ctx.fillRect(x - w / 2, gy - h, w, h);
        ctx.fillStyle = cache.bldgD[b];
        ctx.fillRect(x + (side > 0 ? -w / 2 : w * 0.2), gy - h, w * 0.3, h);
        ctx.fillStyle = cache.roof[b];
        ctx.fillRect(x - w / 2, gy - h, w, Math.max(1, h * 0.06));
      }
    }
  }

  function drawSky(hz) {
    const g = ctx.createLinearGradient(0, hz - H, 0, hz);
    g.addColorStop(0, '#1d3f8a');
    g.addColorStop(0.7, '#6f95cf');
    g.addColorStop(1, '#b8c8e0');
    ctx.fillStyle = g;
    ctx.fillRect(-W * 0.2, hz - H * 2, W * 1.4, H * 2 + 1);
    // distant hills, two parallax layers
    drawHills(hz, 0.25, 0.07, '#8ea3c4', 1.0);
    drawHills(hz, 0.55, 0.045, '#7d93b6', 2.3);
  }

  function drawHills(hz, par, amp, color, seed) {
    const off = bgOffset * par * 40;
    const step = W / 12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-W * 0.2, hz + 1);
    for (let x = -W * 0.2; x <= W * 1.25; x += step) {
      const u = (x + off) / W * 6.283 * 1.3 + seed;
      const h = (Math.sin(u) * 0.5 + Math.sin(u * 2.7 + seed) * 0.3 + Math.sin(u * 5.1) * 0.2 + 1) * 0.5;
      ctx.lineTo(x, hz - h * amp * H * 1.6);
    }
    ctx.lineTo(W * 1.25, hz + 1);
    ctx.closePath();
    ctx.fill();
  }

  function drawGround(hz, camY, pz, f) {
    const h = camY - CFG.GROUND_Y;
    ctx.fillStyle = cache.gnd1[BANDS - 1];
    ctx.fillRect(-W * 0.2, hz, W * 1.4, H * 2);
    // alternating field bands every 40 m for a sense of speed and height
    const B = 40;
    let zb = Math.ceil(pz / B) * B;
    let prevY = H * 2;
    for (let i = 0; i < 40; i++, zb += B) {
      const cz = zb - pz;
      if (cz < 1) continue;
      const y = hz + f * h / cz;
      if (y > prevY) continue;
      const band = Math.min(BANDS - 1, Math.floor(cz / 70));
      ctx.fillStyle = (((zb / B) | 0) & 1) ? cache.gnd1[band] : cache.gnd2[band];
      ctx.fillRect(-W * 0.2, y, W * 1.4, Math.min(prevY, H * 1.2) - y);
      prevY = y;
      if (y - hz < 1) break;
    }
  }

  // ---- Opponent (rear view, polygon car) ------------------------------------
  function drawOpponent(o, q, oz, camX, camY, hz, f, into) {
    const S = CFG.SEG_LEN;
    const u = Math.max(0, Math.min(1, (oz - (q.k * S - into)) / S));
    const wx = q.X1 + (q.X2 - q.X1) * u + o.x;
    const s = f / oz;
    const cx = W / 2 + (wx - camX) * s;
    const by = hz - (o.y - camY) * s;          // ground contact line
    const m = v => v * s;                      // metres → px
    const b = Math.min(BANDS - 1, Math.floor(oz / (CFG.DRAW_SEGS * S / BANDS)));
    const fog = b / (BANDS - 1);
    const shade = (r, g, bl) => `rgb(${Math.round(r + (FOG[0] - r) * fog * 0.8)},${Math.round(g + (FOG[1] - g) * fog * 0.8)},${Math.round(bl + (FOG[2] - bl) * fog * 0.8)})`;

    // wheels
    ctx.fillStyle = shade(20, 20, 24);
    ctx.fillRect(cx - m(1.0), by - m(0.62), m(0.42), m(0.62));
    ctx.fillRect(cx + m(0.58), by - m(0.62), m(0.42), m(0.62));
    // body
    quad(cx - m(0.98), by - m(0.25), cx + m(0.98), by - m(0.25),
         cx + m(0.92), by - m(0.95), cx - m(0.92), by - m(0.95), shade(196, 40, 36));
    // cabin + roll cage
    quad(cx - m(0.80), by - m(0.95), cx + m(0.80), by - m(0.95),
         cx + m(0.58), by - m(1.42), cx - m(0.58), by - m(1.42), shade(150, 28, 26));
    quad(cx - m(0.62), by - m(1.0), cx + m(0.62), by - m(1.0),
         cx + m(0.48), by - m(1.34), cx - m(0.48), by - m(1.34), shade(24, 30, 44));
    // rear wing
    ctx.fillStyle = shade(30, 30, 34);
    ctx.fillRect(cx - m(0.95), by - m(1.12), m(1.9), m(0.1));
    // tail lights
    ctx.fillStyle = shade(255, 70, 50);
    ctx.fillRect(cx - m(0.85), by - m(0.72), m(0.3), m(0.14));
    ctx.fillRect(cx + m(0.55), by - m(0.72), m(0.3), m(0.14));
    // boost flames
    if (o.boosting) {
      const fl = m(0.5 + Math.random() * 0.4);
      ctx.fillStyle = '#ffb030';
      for (const sx of [-0.5, 0.5]) {
        ctx.beginPath();
        ctx.moveTo(cx + m(sx) - m(0.1), by - m(0.4));
        ctx.lineTo(cx + m(sx) + m(0.1), by - m(0.4));
        ctx.lineTo(cx + m(sx), by - m(0.4) + fl);
        ctx.fill();
      }
    }
  }

  // ---- Cockpit ---------------------------------------------------------------
  function renderCockpit(st, sx, sy) {
    const p = st.player;
    ctx.save();
    ctx.translate(sx * 0.5, sy * 0.5);

    // Bonnet
    const hy = H * 0.755 + (p.state === 'air' ? -4 : 0);
    ctx.fillStyle = '#5a1414';
    ctx.beginPath();
    ctx.moveTo(W * 0.24, H + 2);
    ctx.lineTo(W * 0.34, hy);
    ctx.quadraticCurveTo(W * 0.5, hy - H * 0.035, W * 0.66, hy);
    ctx.lineTo(W * 0.76, H + 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8a2a2a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W * 0.36, hy + 3);
    ctx.quadraticCurveTo(W * 0.5, hy - H * 0.03 + 3, W * 0.64, hy + 3);
    ctx.stroke();
    // air intake
    ctx.fillStyle = '#1c0b0b';
    ctx.fillRect(W * 0.455, hy + H * 0.025, W * 0.09, H * 0.05);

    // Exhaust stacks + boost flames
    for (const ex of [0.355, 0.645]) {
      const x = W * ex, y = hy + H * 0.02;
      ctx.fillStyle = '#2a2a2e';
      ctx.fillRect(x - W * 0.012, y, W * 0.024, H * 0.12);
      ctx.fillStyle = '#555';
      ctx.fillRect(x - W * 0.012, y, W * 0.024, H * 0.012);
      if (p.boosting) drawFlame(x, y, W * 0.02, H * 0.13);
    }

    // Roll-cage pillars and top bar
    ctx.fillStyle = '#16181d';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(W * 0.075, 0); ctx.lineTo(W * 0.035, H); ctx.lineTo(0, H);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W, 0); ctx.lineTo(W * 0.925, 0); ctx.lineTo(W * 0.965, H); ctx.lineTo(W, H);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(0, 0, W, 24);
    ctx.fillStyle = '#2a2d35';
    ctx.fillRect(0, 22, W, 2);

    drawDamageBar(p, W * 0.12, 3, W * 0.62, 10);
    ctx.restore();
  }

  function drawFlame(x, y, w, h) {
    const t = performance.now() * 0.03;
    const h1 = h * (0.7 + Math.sin(t) * 0.15 + Math.random() * 0.25);
    ctx.fillStyle = 'rgba(255,110,20,0.9)';
    ctx.beginPath();
    ctx.moveTo(x - w, y); ctx.lineTo(x + w, y);
    ctx.lineTo(x + w * 0.4, y - h1 * 0.6); ctx.lineTo(x, y - h1); ctx.lineTo(x - w * 0.4, y - h1 * 0.6);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,230,120,0.95)';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.5, y); ctx.lineTo(x + w * 0.5, y); ctx.lineTo(x, y - h1 * 0.55);
    ctx.closePath(); ctx.fill();
  }

  // Chassis bar: crack grows from the left, holes are punched from the right
  function drawDamageBar(p, bx, by, bw, bh) {
    ctx.fillStyle = '#3b3f48';
    ctx.fillRect(bx, by, bw, bh);
    if (p.crack > 0) {
      const cw = p.crack * bw;
      ctx.fillStyle = p.crack > 0.75 ? '#ff3b2f' : '#e0a020';
      ctx.beginPath();
      ctx.moveTo(bx, by + bh * 0.5);
      for (let x = 0; x <= cw; x += 4) {
        const j = Math.sin(x * 1.7) * bh * 0.32 + Math.sin(x * 0.53) * bh * 0.12;
        ctx.lineTo(bx + x, by + bh * 0.5 + j);
      }
      ctx.lineTo(bx + cw, by + bh * 0.5);
      ctx.lineTo(bx + cw, by + bh * 0.5 + 1.5);
      ctx.lineTo(bx, by + bh * 0.5 + 1.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(bx, by + bh * 0.5 - 1, cw, 2.5);
    }
    for (const h of p.holes || []) {
      const hx = bx + h * bw, hw = bw * CFG.HOLE_W;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(hx + hw / 2, by + bh / 2, hw / 2, bh * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#6a6f7a';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
  }

  // ---- HUD -----------------------------------------------------------------
  function fmtT(ms) {
    if (ms == null) return '--.-';
    const s = ms / 1000;
    return s >= 60 ? `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}` : s.toFixed(1);
  }

  function text(str, x, y, size, color, align) {
    ctx.font = `bold ${size}px 'Courier New', monospace`;
    ctx.textAlign = align || 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(str, x + 1.5, y + 1.5);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function renderHUD(st) {
    const p = st.player, o = st.ai, trk = st.track;
    const fs = Math.max(12, Math.min(20, H * 0.045));
    const y = 30 + fs;
    ctx.textBaseline = 'alphabetic';

    const mph = Math.round(Math.max(0, p.speed) * CFG.MPH);
    text(String(mph), W * 0.09, y + fs * 0.35, fs * 1.6, '#ffd23a');
    const mw = ctx.measureText(String(mph)).width;
    text('MPH', W * 0.09 + mw + 4, y + fs * 0.35, fs * 0.7, '#ffd23a');

    const lap = Math.min(CFG.LAPS, p.lapsDone + 1);
    text(`LAP ${lap}/${CFG.LAPS}`, W * 0.09, y + fs * 1.5, fs * 0.8, '#ffffff');

    // Boost gauge
    const gx = W * 0.25, gy = y - fs * 0.55, gw = W * 0.14, gh = fs * 0.55;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(gx, gy, gw, gh);
    ctx.fillStyle = p.boost > 30 ? '#ff8a1e' : p.boost > 10 ? '#ffd23a' : '#ff3b2f';
    ctx.fillRect(gx + 1, gy + 1, (gw - 2) * p.boost / CFG.BOOST_MAX, gh - 2);
    text(`BOOST ${Math.ceil(p.boost)}`, gx, gy + gh + fs * 0.9, fs * 0.7, '#ffb060');

    // Gap to opponent (negative = you lead)
    if (o) {
      const lead = (p.z - p.startZ) - (o.z - o.startZ);
      const m = Math.round(Math.abs(lead));
      text(lead >= 0 ? `-${m}m` : `+${m}m`, W * 0.5, y, fs, lead >= 0 ? '#5dff6a' : '#ff6a5d', 'center');
    }

    // Lap time / best (left of the pause button)
    const rx = W * 0.905 - 44;
    text(fmtT(st.lapMs), rx, y, fs, '#ffffff', 'right');
    text('BEST ' + fmtT(p.bestLap), rx, y + fs * 1.1, fs * 0.65, '#c8d0e0', 'right');

    // Lap progress strip with jump markers
    const px = W * 0.12, pw = W * 0.62, py = 17.5;
    if (trk._marks === undefined) {
      trk._marks = [];
      trk.segs.forEach((s, i) => { if ((s.gap || s.lift) && !(trk.segs[i - 1] || {}).gap) trk._marks.push(i / trk.segs.length); });
    }
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(px, py, pw, 3);
    ctx.fillStyle = '#ff5a3a';
    for (const mk of trk._marks) ctx.fillRect(px + mk * pw - 1, py - 1, 2, 5);
    const prog = c => Track.wrap(trk, c.z) / trk.len;
    if (o) { ctx.fillStyle = '#ff4040'; ctx.fillRect(px + prog(o) * pw - 2, py - 2, 4, 7); }
    ctx.fillStyle = '#ffd23a';
    ctx.fillRect(px + prog(p) * pw - 2, py - 2, 4, 7);

    // Centre messages
    if (st.msg) {
      const big = Math.min(H * 0.17, W * 0.85 / (st.msg.text.length * 0.62));
      text(st.msg.text, W / 2, H * 0.38, big, st.msg.color || '#ffffff', 'center');
      if (st.msg.sub) text(st.msg.sub, W / 2, H * 0.38 + big * 0.6, big * 0.3, '#ffffff', 'center');
    }
    ctx.textAlign = 'left';
  }

  return { init, resize, render };
})();
