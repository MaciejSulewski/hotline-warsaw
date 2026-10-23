(function (HW) {
  'use strict';

  const HIT_STOP = 0.04;
  const FLASH_LIFE = 0.05;
  const FADE = 0.2; // floor-change fade-in (spec §7)

  // Presentation-only effects; randomness here is cosmetic (Math.random), never simulation.
  // splats: queued blood, painted onto fx.decals[floorIndex] (persistent canvases) by the renderer.
  function create() {
    return { hit: 0, fade: 0, flashes: [], particles: [], splats: [], decals: {} };
  }

  function splat(x, y, big) {
    const drops = [];
    const n = big ? 14 : 5;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * (big ? 12 : 6);
      drops.push({ dx: Math.cos(a) * d, dy: Math.sin(a) * d, r: 1 + Math.random() * (big ? 3 : 1.5) });
    }
    return { x, y, drops };
  }

  function burst(fx, x, y, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random());
      fx.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.25 + Math.random() * 0.25 });
    }
  }

  function consume(fx, events, cam) {
    const C = HW.camera;
    for (const e of events) {
      switch (e.type) {
        case 'shot':
          fx.flashes.push({ x: e.x, y: e.y, angle: e.angle, life: FLASH_LIFE });
          C.shake(cam, e.weapon === 'shotgun' ? 4 : 2);
          break;
        case 'kill':
          fx.splats.push(splat(e.x, e.y, true));
          burst(fx, e.x, e.y, 10, 90);
          fx.hit = HIT_STOP;
          C.shake(cam, 4);
          break;
        case 'melee':
          fx.splats.push(splat(e.x, e.y, false));
          burst(fx, e.x, e.y, 4, 60);
          C.shake(cam, 2);
          break;
        case 'death': C.shake(cam, 6); break;
        case 'door': case 'knockdown': case 'shieldbreak': C.shake(cam, 1.5); break;
        case 'floor': cam.snapped = false; fx.fade = FADE; break; // camera cut + short fade on stairs
        default: break;
      }
    }
  }

  function update(fx, dt) {
    fx.hit = Math.max(0, fx.hit - dt);
    if (fx.hit < 1e-9) fx.hit = 0;
    fx.fade = Math.max(0, fx.fade - dt);
    if (fx.fade < 1e-9) fx.fade = 0;
    for (const f of fx.flashes) f.life -= dt;
    fx.flashes = fx.flashes.filter((f) => f.life > 0);
    for (const p of fx.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(0.02, dt); p.vy *= Math.pow(0.02, dt);
      p.life -= dt;
    }
    fx.particles = fx.particles.filter((p) => p.life > 0);
  }

  function hitStop(fx) { return fx.hit > 0; }

  function clearDecals(fx) {
    fx.decals = {};
    fx.splats = [];
    fx.particles = [];
    fx.flashes = [];
    fx.hit = 0;
    fx.fade = 0;
  }

  HW.fx = { FADE, create, consume, update, hitStop, clearDecals };
})(globalThis.HW);
