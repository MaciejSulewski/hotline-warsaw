'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadHW } = require('./helpers/load');

const HW = loadHW();
const L = HW.loop;
const Cam = HW.camera;
const MASK_IDS = ['lajkonik', 'bolek', 'lolek', 'czapka', 'kleks'];
const EPS = 1e-9;

// ---- DOM stubs ---------------------------------------------------------------
// A 2D context whose methods are no-ops and whose properties are settable.
function makeCtx(canvas, calls) {
  const props = { canvas };
  return new Proxy(props, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => { if (calls) calls.push(String(key)); return undefined; };
    },
    set(target, key, value) { target[key] = value; return true; },
  });
}
function makeCanvas(calls) {
  const listeners = {};
  const c = {
    width: 300, height: 150, style: {}, listeners,
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 540 }; },
  };
  const ctx = makeCtx(c, calls);
  c.getContext = () => ctx;
  return c;
}
// Browser-like environment; main.js boots into it and its rAF callbacks queue up for the test to run.
function makeEnv() {
  const calls = [];
  const game = makeCanvas(calls);
  const listeners = {};
  const env = {
    calls, game, listeners, frames: [], now: 0,
    document: {
      createElement: () => makeCanvas(),
      getElementById: (id) => (id === 'game' ? game : null),
    },
    size: { w: 1000, h: 600 },
    get innerWidth() { return env.size.w; },
    get innerHeight() { return env.size.h; },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    requestAnimationFrame(fn) { env.frames.push(fn); return env.frames.length; },
    performance: { now: () => env.now },
  };
  env.fire = (type, ev) => {
    const e = Object.assign({ preventDefault() {}, repeat: false }, ev);
    for (const fn of (listeners[type] || []).concat(game.listeners[type] || [])) fn(e);
  };
  env.tick = (ms = 1000 / 60) => {
    env.now += ms;
    const fns = env.frames.splice(0);
    for (const fn of fns) fn(env.now);
  };
  return env;
}

// ---- loop --------------------------------------------------------------------
test('stepsFor normal frame', () => {
  const r = L.stepsFor(0, 1 / 60);
  assert.equal(r.steps, 1);
  assert.ok(Math.abs(r.acc) < EPS);
});
test('stepsFor keeps remainder', () => {
  const r = L.stepsFor(0.01, 1 / 60);
  assert.equal(r.steps, 1);
  assert.ok(Math.abs(r.acc - 0.01) < EPS);
  const z = L.stepsFor(0, 0.005);
  assert.equal(z.steps, 0);
  assert.ok(Math.abs(z.acc - 0.005) < EPS);
});
test('stepsFor clamps', () => { const r = L.stepsFor(0, 3); assert.equal(r.steps, 5); assert.equal(r.acc, 0); });

// ---- camera ------------------------------------------------------------------
test('scaleFor', () => {
  assert.equal(Cam.scaleFor(1920, 1080), 4);
  assert.equal(Cam.scaleFor(300, 200), 1);
  assert.equal(Cam.scaleFor(1000, 600), 2);
  assert.equal(Cam.scaleFor(2000, 545), 2);
});
test('screenToWorld maps screen centre to camera point', () => {
  const cam = Cam.create();
  cam.x = 100; cam.y = 50;
  assert.deepEqual({ ...Cam.screenToWorld(cam, 240, 135) }, { x: 100, y: 50 });
  assert.deepEqual({ ...Cam.screenToWorld(cam, 0, 0) }, { x: -140, y: -85 });
});
test('camera snaps to player, then looks ahead 40% toward cursor with Shift', () => {
  const cam = Cam.create();
  const world = { player: { x: 100, y: 50 } };
  const input = HW.sim.emptyInput();
  input.aim = { x: 200, y: 50 };
  Cam.update(cam, world, input, 1 / 60);
  assert.equal(cam.x, 100); assert.equal(cam.y, 50);
  input.look = true;
  for (let i = 0; i < 300; i++) { input.aim = { x: 200, y: 50 }; Cam.update(cam, world, input, 1 / 60); }
  assert.ok(Math.abs(cam.x - 140) < 0.5, 'cam.x ' + cam.x);
});
test('camera follows a moving player', () => {
  const cam = Cam.create();
  const world = { player: { x: 0, y: 0 } };
  const input = HW.sim.emptyInput();
  Cam.update(cam, world, input, 1 / 60);
  world.player.x = 64;
  Cam.update(cam, world, input, 1 / 60);
  assert.ok(cam.x > 0 && cam.x < 64);
  for (let i = 0; i < 120; i++) Cam.update(cam, world, input, 1 / 60);
  assert.ok(Math.abs(cam.x - 64) < 0.5);
});
test('shake decays to zero', () => {
  const cam = Cam.create();
  const world = { player: { x: 0, y: 0 } };
  Cam.shake(cam, 6);
  Cam.shake(cam, 2);
  assert.equal(cam.shake, 6);
  for (let i = 0; i < 120; i++) Cam.update(cam, world, HW.sim.emptyInput(), 1 / 60);
  assert.equal(cam.shake, 0);
  assert.equal(cam.ox, 0); assert.equal(cam.oy, 0);
});

