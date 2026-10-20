(function (HW) {
  'use strict';

  const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

  // Keyboard + mouse listeners. "Pressed" flags latch until consumed: sample() clears the
  // fire/throw/execute latches; keyPressed(code) clears that key's latch.
  function attach(canvas) {
    const held = {};
    const latched = {};
    const mouse = { x: HW.camera.W / 2, y: HW.camera.H / 2 }; // canvas pixels
    let lmb = false, firePressed = false, throwPressed = false, executePressed = false;
    const on = (type, fn) => globalThis.addEventListener(type, fn);

    on('keydown', (e) => {
      if (!held[e.code] && !e.repeat) {
        latched[e.code] = true;
        if (e.code === 'Space') executePressed = true;
      }
      held[e.code] = true;
      if (PREVENT.has(e.code)) e.preventDefault();
    });
    on('keyup', (e) => { held[e.code] = false; });
    on('blur', () => { for (const k in held) held[k] = false; lmb = false; });
    on('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      mouse.x = (e.clientX - r.left) * HW.camera.W / r.width;
      mouse.y = (e.clientY - r.top) * HW.camera.H / r.height;
    });
    on('mousedown', (e) => {
      if (e.button === 0) { lmb = true; firePressed = true; }
      else if (e.button === 2) throwPressed = true;
      e.preventDefault();
    });
    on('mouseup', (e) => { if (e.button === 0) lmb = false; });
    on('contextmenu', (e) => e.preventDefault());

    const key = (...codes) => codes.some((c) => held[c]);

    function sample(cam) {
      const s = {
        move: {
          x: (key('KeyD', 'ArrowRight') ? 1 : 0) - (key('KeyA', 'ArrowLeft') ? 1 : 0),
          y: (key('KeyS', 'ArrowDown') ? 1 : 0) - (key('KeyW', 'ArrowUp') ? 1 : 0),
        },
        aim: HW.camera.screenToWorld(cam, mouse.x, mouse.y),
        fire: lmb, firePressed, throwPressed, executePressed,
        look: key('ShiftLeft', 'ShiftRight'),
      };
      firePressed = throwPressed = executePressed = false;
      return s;
    }

    function keyPressed(code) {
      const v = !!latched[code];
      latched[code] = false;
      return v;
    }

    return { sample, keyPressed, mouse };
  }

  HW.input = { attach };
})(globalThis.HW);
