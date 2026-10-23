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
test('accented capitals are full height, not squeezed like lowercase', () => {
  const lit = (row) => row.includes('#');
  // acute / dot sits in row 0; the letter body fills rows 1–6 with no blank gap row
  for (const ch of 'ĆŃÓŚŹŻ') {
    const g = HW.font.GLYPHS[ch];
    assert.ok(lit(g[0]), ch + ' diacritic');
    for (let r = 1; r < 7; r++) assert.ok(lit(g[r]), ch + ' row ' + r + ' blank');
  }
  // ogonek hangs in row 6; the letter's left stroke runs down to row 5
  for (const ch of 'ĄĘ') {
    const g = HW.font.GLYPHS[ch];
    for (let r = 1; r < 6; r++) assert.equal(g[r][0], '#', ch + ' row ' + r + ' stem');
    assert.ok(lit(g[6]), ch + ' ogonek');
  }
  const L = HW.font.GLYPHS['Ł'];
  assert.ok(L.every(lit), 'Ł spans all 7 rows');
});
test('acute marks and the Ż dot stand free of the letter body', () => {
  // an acute in row 0 must not touch any lit pixel of row 1, not even diagonally
  for (const ch of 'ĆÓŚŹ') {
    const g = HW.font.GLYPHS[ch];
    for (let c = 0; c < 5; c++) {
      if (g[0][c] !== '#') continue;
      for (const dc of [-1, 0, 1]) assert.notEqual(g[1][c + dc], '#', ch + ' accent at col ' + c + ' touches the body');
    }
  }
  // the Ż dot does not sit directly on the top bar
  const Z = HW.font.GLYPHS['Ż'];
  for (let c = 0; c < 5; c++) if (Z[0][c] === '#') assert.notEqual(Z[1][c], '#', 'Ż dot sits on the bar');
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
test('input: clickPressed latches a left click independently of sample()', () => {
  const env = makeEnv();
  const H = loadHW({ addEventListener: env.addEventListener });
  const inp = H.input.attach(env.game);
  const cam = H.camera.create();
  assert.equal(inp.clickPressed(), false);
  env.fire('mousedown', { button: 2 });
  assert.equal(inp.clickPressed(), false, 'right button is not a click');
  env.fire('mousedown', { button: 0 });
  assert.equal(inp.sample(cam).firePressed, true);
  assert.equal(inp.clickPressed(), true, 'sample() does not consume the click');
  assert.equal(inp.clickPressed(), false);
  env.fire('mousedown', { button: 0 });
  inp.clickPressed();
  assert.equal(inp.sample(cam).firePressed, true, 'clickPressed() does not consume firePressed');
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
  for (const k of ['carpet', 'wall', 'window', 'stairs', 'car', 'asphalt', 'pavement']) assert.ok(s.tiles[k], k);
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
test('renderer.flicker: a deterministic, time-based failing-tube stutter', () => {
  const f = HW.renderer.flicker;
  let dark = 0, n = 0;
  for (let t = 0; t < 12; t += 1 / 60, n++) {
    const a = f(t, 0);
    assert.ok(a > 0 && a <= 1, 'alpha ' + a + ' at ' + t);
    assert.equal(f(t, 0), a, 'same time, same alpha');
    if (a < 0.5) dark++;
  }
  assert.ok(dark / n >= 0.1 && dark / n <= 0.4, 'dark ' + Math.round(dark / n * 100) + '% of the time');
  // a phase offset shifts the pattern, so neighbouring signs do not blink in unison
  let differ = 0;
  for (let t = 0; t < 12; t += 1 / 60) if ((f(t, 0) < 0.5) !== (f(t, 0.9) < 0.5)) differ++;
  assert.ok(differ > 0);
});
test('renderer draws a level with flickering neon (komenda) without throwing', () => {
  const env = makeEnv();
  const H = loadHW(env);
  const sprites = H.sprites.build();
  const ctx = makeCanvas(env.calls).getContext('2d');
  const world = H.world.load(H.levels.komenda, 'lajkonik', 7);
  assert.ok(world.level.floors[0].neon.some((n) => n.flicker));
  const cam = H.camera.create();
  cam.cursor = { x: 0, y: 0 };
  const fx = H.fx.create();
  for (let i = 0; i < 30; i++) H.renderer.draw(ctx, world, cam, fx, sprites, i / 10);
  assert.ok(env.calls.includes('drawImage'));
});
// Canvas pixel (x, y) → client coords on the 960×540 stub canvas.
function click(env, x, y) {
  env.fire('mousemove', { clientX: x * 2, clientY: y * 2 });
  env.fire('mousedown', { button: 0 });
  env.fire('mouseup', { button: 0 });
}
function press(env, code) {
  env.fire('keydown', { code });
  env.fire('keyup', { code });
}
function makeStorage() {
  const data = {};
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}
// title → levelSelect → phoneCall (skipped) → maskSelect → playing, by mouse and keyboard.
function driveToPlaying(env, H) {
  const st = H.main.state;
  env.tick();
  if (st.flow.state === 'title') { click(env, 240, 135); env.tick(); }
  assert.equal(st.flow.state, 'levelSelect');
  const row = H.screens.layout(st.flow)[0];
  click(env, row.x + row.w / 2, row.y + row.h / 2); env.tick();
  assert.equal(st.flow.state, 'phoneCall');
  for (let i = 0; i < 20; i++) env.tick();
  press(env, 'Space'); env.tick();
  assert.equal(st.flow.state, 'phoneCall');
  assert.equal(st.flow.phone.done, true);
  press(env, 'Space'); env.tick();
  assert.equal(st.flow.state, 'maskSelect');
  press(env, 'Enter'); env.tick();
  assert.equal(st.flow.state, 'playing');
}

test('main boots to the title screen and scales the canvas', () => {
  const env = makeEnv();
  const H = loadHW(env);
  assert.ok(H.main && H.main.state, 'main booted');
  assert.equal(H.main.state.flow.state, 'title');
  assert.equal(env.game.width, 480); assert.equal(env.game.height, 270);
  assert.equal(env.game.style.width, '960px');
  for (let i = 0; i < 30; i++) env.tick();
  assert.equal(H.main.state.error, null);
  env.size.w = 1920; env.size.h = 1080;
  env.fire('resize', {});
  assert.equal(env.game.style.width, '1920px');
});
test('main drives the full flow through results and back to level select', () => {
  const env = makeEnv();
  env.localStorage = makeStorage();
  const H = loadHW(env);
  const st = H.main.state;
  driveToPlaying(env, H);
  assert.ok(st.world, 'world loaded on entering playing');
  assert.equal(st.flow.world, st.world);
  assert.equal(st.world.mask, 'lajkonik');
  assert.equal(st.world.level, H.levels.blok);
  env.fire('keydown', { code: 'KeyD' });
  env.fire('mousemove', { clientX: 700, clientY: 200 });
  for (let i = 0; i < 60; i++) {
    if (i % 15 === 0) env.fire('mousedown', { button: 0 });
    if (i % 15 === 1) env.fire('mouseup', { button: 0 });
    env.tick();
  }
  env.fire('keyup', { code: 'KeyD' });
  assert.equal(st.error, null);
  assert.ok(st.world.time > 0.5, 'simulated ~1 s, got ' + st.world.time);
  const before = st.world;
  press(env, 'KeyR'); env.tick();
  assert.notEqual(st.world, before, 'R restarted the level');
  assert.ok(st.world.time < 0.1);
  assert.equal(st.world.mask, 'lajkonik', 'restart keeps the mask');
  st.world.status = 'won';
  env.tick();
  assert.equal(st.flow.state, 'results');
  const r = st.flow.results;
  assert.equal(r.lines.length, 5);
  assert.ok(typeof r.total === 'number' && typeof r.grade === 'string');
  assert.deepEqual([...r.newMasks].slice(0, 1), ['bolek']);
  const saved = JSON.parse(env.localStorage.data[H.save.KEY]);
  assert.ok(saved.unlockedMasks.includes('bolek'));
  assert.ok(saved.bestScores.blok);
  assert.ok(st.flow.save.unlockedMasks.includes('bolek'), 'flow sees the new save');
  click(env, 240, 135); env.tick();
  assert.equal(st.flow.state, 'results', 'early click ignored');
  for (let i = 0; i < 40; i++) env.tick();
  click(env, 240, 135); env.tick();
  assert.equal(st.flow.state, 'levelSelect');
  assert.equal(st.world, null);
  assert.equal(st.error, null);
});
test('main: Esc leaves playing for level select; music follows the flow', () => {
  const env = makeEnv();
  const H = loadHW(env);
  const log = [];
  H.synth.init = () => true;
  H.synth.ctx = () => ({ state: 'running', resume() {} });
  H.music.start = (lv) => log.push(['start', lv.root]);
  H.music.stop = () => log.push(['stop']);
  H.music.muffle = (on) => log.push(['muffle', on]);
  env.fire('pointerdown', {}); // audio gesture
  driveToPlaying(env, H);
  assert.deepEqual(log, [['start', H.levels.blok.music.root]]);
  press(env, 'Escape'); env.tick();
  assert.equal(H.main.state.flow.state, 'levelSelect');
  assert.equal(H.main.state.world, null);
  assert.deepEqual(log.slice(1), [['muffle', false], ['stop']]);
  log.length = 0;
  driveToPlaying(env, H);
  H.main.state.world.status = 'won';
  env.tick();
  assert.deepEqual(log, [['start', H.levels.blok.music.root], ['muffle', true]]);
});
test('main: input latched in menus does not fire on the first gameplay step', () => {
  const env = makeEnv();
  const H = loadHW(env);
  const st = H.main.state;
  env.tick();
  click(env, 240, 135); env.tick();
  env.fire('mousemove', { clientX: 4, clientY: 4 });
  env.fire('mousedown', { button: 0 }); // click on empty space in level select
  env.fire('mouseup', { button: 0 });
  env.fire('mousedown', { button: 2 });
  env.tick();
  assert.equal(st.flow.state, 'levelSelect');
  press(env, 'Enter'); env.tick();
  press(env, 'Enter'); env.tick(); // skip
  press(env, 'Enter'); env.tick(); // confirm call
  const seen = [];
  const step = H.sim.step;
  H.sim.step = (w, input, dt) => { seen.push({ ...input }); return step(w, input, dt); };
  press(env, 'Enter'); env.tick();
  env.tick();
  assert.equal(st.flow.state, 'playing');
  assert.ok(seen.length > 0);
  assert.equal(seen[0].firePressed, false);
  assert.equal(seen[0].throwPressed, false);
  assert.equal(seen[0].executePressed, false);
});
test('main shows an error overlay instead of crashing and R recovers', () => {
  const env = makeEnv();
  const H = loadHW(env);
  driveToPlaying(env, H);
  env.tick();
  const step = H.sim.step;
  H.sim.step = () => { throw new Error('boom'); };
  const err = console.error;
  console.error = () => {};
  try { env.tick(); } finally { console.error = err; }
  assert.ok(H.main.state.error);
  H.sim.step = step;
  press(env, 'KeyR');
  env.tick();
  assert.equal(H.main.state.error, null);
  assert.ok(H.main.state.world.time < 0.1);
});

test('main applies at most one state-changing menu action per frame', () => {
  const env = makeEnv();
  const H = loadHW(env);
  const st = H.main.state;
  env.tick();
  click(env, 240, 135); env.tick();
  press(env, 'Enter'); env.tick();
  press(env, 'Enter'); env.tick();
  assert.equal(st.flow.state, 'phoneCall');
  assert.equal(st.flow.phone.done, true);
  click(env, 240, 135); press(env, 'Enter'); // both in one frame
  env.tick();
  assert.equal(st.flow.state, 'maskSelect');
});
test('main: Esc on the error screen returns to level select', () => {
  const env = makeEnv();
  const H = loadHW(env);
  driveToPlaying(env, H);
  H.sim.step = () => { throw new Error('boom'); };
  const err = console.error;
  console.error = () => {};
  try { env.tick(); } finally { console.error = err; }
  assert.ok(H.main.state.error);
  press(env, 'Escape'); env.tick();
  assert.equal(H.main.state.error, null);
  assert.equal(H.main.state.flow.state, 'levelSelect');
  assert.equal(H.main.state.world, null);
});

test('floor event starts a 0.2 s fade that decays and clears on restart', () => {
  const fx = HW.fx.create();
  const cam = Cam.create();
  assert.equal(fx.fade, 0);
  HW.fx.consume(fx, [{ type: 'floor', floor: 1, x: 0, y: 0 }], cam);
  assert.equal(fx.fade, HW.fx.FADE);
  assert.equal(HW.fx.FADE, 0.2);
  HW.fx.update(fx, 0.1);
  assert.ok(Math.abs(fx.fade - 0.1) < 1e-9);
  HW.fx.update(fx, 0.2);
  assert.equal(fx.fade, 0);
  HW.fx.consume(fx, [{ type: 'floor' }], cam);
  HW.fx.clearDecals(fx);
  assert.equal(fx.fade, 0);
});
