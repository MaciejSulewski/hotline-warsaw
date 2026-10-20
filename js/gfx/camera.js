(function (HW) {
  'use strict';

  const W = 480, H = 270;
  const LOOK = 0.4;      // Shift look-ahead: fraction of (cursor - player)
  const FOLLOW = 12;     // follow stiffness (1/s)
  const SHAKE_DECAY = 10;

  // x, y: world point at the screen centre; ox, oy: shake offset (draw only, not aim).
  function create() {
    return { x: 0, y: 0, shake: 0, ox: 0, oy: 0, snapped: false, cursor: null };
  }

  function scaleFor(winW, winH) {
    return Math.max(1, Math.min(Math.floor(winW / W), Math.floor(winH / H)));
  }

  function update(cam, world, input, dt) {
    const p = world.player;
    let tx = p.x, ty = p.y;
    if (input && input.look) {
      tx += (input.aim.x - p.x) * LOOK;
      ty += (input.aim.y - p.y) * LOOK;
    }
    if (!cam.snapped) {
      cam.x = tx; cam.y = ty; cam.snapped = true;
    } else {
      const k = 1 - Math.exp(-FOLLOW * dt);
      cam.x += (tx - cam.x) * k;
      cam.y += (ty - cam.y) * k;
    }
    cam.shake *= Math.exp(-SHAKE_DECAY * dt);
    if (cam.shake < 0.2) cam.shake = 0;
    cam.ox = cam.shake ? Math.round((Math.random() * 2 - 1) * cam.shake) : 0;
    cam.oy = cam.shake ? Math.round((Math.random() * 2 - 1) * cam.shake) : 0;
  }

  function screenToWorld(cam, sx, sy) {
    return { x: sx - W / 2 + cam.x, y: sy - H / 2 + cam.y };
  }

  function shake(cam, amount) { cam.shake = Math.max(cam.shake, amount); }

  HW.camera = { W, H, create, scaleFor, update, screenToWorld, shake };
})(globalThis.HW);
