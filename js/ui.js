'use strict';

// Menu/UI system: builds the overlay screens and reports user actions via onAction(action, data).
const UI = (() => {
  let menuEl = null;
  let onAction = () => {};

  // Driver names per division (5 = Super League)
  const DIVISION_DRIVERS = {
    4: ['Mad Dog Miller', 'Turbo Tim'],
    3: ['Big Ramp Randy', 'Crusher Cole'],
    2: ['Danger Dan', 'Iron Mike'],
    1: ['The Beast', 'King Crusher'],
    5: ['Champion Rex', 'Super Dave'],  // Super League
  };

  function init(menuElement, actionCallback) {
    menuEl = menuElement;
    onAction = typeof actionCallback === 'function' ? actionCallback : () => {};
  }

  // ---- helpers ----
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function divName(d) {
    return Number(d) === 5 ? 'Super League' : `Division ${d}`;
  }

  function driversFor(div) {
    return DIVISION_DRIVERS[div] || DIVISION_DRIVERS[4];
  }

  function tracks() {
    return (typeof TRACKS !== 'undefined' && TRACKS) || {};
  }

  function fmtTime(ms) {
    return Number.isFinite(ms) && ms > 0 ? (ms / 1000).toFixed(2) + 's' : '—';
  }

  function sumTimes(times) {
    return (times || []).length ? times.reduce((a, b) => a + b, 0) : NaN;
  }

  function bind(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  }

  function setContent(html) {
    menuEl.innerHTML = `<div class="menu-section">${html}</div>`;
  }

  // Standings rows sorted by points; ties keep the player first.
  function standings(league, drivers, pts) {
    const p = pts || [0, 0, 0];
    return [
      { name: (league && league.playerName) || 'DRIVER', pts: p[0] || 0, isPlayer: true },
      { name: drivers[0], pts: p[1] || 0 },
      { name: drivers[1], pts: p[2] || 0 },
    ].sort((a, b) => b.pts - a.pts);
  }

  // ---- public API ----
  function show(screen, data) {
    if (!menuEl) return;
    data = data || {};
    menuEl.classList.remove('hidden');
    menuEl.scrollTop = 0;

    // Touch controls and the pause button are not used on menu screens
    const ctrlEl = document.getElementById('controls');
    if (ctrlEl) ctrlEl.style.display = 'none';
    const pauseEl = document.getElementById('btn-pause');
    if (pauseEl) pauseEl.style.display = 'none';

    switch (screen) {
      case 'title':  renderTitle(data);  break;
      case 'main':   renderMain(data);   break;
      case 'setup':  renderSetup(data);  break;
      case 'result': renderResult(data); break;
      case 'league': renderLeague(data); break;
      case 'pause':  renderPause(data);  break;
      default: menuEl.innerHTML = ''; break;
    }
  }

  function hide() {
    if (menuEl) {
      menuEl.classList.add('hidden');
      menuEl.innerHTML = '';
    }
    const ctrlEl = document.getElementById('controls');
    if (ctrlEl) ctrlEl.style.display = 'flex';
    const pauseEl = document.getElementById('btn-pause');
    if (pauseEl) pauseEl.style.display = 'block';
  }

  // ---- TITLE ----
  function renderTitle(data) {
    setContent(`
      <div class="menu-title">SKYWAY STUNTS</div>
      <div class="menu-subtitle">Elevated track racing</div>
      <input id="name-input" class="name-input" type="text" maxlength="12"
             autocomplete="off" autocapitalize="characters" spellcheck="false"
             placeholder="ENTER NAME" value="${esc(data.playerName || '')}" />
      <button class="menu-btn" id="start-btn">START</button>
      <div class="menu-info">Hold ACCEL to go · BOOST for turbo · BRK to slow</div>
      <div class="menu-info menu-info-dim">Keys: arrows/WASD steer · Up/K accel · Space boost · P pause</div>
    `);

    const input = document.getElementById('name-input');
    bind('start-btn', () => {
      const name = ((input && input.value) || '').trim().toUpperCase() || 'DRIVER';
      onAction('start', { name });
    });
    if (input) {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('start-btn').click();
      });
    }
  }

  // ---- MAIN MENU ----
  function renderMain(data) {
    const league = data.league || {};
    const div = Number(league.division) || 4;
    const racesPlayed = Number(league.racesPlayed) || 0;
    const raceLabel = racesPlayed >= 4 ? 'Season complete' : `Race ${racesPlayed + 1} of 4`;

    const rows = standings(league, driversFor(div), league.points)
      .map((r, i) => `
        <tr class="${r.isPlayer ? 'player-row' : ''}">
          <td>${i + 1}</td><td>${esc(r.name)}</td><td>${r.pts}</td>
        </tr>`).join('');

    setContent(`
      <div class="menu-title menu-title-sm">${esc(league.playerName || 'DRIVER')}</div>
      <div class="menu-subtitle">${divName(div)} · Season ${esc(league.season)} · ${raceLabel}</div>
      <table class="league-table">
        <tr><th>Pos</th><th>Driver</th><th>Pts</th></tr>
        ${rows}
      </table>
      <div class="menu-actions">
        <button class="menu-btn" id="btn-race">RACE</button>
        <button class="menu-btn" id="btn-practice">PRACTICE</button>
        <button class="menu-btn menu-btn-alt" id="btn-newseason">NEW SEASON</button>
      </div>
    `);

    bind('btn-race',      () => onAction('race', { practice: false }));
    bind('btn-practice',  () => onAction('race', { practice: true }));
    bind('btn-newseason', () => onAction('newseason'));
  }

  // ---- RACE SETUP ----
  function renderSetup(data) {
    const practice = !!data.practice;
    const all = tracks();

    if (practice) {
      // Group track ids by division, highest division number (entry level) first.
      // Ids come from the TRACKS object, never hardcoded.
      const groups = {};
      Object.keys(all).forEach(id => {
        const d = all[id].div;
        (groups[d] = groups[d] || []).push(id);
      });
      const divs = Object.keys(groups).map(Number).sort((a, b) => b - a);

      const body = divs.map(d => `
        <div class="track-group">
          <div class="track-group-label">${divName(d)}</div>
          <div class="track-grid">
            ${groups[d].map(id => `
              <button class="menu-btn track-btn" data-track="${esc(id)}">${esc(all[id].name)}</button>
            `).join('')}
          </div>
        </div>`).join('');

      setContent(`
        <div class="menu-title menu-title-sm">PRACTICE</div>
        <div class="menu-subtitle">Pick a track · no league points</div>
        <div class="track-list">${body}</div>
        <button class="menu-btn menu-btn-alt" id="btn-back">← BACK</button>
      `);

      menuEl.querySelectorAll('[data-track]').forEach(btn => {
        btn.addEventListener('click', () =>
          onAction('go', { trackId: btn.getAttribute('data-track'), practice: true }));
      });
    } else {
      const track = all[data.trackId] || { name: data.trackId || 'TRACK', div: '', hint: '' };
      setContent(`
        <div class="menu-title menu-title-sm">${esc(track.name)}</div>
        <div class="menu-subtitle">${divName(track.div)} · vs ${esc(data.opponentName || 'AI Driver')}</div>
        <div class="menu-info track-hint">${esc(track.hint)}</div>
        <div class="menu-actions">
          <button class="menu-btn" id="btn-go">GO</button>
          <button class="menu-btn menu-btn-alt" id="btn-back">← BACK</button>
        </div>
      `);

      bind('btn-go', () => onAction('go', { trackId: data.trackId, practice: false }));
    }

    bind('btn-back', () => onAction('back'));
  }

  // ---- RACE RESULT ----
  function renderResult(data) {
    const practice = !!data.practice;
    const winner = data.winner;

    let title;
    let color = '#ffcc00';
    if (practice) {
      title = 'PRACTICE OVER';
    } else if (winner === 'player') {
      title = 'YOU WIN';
      color = '#44ff44';
    } else if (winner === 'ai') {
      title = 'YOU LOSE';
      color = '#ff4444';
    } else {
      title = 'NO RESULT';
    }

    let reason = '';
    if (data.reason === 'wrecked') reason = 'Your car was wrecked';
    else if (data.reason === 'opponentWrecked') reason = "Opponent's car was wrecked";
    else if (data.reason === 'finished') {
      if (practice) reason = 'Three laps completed';
      else if (winner === 'player') reason = 'You crossed the line first';
      else if (winner === 'ai') reason = 'Opponent crossed the line first';
    }

    const playerTimes = data.playerTimes || [];
    const aiTimes = data.aiTimes || [];
    const bestP = playerTimes.length ? Math.min(...playerTimes) : NaN;
    const bestA = aiTimes.length ? Math.min(...aiTimes) : NaN;

    const pointsLine = !practice && data.league && Array.isArray(data.league.points)
      ? `<div class="menu-info">Points: ${data.league.points[0]}</div>`
      : '';

    setContent(`
      <div class="menu-title menu-title-sm" style="color:${color}">${title}</div>
      <div class="menu-subtitle">${practice ? 'Practice run' : 'Season race'}${reason ? ' · ' + esc(reason) : ''}</div>
      <table class="league-table result-table">
        <tr><th>Driver</th><th>Laps</th><th>Best lap</th><th>Total</th></tr>
        <tr class="player-row">
          <td>${esc(data.playerName || 'YOU')}</td>
          <td>${playerTimes.length}</td>
          <td>${fmtTime(bestP)}</td>
          <td>${fmtTime(sumTimes(playerTimes))}</td>
        </tr>
        <tr>
          <td>${esc(data.opponentName || 'AI Driver')}</td>
          <td>${aiTimes.length}</td>
          <td>${fmtTime(bestA)}</td>
          <td>${fmtTime(sumTimes(aiTimes))}</td>
        </tr>
      </table>
      ${pointsLine}
      <button class="menu-btn" id="btn-continue">CONTINUE</button>
    `);

    bind('btn-continue', () => onAction('continue'));
  }

  // ---- END OF SEASON LEAGUE TABLE ----
  function renderLeague(data) {
    const league = data.league || {};
    const oldDiv = Number(data.oldDivision) || Number(league.division) || 4;
    const drivers = driversFor(oldDiv);
    const pts = data.finalPoints || league.points;   // league.points is already reset
    const promoted = !!data.promoted;
    const relegated = !!data.relegated;

    let banner;
    if (promoted) {
      const target = (oldDiv === 1 || oldDiv === 5) ? 5 : oldDiv - 1;
      banner = `<div class="banner banner-up">▲ PROMOTED to ${divName(target)}</div>`;
    } else if (relegated) {
      const target = Math.min(4, oldDiv + 1);
      banner = `<div class="banner banner-down">▼ RELEGATED to ${divName(target)}</div>`;
    } else {
      banner = `<div class="banner">Staying in ${divName(oldDiv)}</div>`;
    }

    const rows = standings(league, drivers, pts).map((r, i) => {
      let status = '';
      if (r.isPlayer && promoted) status = '<span class="up">▲ UP</span>';
      if (r.isPlayer && relegated) status = '<span class="down">▼ DOWN</span>';
      return `<tr class="${r.isPlayer ? 'player-row' : ''}">
        <td>${i + 1}</td><td>${esc(r.name)}</td><td>${r.pts}</td><td>${status}</td>
      </tr>`;
    }).join('');

    setContent(`
      <div class="menu-title menu-title-sm">${divName(oldDiv)}</div>
      <div class="menu-subtitle">End of season ${esc(league.season)}</div>
      ${banner}
      <table class="league-table">
        <tr><th>Pos</th><th>Driver</th><th>Pts</th><th>Status</th></tr>
        ${rows}
      </table>
      <button class="menu-btn" id="btn-ok">OK</button>
    `);

    bind('btn-ok', () => onAction('continue'));
  }

  // ---- PAUSE ----
  function renderPause() {
    setContent(`
      <div class="menu-title menu-title-sm">PAUSED</div>
      <div class="menu-actions">
        <button class="menu-btn" id="btn-resume">RESUME</button>
        <button class="menu-btn menu-btn-alt" id="btn-quit">QUIT RACE</button>
      </div>
    `);

    bind('btn-resume', () => onAction('resume'));
    bind('btn-quit',   () => onAction('quit'));
  }

  return { init, show, hide, DIVISION_DRIVERS };
})();
