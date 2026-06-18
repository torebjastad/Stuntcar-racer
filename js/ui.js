'use strict';

// Menu/UI system — manages screen transitions and DOM content
const UI = (() => {
  let menuEl;
  let onAction; // callback: fn(action, data)

  // Driver names per division
  const DIVISION_DRIVERS = {
    4: ['Mad Dog Miller', 'Turbo Tim'],
    3: ['Big Ramp Randy', 'Crusher Cole'],
    2: ['Danger Dan', 'Iron Mike'],
    1: ['The Beast', 'King Crusher'],
    5: ['Champion Rex', 'Super Dave'],  // Super League
  };

  function init(menuElement, actionCallback) {
    menuEl   = menuElement;
    onAction = actionCallback;
  }

  function show(screen, data) {
    menuEl.classList.remove('hidden');
    menuEl.innerHTML = '';
    const ctrlEl = document.getElementById('controls');
    if (ctrlEl) ctrlEl.style.display = 'none';

    switch (screen) {
      case 'title':   renderTitle(data);   break;
      case 'main':    renderMain(data);    break;
      case 'setup':   renderSetup(data);   break;
      case 'result':  renderResult(data);  break;
      case 'league':  renderLeague(data);  break;
      case 'gameover':renderGameOver(data);break;
    }
  }

  function hide() {
    menuEl.classList.add('hidden');
    const ctrlEl = document.getElementById('controls');
    if (ctrlEl) ctrlEl.style.display = 'flex';
  }

  // ---- TITLE SCREEN ----
  function renderTitle(data) {
    menuEl.innerHTML = `
      <div class="menu-section">
        <div class="menu-title">STUNT CAR<br>RACER</div>
        <div class="menu-subtitle">1989 · Geoff Crammond</div>
        <input id="name-input"
          style="background:#111;color:#fff;border:2px solid #555;padding:10px 16px;
                 font-family:monospace;font-size:16px;width:200px;text-align:center;
                 border-radius:4px;margin:8px 0;outline:none;"
          maxlength="12" placeholder="ENTER NAME" value="${data.playerName || ''}" />
        <button class="menu-btn" id="start-btn">START ENGINE</button>
        <div class="menu-info" style="margin-top:16px;">Division 4 · 3rd Place</div>
        <div class="menu-info">Hold ACCEL to go · BOOST for turbo</div>
      </div>`;

    document.getElementById('start-btn').addEventListener('click', () => {
      const name = (document.getElementById('name-input').value.trim() || 'DRIVER').toUpperCase();
      onAction('start', { name });
    });
    document.getElementById('name-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('start-btn').click();
    });
  }

  // ---- MAIN MENU ----
  function renderMain(data) {
    const { league, trackInfos } = data;
    const divName = league.division <= 4 ? `Division ${league.division}` : 'Super League';
    const drivers = DIVISION_DRIVERS[league.division] || DIVISION_DRIVERS[4];

    menuEl.innerHTML = `
      <div class="menu-section">
        <div class="menu-title" style="font-size:clamp(18px,4.5vw,32px);">${league.playerName}</div>
        <div class="menu-subtitle">${divName} · Season ${league.season}</div>

        <table class="league-table">
          <tr><th>Pos</th><th>Driver</th><th>Pts</th></tr>
          ${renderLeagueRows(league, drivers)}
        </table>

        <button class="menu-btn" id="btn-race">RACE</button>
        <button class="menu-btn" id="btn-practice">PRACTICE</button>
        <button class="menu-btn" id="btn-newseason" style="font-size:clamp(10px,2.5vw,14px);">NEW SEASON</button>
      </div>`;

    document.getElementById('btn-race').addEventListener('click', () =>
      onAction('race', { practice: false }));
    document.getElementById('btn-practice').addEventListener('click', () =>
      onAction('race', { practice: true }));
    document.getElementById('btn-newseason').addEventListener('click', () =>
      onAction('newseason'));
  }

  function renderLeagueRows(league, drivers) {
    const rows = [
      { name: league.playerName, pts: league.points[0], isPlayer: true },
      { name: drivers[0],        pts: league.points[1] },
      { name: drivers[1],        pts: league.points[2] },
    ].sort((a, b) => b.pts - a.pts);

    return rows.map((r, i) => `
      <tr class="${r.isPlayer ? 'player-row' : ''}">
        <td>${i+1}</td>
        <td>${r.name}</td>
        <td>${r.pts}</td>
      </tr>`).join('');
  }

  // ---- RACE SETUP ----
  function renderSetup(data) {
    const { league, trackId, practice } = data;
    const track = TRACKS[trackId];
    const mode  = practice ? 'PRACTICE' : 'RACE';

    menuEl.innerHTML = `
      <div class="menu-section">
        <div class="menu-title" style="font-size:clamp(16px,4vw,26px);">${track.name}</div>
        <div class="menu-subtitle">${mode} · Division ${track.div}</div>
        <div class="menu-info" style="color:#aaa;margin:8px 16px;font-size:clamp(9px,2.2vw,13px);">
          ${track.hint}
        </div>
        <div style="height:12px;"></div>
        <button class="menu-btn" id="btn-go">GO!</button>
        <button class="menu-btn" id="btn-back" style="font-size:clamp(10px,2.5vw,14px);">← BACK</button>
      </div>`;

    document.getElementById('btn-go').addEventListener('click', () =>
      onAction('go', { trackId, practice }));
    document.getElementById('btn-back').addEventListener('click', () =>
      onAction('back'));
  }

  // ---- RACE RESULT ----
  function renderResult(data) {
    const { winner, playerName, playerTimes, aiTimes, practice, league, promoted, relegated } = data;
    const playerWon = winner === 'player';
    const title = playerWon ? 'YOU WIN!' : 'YOU LOSE';
    const titleColor = playerWon ? '#44ff44' : '#ff4444';

    const fmtTime = ms => ms ? (ms / 1000).toFixed(2) + 's' : '—';
    const bestP = Math.min(...(playerTimes || [Infinity]));
    const bestA = Math.min(...(aiTimes || [Infinity]));

    let statusMsg = '';
    if (!practice) {
      if (promoted)  statusMsg = '<div style="color:#44ff44;margin:8px 0;">▲ PROMOTED!</div>';
      if (relegated) statusMsg = '<div style="color:#ff4444;margin:8px 0;">▼ RELEGATED</div>';
    }

    menuEl.innerHTML = `
      <div class="menu-section">
        <div class="menu-title" style="color:${titleColor}">${title}</div>
        <div class="menu-subtitle">${practice ? 'Practice run' : 'Season race'}</div>
        <table class="league-table" style="margin:12px 0;">
          <tr><th></th><th>Best Lap</th><th>Laps</th></tr>
          <tr class="player-row">
            <td>${playerName}</td>
            <td>${fmtTime(bestP)}</td>
            <td>${(playerTimes||[]).length}</td>
          </tr>
          <tr>
            <td>AI Driver</td>
            <td>${fmtTime(bestA)}</td>
            <td>${(aiTimes||[]).length}</td>
          </tr>
        </table>
        ${statusMsg}
        ${practice ? '' : `<div class="menu-info">Points: ${league ? league.points[0] : '—'}</div>`}
        <button class="menu-btn" id="btn-continue">CONTINUE</button>
      </div>`;

    document.getElementById('btn-continue').addEventListener('click', () =>
      onAction('continue'));
  }

  // ---- SEASON LEAGUE TABLE ----
  function renderLeague(data) {
    const { league } = data;
    const drivers = DIVISION_DRIVERS[league.division] || DIVISION_DRIVERS[4];
    const divName = league.division <= 4 ? `Division ${league.division}` : 'Super League';

    menuEl.innerHTML = `
      <div class="menu-section">
        <div class="menu-title" style="font-size:clamp(16px,4vw,26px);">${divName}</div>
        <div class="menu-subtitle">End of Season ${league.season}</div>
        <table class="league-table">
          <tr><th>Pos</th><th>Driver</th><th>Pts</th><th>Status</th></tr>
          ${renderEndSeasonRows(league, drivers)}
        </table>
        <button class="menu-btn" id="btn-ok">OK</button>
      </div>`;

    document.getElementById('btn-ok').addEventListener('click', () =>
      onAction('continue'));
  }

  function renderEndSeasonRows(league, drivers) {
    const rows = [
      { name: league.playerName, pts: league.points[0], isPlayer: true },
      { name: drivers[0],        pts: league.points[1] },
      { name: drivers[1],        pts: league.points[2] },
    ].sort((a, b) => b.pts - a.pts);

    return rows.map((r, i) => {
      let status = '';
      if (i === 0) status = '<span style="color:#44ff44">▲ UP</span>';
      if (i === 2) status = '<span style="color:#ff4444">▼ DOWN</span>';
      return `<tr class="${r.isPlayer ? 'player-row' : ''}">
        <td>${i+1}</td><td>${r.name}</td><td>${r.pts}</td><td>${status}</td>
      </tr>`;
    }).join('');
  }

  // ---- GAME OVER ----
  function renderGameOver(data) {
    menuEl.innerHTML = `
      <div class="menu-section">
        <div class="menu-title" style="color:#ff4444">GAME OVER</div>
        <div class="menu-subtitle">Car destroyed</div>
        <div class="menu-info" style="margin:16px 0;">${data.message || ''}</div>
        <button class="menu-btn" id="btn-restart">TRY AGAIN</button>
      </div>`;
    document.getElementById('btn-restart').addEventListener('click', () =>
      onAction('restart'));
  }

  return { init, show, hide, DIVISION_DRIVERS };
})();