// ---- font --------------------------------------------------------------------
const REQUIRED = 'AĄBCĆDEĘFGHIJKLŁMNŃOÓPQRSŚTUVWXYZŹŻ0123456789 .,:!?-+%×/()\'"';
test('font covers required glyphs', () => { for (const ch of REQUIRED) assert.ok(HW.font.GLYPHS[ch], ch); });
test('every glyph is 7 rows of 5', () => {
  for (const [ch, g] of Object.entries(HW.font.GLYPHS)) {
    assert.equal(g.length, 7, ch);
    for (const row of g) assert.match(row, /^[.#]{5}$/, ch);
  }
});
test('font measure', () => {
  assert.equal(HW.font.measure('', 1), 0);
  assert.equal(HW.font.measure('A', 1), 5);
  assert.equal(HW.font.measure('AB', 2), 22);
});
test('font draw upper-cases and fills glyph pixels', () => {
  const calls = [];
  const ctx = makeCtx({}, calls);
  HW.font.draw(ctx, 'i', 0, 0, '#fff');
  const n = HW.font.GLYPHS.I.join('').split('#').length - 1;
  assert.equal(calls.filter((c) => c === 'fillRect').length, n);
});

// ---- fx ----------------------------------------------------------------------
test('kill causes 40 ms hit-stop, a splat and shake', () => {
  const fx = HW.fx.create();
  const cam = Cam.create();
  assert.equal(HW.fx.hitStop(fx), false);
  HW.fx.consume(fx, [{ type: 'kill', x: 10, y: 10 }], cam);
  assert.equal(HW.fx.hitStop(fx), true);
  assert.equal(fx.splats.length, 1);
  assert.ok(cam.shake > 0);
  HW.fx.update(fx, 0.03);
  assert.equal(HW.fx.hitStop(fx), true);
  HW.fx.update(fx, 0.011);
  assert.equal(HW.fx.hitStop(fx), false);
});
test('shot makes a muzzle flash; clearDecals drops blood', () => {
  const fx = HW.fx.create();
  const cam = Cam.create();
  HW.fx.consume(fx, [{ type: 'shot', x: 0, y: 0, angle: 0 }, { type: 'kill', x: 1, y: 1 }], cam);
  assert.equal(fx.flashes.length, 1);
  fx.decals[0] = {};
  HW.fx.clearDecals(fx);
  assert.equal(fx.splats.length, 0);
  assert.deepEqual(Object.keys(fx.decals), []);
  HW.fx.update(fx, 1);
  assert.equal(fx.flashes.length, 0);
});

// ---- input -------------------------------------------------------------------
test('input latches pressed flags until sampled and converts aim to world', () => {
  const env = makeEnv();
  const H = loadHW({ addEventListener: env.addEventListener });
  const inp = H.input.attach(env.game);
  const cam = H.camera.create();
  cam.x = 1000; cam.y = 1000;
  env.fire('keydown', { code: 'KeyD' });
  env.fire('keydown', { code: 'KeyW' });
  env.fire('keydown', { code: 'Space' });
  env.fire('mousemove', { clientX: 480, clientY: 270 }); // centre of a 960x540 canvas → (240,135)
  env.fire('mousedown', { button: 0 });
  env.fire('mousedown', { button: 2 });
  let s = inp.sample(cam);
  assert.deepEqual({ ...s.move }, { x: 1, y: -1 });
  assert.deepEqual({ ...s.aim }, { x: 1000, y: 1000 });
  assert.equal(s.fire, true); assert.equal(s.firePressed, true);
  assert.equal(s.throwPressed, true); assert.equal(s.executePressed, true);
  s = inp.sample(cam);
  assert.equal(s.fire, true); assert.equal(s.firePressed, false);
  assert.equal(s.throwPressed, false); assert.equal(s.executePressed, false);
  env.fire('mouseup', { button: 0 });
  env.fire('keyup', { code: 'KeyD' });
  env.fire('keydown', { code: 'ShiftLeft' });
  s = inp.sample(cam);
  assert.equal(s.fire, false); assert.equal(s.look, true);
  assert.deepEqual({ ...s.move }, { x: 0, y: -1 });
  env.fire('keydown', { code: 'KeyR' });
  assert.equal(inp.keyPressed('KeyR'), true);
  assert.equal(inp.keyPressed('KeyR'), false);
});

// ---- level draft -------------------------------------------------------------
test('blok draft level validates', () => {
  assert.deepEqual([...HW.levels.validate(HW.levels.blok)], []);
  const f = HW.levels.blok.floors[0];
  assert.ok(f.items.some((i) => i.weapon === 'pistol'));
  assert.ok(f.neon.some((n) => n.text === 'BAR MLECZNY' && n.color === 'cyan'));
  assert.ok(f.map.some((r) => r.includes('D')));
});

// ---- smoke: sprites + renderer + fx with a stub canvas -----------------------
test('sprites build every character, mask, weapon, corpse and tile', () => {
  const env = makeEnv();
  const H = loadHW(env);
  const s = H.sprites.build();
  for (const t of ['player', 'dresiarz', 'bandzior', 'milicjant']) {
    assert.equal(s.chars[t].length, 3, t);
    assert.ok(s.corpses[t], t);
    assert.ok(s.downed[t] || t === 'player', t);
  }
  for (const m of MASK_IDS) assert.ok(s.masks[m], m);
  for (const w of Object.keys(H.weapons)) assert.ok(s.weapons[w], w);
  for (const k of ['carpet', 'wall', 'window', 'stairs', 'car']) assert.ok(s.tiles[k], k);
  for (const l of ['blok', 'pewex', 'komenda']) assert.equal(s.tiles.floor[l].length, 2, l);
  for (const l of ['blok', 'pewex', 'komenda']) assert.ok(H.palette.floor[l], l);
});
test('renderer draws ~60 frames of a live blok level without throwing', () => {
  const env = makeEnv();
  const H = loadHW(env);
  const sprites = H.sprites.build();
  const ctx = makeCanvas(env.calls).getContext('2d');
  const world = H.world.load(H.levels.blok, 'lajkonik', 7);
  const fx = H.fx.create();
  const cam = H.camera.create();
  cam.cursor = { x: 300, y: 100 };
  let sawEvents = 0;
  for (let i = 0; i < 60; i++) {
    const input = H.sim.emptyInput();
    input.move = { x: i < 30 ? 1 : 0, y: -1 };
    input.aim = H.camera.screenToWorld(cam, 300, 100);
    input.fire = true;
    input.firePressed = i % 10 === 0;
    input.throwPressed = i === 20;
    input.executePressed = i === 40;
    input.look = i > 45;
    H.fx.update(fx, 1 / 60);
    if (!H.fx.hitStop(fx)) H.sim.step(world, input, 1 / 60);
    sawEvents += world.events.length;
    H.fx.consume(fx, world.events, cam);
    world.events.length = 0;
    H.camera.update(cam, world, input, 1 / 60);
    H.renderer.draw(ctx, world, cam, fx, sprites, i / 60);
  }
  // Force the rarer paths: downed enemy, corpse, flying item, bullet, dead player.
  const fl = world.floors[0];
  fl.enemies[0].state = 'downed'; fl.enemies[0].downedT = 2;
  H.combat.kill(world, fl.enemies[1], 'gun', world.player);
  world.thrown.push({ id: 'pipe', ammo: null, x: world.player.x, y: world.player.y, vx: 100, vy: 0, spin: 20 });
  H.projectile.spawn(world, world.player.x, world.player.y, 0, world.player);
  H.combat.kill(world, world.player, 'gun', null);
  H.fx.consume(fx, world.events, cam);
  world.events.length = 0;
  H.renderer.draw(ctx, world, cam, fx, sprites, 1.5);
  assert.equal(fx.splats.length, 0, 'splats were painted onto the decal canvas');
  assert.ok(fx.decals[0], 'decal canvas created for floor 0');
  assert.ok(env.calls.includes('drawImage'));
  assert.equal(world.status, 'dead');
  assert.ok(sawEvents > 0, 'the sim produced events (swings) that fx consumed');
});
test('main boots, runs frames, restarts on R and survives input', () => {
  const env = makeEnv();
  const H = loadHW(env);
  assert.ok(H.main && H.main.state, 'main booted');
  assert.equal(env.game.width, 480); assert.equal(env.game.height, 270);
  assert.equal(env.game.style.width, '960px');
  env.fire('keydown', { code: 'KeyD' });
  env.fire('mousemove', { clientX: 700, clientY: 200 });
  for (let i = 0; i < 60; i++) {
    if (i % 15 === 0) env.fire('mousedown', { button: 0 });
    if (i % 15 === 1) env.fire('mouseup', { button: 0 });
    env.tick();
  }
  const st = H.main.state;
  assert.equal(st.error, null);
  assert.ok(st.world.time > 0.5, 'simulated ~1 s, got ' + st.world.time);
  const before = st.world;
  env.fire('keydown', { code: 'KeyR' });
  env.tick();
  assert.notEqual(st.world, before, 'R restarted the level');
  assert.ok(st.world.time < 0.1);
  env.size.w = 1920; env.size.h = 1080;
  env.fire('resize', {});
  assert.equal(env.game.style.width, '1920px');
});
test('main shows an error overlay instead of crashing and R recovers', () => {
  const env = makeEnv();
  const H = loadHW(env);
  env.tick();
  const step = H.sim.step;
  H.sim.step = () => { throw new Error('boom'); };
  const err = console.error;
  console.error = () => {};
  try { env.tick(); } finally { console.error = err; }
  assert.ok(H.main.state.error);
  H.sim.step = step;
  env.fire('keydown', { code: 'KeyR' });
  env.tick();
  assert.equal(H.main.state.error, null);
});
