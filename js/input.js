'use strict';

const Input = (() => {
  const state = {
    left: false,
    right: false,
    accel: false,
    brake: false,
    boost: false,
  };

  // Keyboard
  const keyMap = {
    ArrowLeft: 'left', KeyZ: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyX: 'right', KeyD: 'right',
    ArrowUp: 'accel', KeyK: 'accel',
    ArrowDown: 'brake', KeyL: 'brake',
    Space: 'boost', Enter: 'boost', ShiftLeft: 'boost',
  };

  document.addEventListener('keydown', e => {
    const action = keyMap[e.code];
    if (action) { state[action] = true; e.preventDefault(); }
  });
  document.addEventListener('keyup', e => {
    const action = keyMap[e.code];
    if (action) { state[action] = false; }
  });

  // Touch buttons
  function bindBtn(id, action) {
    const el = document.getElementById(id);
    if (!el) return;

    const on = () => { state[action] = true; el.classList.add('active'); };
    const off = () => { state[action] = false; el.classList.remove('active'); };

    el.addEventListener('touchstart', e => { e.preventDefault(); on(); }, { passive: false });
    el.addEventListener('touchend',   e => { e.preventDefault(); off(); }, { passive: false });
    el.addEventListener('touchcancel',e => { e.preventDefault(); off(); }, { passive: false });
    el.addEventListener('mousedown',  e => { e.preventDefault(); on(); });
    el.addEventListener('mouseup',    e => { e.preventDefault(); off(); });
    el.addEventListener('mouseleave', e => { off(); });
  }

  function init() {
    bindBtn('btn-left',  'left');
    bindBtn('btn-right', 'right');
    bindBtn('btn-accel', 'accel');
    bindBtn('btn-brake', 'brake');
    bindBtn('btn-boost', 'boost');
  }

  return { state, init };
})();
