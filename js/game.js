'use strict';

const Game = (() => {
  // ── State ──────────────────────────────────────────────────────────────
  let screen = 'title';   // title | main | setup | race | result | league
  let practice = false;
  let currentTrackId = null;
  let trackSegs = null;
  let player = null;
  let aiCar  = null;
  let aiState = null;
  let raceStart = 0;
  let lastTime = 0;
  let raceRound = 0;  // 0-3, two races per opponent per season
  let currentOpponent = 0; // 0 or 1 (two opponents per division)

  const league = {
    playerName: 'DRIVER',
    division:   4,
    season:     1,
    points:     [0, 0, 0],  // [player, ai0, ai1]
    seasonHoles: [],
    racesPlayed: 0,
  };

  // ── Init ───────────────────────────────────────────────────────────────
  function init() {
    loadSave();
    UI.init(document.getElementById('menu'), handleAction);
    UI.show('title', { playerName: league.playerName });
  }

  // ── Saved data ─────────────────────────────────────────────────────────
  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem('scr_save') || 'null');
      if (s && s.version === 1) {
        Object.assign(league, s.league);
      }
    } catch (_) {}
  }

  function save() {
    try {
      localStorage.setItem('scr_save', JSON.stringify({ version: 1, league }));
    } catch (_) {}
  }

  // ── Action handler (from UI) ───────────────────────────────────────────
  function handleAction(action, data) {
    Audio.resume();

    switch (action) {
      case 'start':
        league.playerName = data.name;
        save();
        screen = 'main';
        UI.show('main', { league });
        break;

      case 'race':
        practice = data.practice;
        pickNextTrack();
        screen = 'setup';
        UI.show('setup', { league, trackId: currentTrackId, practice });
        break;

      case 'go':
        currentTrackId = data.trackId;
        practice = data.practice;
        startRace();
        break;

      case 'back':
        screen = 'main';
        UI.show('main', { league });
        break;

      case 'continue':
        if (screen === 'league') {
          screen = 'main';
          UI.show('main', { league });
        } else {
          screen = 'main';
          UI.show('main', { league });
        }
        break;

      case 'newseason':
        newSeason();
        break;

      case 'restart':
        // Re-try current track
        if (currentTrackId) startRace();
        else { screen = 'main'; UI.show('main', { league }); }
        break;
    }
  }

  function pickNextTrack() {
    const divTracks = DIVISION_TRACKS[league.division] || DIVISION_TRACKS[4];
    // Alternate tracks per race round
    currentTrackId = divTracks[league.racesPlayed % divTracks.length];
  }

  // ── Race setup ─────────────────────────────────────────────────────────
  function startRace() {
    const trackInfo = TRACKS[currentTrackId];
    if (!trackInfo) return;
    trackSegs = trackInfo.segs;

    player = Physics.createCar(false);
    aiCar  = Physics.createCar(true);
    Physics.resetForRace(player, practice ? [] : league.seasonHoles);
    Physics.resetForRace(aiCar, []);

    aiState = AI.createAI(currentTrackId);
    raceStart = Date.now();
    player.lapStartTime = raceStart;
    aiCar.lapStartTime  = raceStart;

    screen = 'race';
    UI.hide();
    lastTime = performance.now();
  }

  // ── Game loop ──────────────────────────────────────────────────────────
  function tick(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05); // cap at 50ms
    lastTime = now;

    if (screen === 'race') {
      updateRace(dt);
    }

    const state = buildRenderState(dt);
    Renderer.render(state);

    requestAnimationFrame(tick);
  }

  function buildRenderState(dt) {
    return {
      screen,
      dt,
      player:    player   || Physics.createCar(false),
      ai:        aiCar    || Physics.createCar(true),
      trackSegs: trackSegs || [],
      trackInfo: TRACKS[currentTrackId],
      elapsed:   player ? (Date.now() - player.lapStartTime) : 0,
    };
  }

  function updateRace(dt) {
    // Input
    const inp = Input.state;

    // Update cars
    Physics.update(player, inp, trackSegs, dt);
    AI.update(aiCar, player, trackSegs, aiState, dt);

    // Audio
    Audio.update(player.speed, player.boost, player.boostActive);

    // Race-end conditions
    const raceOver = player.finished || player.destroyed ||
                     aiCar.finished  || aiCar.destroyed;

    if (raceOver) {
      endRace();
    }
  }

  function endRace() {
    screen = 'result';
    const playerWon = !player.destroyed && (
      player.finished && !aiCar.finished ||
      player.finished && aiCar.destroyed ||
      aiCar.destroyed && !player.destroyed
    );

    let promoted = false, relegated = false;

    if (!practice) {
      // Award points (3 for win, 1 for loss)
      const opponentIdx = (currentOpponent % 2) + 1;
      if (playerWon) {
        league.points[0] += 3;
      } else {
        league.points[opponentIdx] += 3;
        league.points[0] += 1;
      }

      // Carry over permanent holes to season damage
      if (league.division > 4) {
        // Merge new holes with season holes
        const newHoles = player.holes.slice();
        league.seasonHoles = mergeHoles(league.seasonHoles, newHoles);
      }

      league.racesPlayed++;

      // After 4 races (full season), do promotion/relegation
      if (league.racesPlayed >= 4) {
        const result = endSeason();
        promoted  = result.promoted;
        relegated = result.relegated;
        save();

        UI.show('league', { league });
        setTimeout(() => {
          screen = 'league';
        }, 100);
        return;
      }

      // Rotate opponent
      currentOpponent = (currentOpponent + 1) % 2;
    }

    save();

    UI.show('result', {
      winner:      playerWon ? 'player' : 'ai',
      playerName:  league.playerName,
      playerTimes: player.lapTimes,
      aiTimes:     aiCar.lapTimes,
      practice,
      league,
      promoted,
      relegated,
    });
  }

  function mergeHoles(existing, newHoles) {
    const combined = [...existing, ...newHoles];
    combined.sort((a, b) => a - b);
    // Deduplicate close holes
    const result = [];
    for (const h of combined) {
      if (!result.length || Math.abs(result[result.length - 1] - h) > 0.05) {
        result.push(h);
      }
    }
    return result.slice(0, 8); // max 8 holes
  }

  function endSeason() {
    const pts = league.points;
    const sorted = [0, 1, 2].sort((a, b) => pts[b] - pts[a]);
    const playerRank = sorted.indexOf(0); // 0=first, 2=last

    let promoted = false, relegated = false;

    if (playerRank === 0) {
      // Promoted
      promoted = true;
      if (league.division === 1) {
        // Enter Super League
        league.division = 5;
      } else if (league.division < 5) {
        league.division = Math.max(1, league.division - 1);
      }
    } else if (playerRank === 2) {
      // Relegated
      relegated = true;
      if (league.division < 4) {
        league.division = Math.min(4, league.division + 1);
      }
    }

    // Reset season
    league.points     = [0, 0, 0];
    league.racesPlayed = 0;
    league.season++;

    // Repair season holes only in Division 4
    if (league.division >= 4) {
      league.seasonHoles = [];
    }

    return { promoted, relegated };
  }

  function newSeason() {
    league.points     = [0, 0, 0];
    league.racesPlayed = 0;
    league.season++;
    // Div 4: repair car
    if (league.division >= 4) league.seasonHoles = [];
    save();
    screen = 'main';
    UI.show('main', { league });
  }

  // ── Start ──────────────────────────────────────────────────────────────
  function start() {
    requestAnimationFrame(tick);
  }

  return { init, start };
})();
