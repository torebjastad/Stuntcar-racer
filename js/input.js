'use strict';

// Keyboard + multi-touch input. Touches are hit-tested every move, so a thumb
// can slide from one button to another (e.g. left → right) without lifting.
const Input = (() => {
  const state = { left: false, right: false, accel: false, brake: false, boost: false };
  let onPause = null;

  const keyMap = {
    ArrowLeft: 'left', KeyA: 'left', KeyZ: 'left',
    ArrowRight: 'right', KeyD: 'right', KeyX: 'right',
    ArrowUp: 'accel', KeyW: 'accel', KeyK: 'accel',
    ArrowDown: 'brake', KeyS: 'brake', KeyL: 'brake',
    Space: 'boost', ShiftLeft: 'boost', Enter: 'boost',
  };
  const keys = {};
  const BTN = { 'btn-left': 'left', 'btn-right': 'right', 'btn-accel': 'accel', 'btn-brake': 'brake', 'btn-boost': 'boost' };
  const touchHeld = { left: false, right: false, accel: false, brake: false, boost: false };
  let mouseAction = null;

  function recompute() {
    for (const a in state) state[a] = !!keys[a] || touchHeld[a] || mouseAction === a;
    for (const id in BTN) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('active', state[BTN[id]]);
    }
  }

  function actionAt(x, y) {
    let el = document.elementFromPoint(x, y);
    while (el && el !== document.body) {
      if (el.id && BTN[el.id]) return BTN[el.id];
      el = el.parentElement;
    }
    return null;
  }

  function onTouch(e) {
    e.preventDefault();
    for (const a in touchHeld) touchHeld[a] = false;
    for (const t of e.touches) {
      const a = actionAt(t.clientX, t.clientY);
      if (a) touchHeld[a] = true;
    }
    recompute();
  }

  function init() {
    document.addEventListener('keydown', e => {
      if (e.code === 'KeyP' || e.code === 'Escape') { if (onPause) onPause(); return; }
      const a = keyMap[e.code];
      if (a && !(e.target && e.target.tagName === 'INPUT')) { keys[a] = true; recompute(); e.preventDefault(); }
    });
    document.addEventListener('keyup', e => {
      const a = keyMap[e.code];
      if (a) { keys[a] = false; recompute(); }
    });
    window.addEventListener('blur', reset);

    const zone = document.getElementById('controls');
    if (zone) {
      for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
        zone.addEventListener(ev, onTouch, { passive: false });
      }
      zone.addEventListener('mousedown', e => { mouseAction = actionAt(e.clientX, e.clientY); recompute(); });
      window.addEventListener('mouseup', () => { mouseAction = null; recompute(); });
    }
    const pb = document.getElementById('btn-pause');
    if (pb) {
      const fire = e => { e.preventDefault(); e.stopPropagation(); if (onPause) onPause(); };
      pb.addEventListener('touchstart', fire, { passive: false });
      pb.addEventListener('click', fire);
    }
  }

  function reset() {
    for (const a in keys) keys[a] = false;
    for (const a in touchHeld) touchHeld[a] = false;
    mouseAction = null;
    recompute();
  }

  return {
    state, init, reset,
    set onPause(fn) { onPause = fn; },
  };
})();
