'use strict';

// Game flow: menus, countdown, fixed-step race simulation, league/seasons.
const Game = (() => {
  const STEP = 1 / 120;
  const SAVE_KEY = 'skyway_save_v2';
  const SKILL = { 4: 0.88, 3: 0.93, 2: 0.97, 1: 1.0, 5: 1.0 };

  let mode = 'menu';            // menu | countdown | race | ending | paused
  let pausedFrom = null;
  let track = null, trackId = null, practice = false;
  let player = null, ai = null, aiSkill = 1, oppIndex = 0;
  let t = 0, acc = 0, lastNow = 0, countdown = 0, lastBeep = 0;
  let endTimer = 0, endInfo = null, pendingLeague = null;
  let flashMsg = null, flashT = 0;
  let autopilot = false, frozen = false, timeScale = 1;

  const league = { playerName: 'DRIVER', division: 4, season: 1, points: [0, 0, 0], racesPlayed: 0, seasonHoles: [] };

  // ---- Persistence ---------------------------------------------------------
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (s && s.league) Object.assign(league, s.league);
    } catch (e) { /* ignore */ }
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ league })); } catch (e) { /* ignore */ }
  }

  // ---- Init / menus --------------------------------------------------------
  function init() {
    load();
    UI.init(document.getElementById('menu'), handleAction);
    Input.onPause = pause;
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    UI.show('title', { playerName: league.playerName });
  }

  function showMain() {
    mode = 'menu';
    Audio.silence();
    UI.show('main', { league });
  }

  function opponentName(div, idx) {
    const d = UI.DIVISION_DRIVERS[div] || UI.DIVISION_DRIVERS[4];
    return d[idx] || 'Rival';
  }

  // Season schedule: race 1,2 on the first track (vs A, vs B), 3,4 on the second.
  function nextFixture() {
    const r = league.racesPlayed;
    let id;
    if (league.division === 5) {
      const all = Object.keys(TRACKS);
      id = all[(league.season * 4 + r) % all.length];
    } else {
      id = DIVISION_TRACKS[league.division][r < 2 ? 0 : 1];
    }
    return { trackId: id, opp: r % 2 };
  }

  function handleAction(action, data) {
    Audio.resume();
    switch (action) {
      case 'start':
        league.playerName = (data && data.name) || league.playerName;
        save();
        showMain();
        break;
      case 'race':
        if (data && data.practice) {
          UI.show('setup', { league, practice: true });
        } else {
          const fx = nextFixture();
          UI.show('setup', { league, trackId: fx.trackId, practice: false, opponentName: opponentName(league.division, fx.opp) });
        }
        break;
      case 'go':
        startRace(data.trackId, !!data.practice);
        break;
      case 'back':
        showMain();
        break;
      case 'continue':
        if (pendingLeague) { const pl = pendingLeague; pendingLeague = null; UI.show('league', pl); }
        else showMain();
        break;
      case 'newseason':
        league.points = [0, 0, 0];
        league.racesPlayed = 0;
        league.season++;
        if (league.division === 4) league.seasonHoles = [];
        save();
        showMain();
        break;
      case 'resume':
        if (mode === 'paused') {
          mode = pausedFrom;
          Input.reset();
          UI.hide();
        }
        break;
      case 'quit':
        if (mode === 'paused' && !practice && ai) {
          // Quitting a league race forfeits it
          endInfo = { winner: 'ai', reason: 'forfeit' };
          finishRace(true);
        } else {
          showMain();
        }
        break;
    }
  }

  function pause() {
    if (mode === 'race' || mode === 'countdown') {
      pausedFrom = mode;
      mode = 'paused';
      Input.reset();
      Audio.silence();
      UI.show('pause');
    }
  }

  // ---- Race ----------------------------------------------------------------
  function startRace(id, prac) {
    trackId = id;
    track = TRACKS[id];
    practice = prac;
    const power = league.division === 5 && !prac ? 1.1 : 1;
    player = Physics.createCar({ z: 0, x: prac ? 0 : 2.4, power, holes: prac ? [] : league.seasonHoles });
    ai = null;
    if (!prac) {
      const fx = nextFixture();
      oppIndex = fx.opp;
      ai = Physics.createCar({ z: 9, x: -2.4, lane: -2.4, power });
      aiSkill = (SKILL[league.division] || 1) - (oppIndex === 0 ? 0.03 : 0);
    }
    t = 0; acc = 0;
    countdown = CFG.COUNTDOWN; lastBeep = CFG.COUNTDOWN + 1;
    endInfo = null; flashMsg = null; flashT = 0;
    mode = 'countdown';
    Input.reset();
    UI.hide();
  }

  function flash(text, color, dur, sub) {
    flashMsg = { text, color, sub };
    flashT = dur || 1.2;
  }

  function onEvent(kind, car, s) {
    if (car === player) {
      if (kind === 'impact') Audio.impact(s);
      else if (kind === 'bump') Audio.impact(s * 0.5);
      else if (kind === 'land' && s > 2) Audio.impact(Math.min(0.35, s / 25));
      else if (kind === 'crash') { Audio.impact(1); flash('CRASH!', '#ff5040', 1.0); }
      else if (kind === 'fall') flash('OFF THE TRACK!', '#ff5040', 1.6);
    } else if (car === ai && kind === 'fall' && mode === 'race') {
      flash('RIVAL FELL!', '#5dff6a', 1.2);
    }
  }

  function laps(c) {
    const done = Math.floor((c.z - c.startZ) / track.len);
    while (c.lapsDone < done && c.lapsDone < CFG.LAPS) {
      const lt = (t - c.lapStart) * 1000;
      c.lapTimes.push(lt);
      if (!c.bestLap || lt < c.bestLap) c.bestLap = lt;
      c.lapStart = t;
      c.lapsDone++;
      if (c === player && mode === 'race' && c.lapsDone < CFG.LAPS) {
        flash(c.lapsDone === CFG.LAPS - 1 ? 'FINAL LAP' : `LAP ${c.lapsDone + 1}`, '#ffd23a', 1.2);
      }
    }
  }

  const COAST = { accel: false, brake: true, boost: false };

  function simStep(dt) {
    t += dt;
    let pin = Input.state;
    if (mode === 'ending') pin = COAST;
    else if (autopilot) pin = AI.controls(player, ai, track, t, 1);
    Physics.step(player, pin, track, t, dt, onEvent);
    if (ai) {
      Physics.step(ai, AI.controls(ai, player, track, t, aiSkill), track, t, dt, onEvent);
      Physics.collide(player, ai, track, onEvent);
    }
    laps(player);
    if (ai) laps(ai);
    if (mode === 'race') checkEnd();
    else if (mode === 'ending' && (endTimer -= dt) <= 0) finishRace();
  }

  function checkEnd() {
    let winner = null, reason = null;
    if (player.wrecked) { winner = ai ? 'ai' : 'none'; reason = 'wrecked'; }
    else if (ai && ai.wrecked) { winner = 'player'; reason = 'opponentWrecked'; }
    else if (player.lapsDone >= CFG.LAPS) { winner = ai ? 'player' : 'none'; reason = 'finished'; }
    else if (ai && ai.lapsDone >= CFG.LAPS) { winner = 'ai'; reason = 'finished'; }
    if (!winner) return;
    endInfo = { winner, reason };
    mode = 'ending';
    endTimer = 2.6;
    flashT = 0;
  }

  function endMessage() {
    const e = endInfo;
    if (e.reason === 'wrecked') return { text: 'WRECKED!', color: '#ff5040' };
    if (e.winner === 'player') return { text: e.reason === 'opponentWrecked' ? 'RIVAL WRECKED' : 'YOU WIN!', color: '#5dff6a' };
    if (e.winner === 'ai') return { text: 'YOU LOSE', color: '#ff5040' };
    return { text: 'FINISHED', color: '#ffd23a', sub: player.bestLap ? `Best lap ${(player.bestLap / 1000).toFixed(2)}s` : '' };
  }

  function finishRace(forfeit) {
    mode = 'menu';
    Audio.silence();
    const res = {
      winner: endInfo.winner, reason: endInfo.reason,
      playerName: league.playerName,
      opponentName: ai ? opponentName(league.division, oppIndex) : '',
      playerTimes: player.lapTimes.slice(), aiTimes: ai ? ai.lapTimes.slice() : [],
      practice, league,
    };
    if (!practice && ai) {
      scoreRace(endInfo.winner === 'player', forfeit);
      league.seasonHoles = player.holes.slice();
      league.racesPlayed++;
      res.league = JSON.parse(JSON.stringify(league));   // snapshot before any season reset
      if (league.racesPlayed >= 4) pendingLeague = endSeason();
      save();
    }
    UI.show('result', res);
  }

  function scoreRace(playerWon, forfeit) {
    const oi = 1 + oppIndex;
    league.points[playerWon ? 0 : oi] += 2;
    if (!forfeit) {
      const pb = player.bestLap || Infinity, ab = ai.bestLap || Infinity;
      if (pb < ab) league.points[0] += 1;
      else if (ab < pb) league.points[oi] += 1;
    }
    // The two rivals race each other after the 2nd and 4th fixtures
    if (league.racesPlayed % 2 === 1) {
      const bWins = Math.random() < 0.58;
      league.points[bWins ? 2 : 1] += 2;
      league.points[Math.random() < 0.55 ? 2 : 1] += 1;
    }
  }

  function endSeason() {
    const pts = league.points.slice();
    const snapshot = JSON.parse(JSON.stringify(league));
    const order = [0, 1, 2].sort((a, b) => (pts[b] - pts[a]) || (a === 0 ? -1 : b === 0 ? 1 : 0));
    const rank = order.indexOf(0);
    const oldDivision = league.division;
    let promoted = false, relegated = false;
    if (rank === 0 && league.division !== 5) {
      promoted = true;
      league.division = league.division === 1 ? 5 : league.division - 1;
    } else if (rank === 2 && league.division < 4) {
      relegated = true;
      league.division += 1;
    }
    league.season++;
    league.points = [0, 0, 0];
    league.racesPlayed = 0;
    if (league.division === 4) league.seasonHoles = [];   // Division 4 repairs the car
    return { league: snapshot, finalPoints: pts, oldDivision, promoted, relegated };
  }

  // ---- Main loop -------------------------------------------------------------
  function currentMsg() {
    if (mode === 'countdown') return { text: countdown > 0 ? String(Math.ceil(countdown)) : 'GO!', color: '#ffd23a' };
    if (mode === 'ending' && endInfo) return endMessage();
    if (player && player.state === 'respawn') return { text: 'RECOVERING', color: '#ffd23a', sub: 'Crane is lifting you back' };
    if (flashT > 0) return flashMsg;
    return null;
  }

  function frame(now) {
    const dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    if (!frozen) {
      if (mode === 'countdown') {
        countdown -= dt * timeScale;
        const c = Math.ceil(countdown);
        if (c !== lastBeep) { lastBeep = c; Audio.beep(c <= 0); }
        if (countdown <= 0) { mode = 'race'; flash('GO!', '#5dff6a', 0.8); }
      } else if (mode === 'race' || mode === 'ending') {
        acc += dt * timeScale;
        let n = 0;
        const maxN = 24 * timeScale;
        while (acc >= STEP && n++ < maxN) { simStep(STEP); acc -= STEP; }
        if (n >= maxN) acc = 0;
      }
      if (flashT > 0) flashT -= dt;
    }

    const racing = mode === 'race' || mode === 'ending' || mode === 'countdown';
    if (racing && player) {
      Audio.update({ mph: Math.max(0, player.speed) * CFG.MPH, boost: player.boosting, airborne: player.state === 'air' });
    }

    const show = mode !== 'menu' && track && player;
    Renderer.render({
      track: show ? track : null,
      player, ai, t, dt: frozen || mode === 'paused' ? 0 : dt,
      msg: show ? currentMsg() : null,
      lapMs: player ? (t - player.lapStart) * 1000 : 0,
    });
    requestAnimationFrame(frame);
  }

  function start() {
    lastNow = performance.now();
    requestAnimationFrame(frame);
  }

  // ---- Debug hooks (used by tools/shots.js) ---------------------------------
  const _debug = {
    start(id, prac) { startRace(id, prac !== false); },
    go() { countdown = 0; mode = 'race'; },
    set autopilot(v) { autopilot = !!v; },
    set frozen(v) { frozen = !!v; },
    set timeScale(v) { timeScale = Math.max(0.1, Number(v) || 1); },
    place(car, z, opts) {
      const c = car === 'ai' ? ai : player;
      c.z = z; c.vy = 0; c.state = 'ground';
      const g = Track.ground(track, z, t);
      c.y = g.h; c.pitch = Math.atan(g.slope);
      Object.assign(c, opts || {});
    },
    setTime(v) { t = v; },
    get info() {
      return { mode, t, trackId, player: player && { z: player.z, x: player.x, y: player.y, speed: player.speed, state: player.state, crack: player.crack, lapsDone: player.lapsDone, falls: player.falls },
        ai: ai && { z: ai.z, x: ai.x, speed: ai.speed, state: ai.state, crack: ai.crack, lapsDone: ai.lapsDone } };
    },
    league,
  };

  return { init, start, _debug };
})();
