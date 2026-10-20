(function (HW) {
  'use strict';

  const MASK = 'lajkonik';

  function overlay(ctx, lines, color) {
    const F = HW.font, W = HW.camera.W, H = HW.camera.H;
    const h = lines.length * 18 + 10;
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = HW.palette.black;
    ctx.fillRect(0, (H - h) / 2, W, h);
    ctx.restore();
    lines.forEach((l, i) => F.draw(ctx, l, W / 2, (H - h) / 2 + 8 + i * 18, color, 2, 'center'));
  }

  function drawErrors(ctx, errors) {
    ctx.fillStyle = HW.palette.black;
    ctx.fillRect(0, 0, HW.camera.W, HW.camera.H);
    HW.font.draw(ctx, 'BŁĄD POZIOMU:', 8, 8, HW.palette.magenta);
    errors.slice(0, 20).forEach((e, i) => HW.font.draw(ctx, e.slice(0, 78), 8, 22 + i * 11, HW.palette.white));
  }

  // Minimal PLAYING-only boot for the playable slice; full UI flow arrives in Task 14.
  function boot() {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    canvas.width = HW.camera.W; canvas.height = HW.camera.H;
    const input = HW.input.attach(canvas);
    const sprites = HW.sprites.build();
    const fx = HW.fx.create();
    const cam = HW.camera.create();
    cam.cursor = input.mouse;
    const level = HW.levels.blok;
    const errors = HW.levels.validate(level);
    const state = { world: null, error: null, errors, t: 0, last: HW.sim.emptyInput() };
    HW.main.state = state;

    function resize() {
      const s = HW.camera.scaleFor(globalThis.innerWidth, globalThis.innerHeight);
      canvas.style.width = HW.camera.W * s + 'px';
      canvas.style.height = HW.camera.H * s + 'px';
      ctx.imageSmoothingEnabled = false;
    }

    function restart() {
      state.world = HW.world.load(level, MASK, (Math.random() * 1e9) | 0);
      state.error = null;
      state.last = HW.sim.emptyInput();
      HW.fx.clearDecals(fx);
      cam.snapped = false;
      HW.camera.update(cam, state.world, null, 0);
    }

    function update(dt) {
      state.t += dt;
      if (input.keyPressed('KeyR') && !errors.length) restart();
      if (state.error || errors.length) return;
      const world = state.world;
      HW.fx.update(fx, dt);
      if (!HW.fx.hitStop(fx)) {
        state.last = input.sample(cam);
        HW.sim.step(world, state.last, dt);
        HW.fx.consume(fx, world.events, cam);
        world.events.length = 0;
      }
      HW.camera.update(cam, world, state.last, dt);
    }

    function render() {
      if (errors.length) { drawErrors(ctx, errors); return; }
      if (state.error) { overlay(ctx, ['ERROR — PRESS R'], HW.palette.magenta); return; }
      HW.renderer.draw(ctx, state.world, cam, fx, sprites, state.t);
      const st = state.world.status;
      if (st === 'dead') overlay(ctx, ['NIE ŻYJESZ — R'], HW.palette.magenta);
      else if (st === 'cleared') HW.font.draw(ctx, 'WRACAJ DO AUTA', HW.camera.W / 2, 8, HW.palette.cyan, 1, 'center');
      else if (st === 'won') overlay(ctx, ['POZIOM UKOŃCZONY', 'R — JESZCZE RAZ'], HW.palette.cyan);
    }

    function onError(err) {
      if (!state.error) console.error(err);
      state.error = err;
    }

    globalThis.addEventListener('resize', resize);
    resize();
    if (!errors.length) restart();
    HW.loop.start(update, render, onError);
  }

  HW.main = { boot, state: null };
  if (typeof document !== 'undefined') boot();
})(globalThis.HW);
