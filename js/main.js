(function (HW) {
  'use strict';

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

  // localStorage can throw on access (file:// in some browsers, privacy modes).
  function storage() {
    try { return globalThis.localStorage || null; } catch (e) { return null; }
  }

  function levelErrors() {
    const out = [];
    for (const id of HW.masks.levelOrder) {
      if (HW.levels[id]) for (const e of HW.levels.validate(HW.levels[id])) out.push(id + ': ' + e);
    }
    return out;
  }

  // Boot: HW.flow drives the screens; main reacts to flow state changes (world load, music,
  // results + save) and runs the simulation while playing.
  function boot() {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    canvas.width = HW.camera.W; canvas.height = HW.camera.H;
    const input = HW.input.attach(canvas);
    const sprites = HW.sprites.build();
    const fx = HW.fx.create();
    const cam = HW.camera.create();
    cam.cursor = input.mouse;
    const errors = levelErrors();
    const flow = HW.flow.create(HW.save.load(storage()));
    const state = {
      flow, error: null, errors, t: 0, last: HW.sim.emptyInput(), audio: false,
      get world() { return flow.world; },
    };
    HW.main.state = state;
    let lastMouse = { x: -1, y: -1 };

    function resize() {
      const s = HW.camera.scaleFor(globalThis.innerWidth, globalThis.innerHeight);
      canvas.style.width = HW.camera.W * s + 'px';
      canvas.style.height = HW.camera.H * s + 'px';
      ctx.imageSmoothingEnabled = false;
    }

    const level = () => HW.levels[flow.levelId];

    function restart() {
      flow.world = HW.world.load(level(), flow.maskId, (Math.random() * 1e9) | 0);
      state.error = null;
      state.last = HW.sim.emptyInput();
      HW.fx.clearDecals(fx);
      cam.snapped = false;
      cam.shake = 0;
      HW.camera.update(cam, flow.world, null, 0);
    }

    function startMusic() {
      if (state.audio && flow.state === 'playing') HW.music.start(level().music);
    }

    function dispatch(action) {
      const prev = flow.state;
      HW.flow.handle(flow, action);
      if (flow.state === prev) return;
      if (flow.state === 'playing') { restart(); startMusic(); }
      else if (flow.state === 'results') HW.music.muffle(true);
      else if (flow.state === 'levelSelect' && (prev === 'playing' || prev === 'results')) {
        HW.music.muffle(false);
        HW.music.stop();
      }
    }

    function finishLevel(world) {
      const fin = HW.scoring.finish(world.score, world.time, world.level.targetScore);
      const rec = HW.save.recordResult(flow.save, flow.levelId, fin.total, fin.grade);
      HW.save.store(storage(), rec.data);
      dispatch({
        type: 'won',
        results: Object.assign({}, fin, { newMasks: rec.newMasks, newLevel: rec.newLevel }),
        save: rec.data,
      });
    }

    // Reads every key latch each step (so none goes stale across screens).
    function readKeys() {
      const any = (...codes) => codes.map((c) => input.keyPressed(c)).some(Boolean);
      return {
        click: input.clickPressed(),
        confirm: any('Enter', 'NumpadEnter', 'Space'),
        back: any('Escape'),
        up: any('ArrowUp', 'KeyW'),
        down: any('ArrowDown', 'KeyS'),
        restart: any('KeyR'),
        mute: any('KeyM'),
      };
    }

    function updateMenus(k, dt) {
      input.sample(cam); // discard: keeps gameplay latches from going stale in menus
      for (const cue of HW.flow.update(flow, dt)) HW.sfx.play(cue);
      const m = input.mouse;
      if (m.x !== lastMouse.x || m.y !== lastMouse.y) {
        lastMouse = { x: m.x, y: m.y };
        const a = HW.screens.hitTest(flow, m.x, m.y);
        if (a && a.type === 'select') dispatch({ type: 'hover', id: a.id });
      }
      // At most one state change per frame: stop at the first action that changes the screen.
      const actions = [];
      if (k.click) { const a = HW.screens.hitTest(flow, m.x, m.y); if (a) actions.push(a); }
      if (k.up) actions.push({ type: 'move', dir: -1 });
      if (k.down) actions.push({ type: 'move', dir: 1 });
      if (k.confirm) actions.push({ type: 'confirm' });
      if (k.back) actions.push({ type: 'back' });
      HW.flow.handleFrame(flow, actions, (f, a) => dispatch(a));
    }

    function updatePlaying(k, dt) {
      if (k.back) { input.sample(cam); dispatch({ type: 'back' }); return; }
      if (k.restart) restart();
      const world = flow.world;
      HW.fx.update(fx, dt);
      if (!HW.fx.hitStop(fx)) {
        state.last = input.sample(cam);
        HW.sim.step(world, state.last, dt);
        HW.fx.consume(fx, world.events, cam);
        HW.sfx.onEvents(world.events);
        world.events.length = 0;
      }
      HW.camera.update(cam, world, state.last, dt);
      if (world.status === 'won') finishLevel(world);
    }

    function update(dt) {
      state.t += dt;
      const k = readKeys();
      if (k.mute) HW.synth.setMuted(!HW.synth.isMuted());
      if (errors.length) { input.sample(cam); return; }
      if (state.error) {
        input.sample(cam);
        if (k.restart) {
          state.error = null;
          if (flow.state === 'playing') restart();
        } else if (k.back) {
          state.error = null;
          dispatch({ type: 'abort' });
        }
        return;
      }
      if (flow.state === 'playing') updatePlaying(k, dt);
      else updateMenus(k, dt);
    }

    function render() {
      if (errors.length) { drawErrors(ctx, errors); return; }
      if (state.error) {
        ctx.fillStyle = HW.palette.black;
        ctx.fillRect(0, 0, HW.camera.W, HW.camera.H);
        overlay(ctx, ['ERROR — PRESS R'], HW.palette.magenta);
        return;
      }
      if (flow.state === 'playing' && flow.world) {
        HW.renderer.draw(ctx, flow.world, cam, fx, sprites, state.t);
        HW.hud.draw(ctx, flow.world, cam);
      } else {
        HW.screens.draw(ctx, flow, state.t, { sprites, cursor: input.mouse });
      }
    }

    function onError(err) {
      if (!state.error) console.error(err);
      state.error = err;
    }

    // Audio needs a user gesture. Browsers may leave the context suspended after the first one,
    // so every gesture retries resume() until the context reports 'running'.
    function onAudioReady() {
      if (state.audio) return;
      state.audio = true;
      globalThis.removeEventListener && globalThis.removeEventListener('pointerdown', startAudio);
      globalThis.removeEventListener && globalThis.removeEventListener('keydown', startAudio);
      startMusic();
    }
    function startAudio() {
      if (state.audio || !HW.synth.init()) return;
      const ac = HW.synth.ctx();
      if (ac.state === 'running') { onAudioReady(); return; }
      try {
        const p = ac.resume && ac.resume();
        if (p && p.then) p.then(() => { if (ac.state === 'running') onAudioReady(); }, () => {});
      } catch (e) { /* retry on the next gesture */ }
    }
    globalThis.addEventListener('pointerdown', startAudio);
    globalThis.addEventListener('keydown', startAudio);

    globalThis.addEventListener('resize', resize);
    resize();
    HW.loop.start(update, render, onError);
  }

  HW.main = { boot, state: null };
  if (typeof document !== 'undefined') boot();
})(globalThis.HW);
