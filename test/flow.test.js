'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadHW } = require('./helpers/load');

const HW = loadHW();
const plain = (x) => JSON.parse(JSON.stringify(x));

function fresh(extraLevels) {
  const H = loadHW();
  if (extraLevels) for (const id of extraLevels) H.levels[id] = Object.assign({}, H.levels.blok, { id, title: 'POZIOM: ' + id });
  return H;
}

// ---- typewriter --------------------------------------------------------------
test('phonecall typewriter shows 40 chars after 1 s; skip completes', () => {
  const lines = ['x'.repeat(60), 'y'.repeat(40)];
  const pc = HW.phonecall.create(lines);
  assert.equal(pc.shown, 0);
  assert.equal(pc.done, false);
  HW.phonecall.update(pc, 1);
  assert.equal(Math.floor(pc.shown), 40);
  assert.equal(pc.done, false);
  assert.deepEqual(plain(HW.phonecall.visible(pc)), ['x'.repeat(40), '']);
  HW.phonecall.skip(pc);
  assert.equal(pc.shown, 100);
  assert.equal(pc.done, true);
  assert.deepEqual(plain(HW.phonecall.visible(pc)), lines);
  HW.phonecall.update(pc, 5);
  assert.equal(pc.shown, 100, 'never runs past the end');
});
test('phonecall typing finishes on its own', () => {
  const pc = HW.phonecall.create(['abcd']);
  HW.phonecall.update(pc, 0.05);
  assert.equal(pc.done, false);
  HW.phonecall.update(pc, 0.06);
  assert.equal(pc.done, true);
});

// ---- flow --------------------------------------------------------------------
test('full happy path: title → levelSelect → phoneCall → maskSelect → playing → results → levelSelect', () => {
  const F = HW.flow;
  const f = F.create(HW.save.defaults());
  assert.equal(f.state, 'title');
  assert.equal(f.levelId, null); assert.equal(f.maskId, null); assert.equal(f.world, null); assert.equal(f.results, null);
  assert.equal(F.handle(f, { type: 'click' }), f, 'handle returns the flow');
  assert.equal(f.state, 'levelSelect');
  F.handle(f, { type: 'select', id: 'blok' });
  assert.equal(f.state, 'phoneCall');
  assert.equal(f.levelId, 'blok');
  assert.deepEqual(plain(f.phone.lines), plain(HW.levels.blok.phoneCall));
  F.handle(f, { type: 'confirm' }); // skips ringing + typing
  assert.equal(f.state, 'phoneCall');
  assert.equal(f.phone.done, true);
  F.handle(f, { type: 'confirm' });
  assert.equal(f.state, 'maskSelect');
  F.handle(f, { type: 'select', id: 'lajkonik' });
  assert.equal(f.state, 'playing');
  assert.equal(f.maskId, 'lajkonik');
  const results = { lines: [], total: 5000, grade: 'C', newMasks: ['bolek'], newLevel: null };
  F.handle(f, { type: 'won', results });
  assert.equal(f.state, 'results');
  assert.equal(f.results, results);
  F.update(f, 0.5);
  F.handle(f, { type: 'click' });
  assert.equal(f.state, 'levelSelect');
  assert.equal(f.world, null);
});
test('keyboard path: confirm drives every screen', () => {
  const F = HW.flow;
  const f = F.create(HW.save.defaults());
  for (const s of ['levelSelect', 'phoneCall']) { F.handle(f, { type: 'confirm' }); assert.equal(f.state, s); }
  F.handle(f, { type: 'confirm' }); F.handle(f, { type: 'confirm' });
  assert.equal(f.state, 'maskSelect');
  F.handle(f, { type: 'confirm' });
  assert.equal(f.state, 'playing');
  assert.equal(f.maskId, 'lajkonik');
  assert.equal(f.levelId, 'blok');
});
test('locked level select is ignored; only defined levels are listed', () => {
  const H = fresh(['pewex']);
  const f = H.flow.create(H.save.defaults());
  H.flow.handle(f, { type: 'click' });
  assert.deepEqual(plain(H.flow.levelList(f)).map((l) => [l.id, l.unlocked]), [['blok', true], ['pewex', false]]);
  H.flow.handle(f, { type: 'select', id: 'pewex' });
  assert.equal(f.state, 'levelSelect');
  H.flow.handle(f, { type: 'select', id: 'komenda' }); // not defined at all
  assert.equal(f.state, 'levelSelect');
  H.flow.handle(f, { type: 'move', dir: 1 }); // the only unlocked row stays selected
  H.flow.handle(f, { type: 'confirm' });
  assert.equal(f.levelId, 'blok');
});
test('unlocked second level can be selected with the keyboard', () => {
  const H = fresh(['pewex']);
  const save = H.save.defaults();
  save.unlockedLevels.push('pewex');
  const f = H.flow.create(save);
  H.flow.handle(f, { type: 'click' });
  H.flow.handle(f, { type: 'move', dir: 1 });
  H.flow.handle(f, { type: 'confirm' });
  assert.equal(f.state, 'phoneCall');
  assert.equal(f.levelId, 'pewex');
});
test('locked mask select is ignored; masks listed in fixed order', () => {
  const F = HW.flow;
  const f = F.create(HW.save.defaults());
  F.handle(f, { type: 'click' }); F.handle(f, { type: 'select', id: 'blok' });
  F.handle(f, { type: 'confirm' }); F.handle(f, { type: 'confirm' });
  assert.equal(f.state, 'maskSelect');
  assert.deepEqual(plain(F.maskList(f)).map((m) => [m.id, m.unlocked]),
    [['lajkonik', true], ['bolek', false], ['lolek', false], ['czapka', false], ['kleks', false]]);
  F.handle(f, { type: 'select', id: 'bolek' });
  assert.equal(f.state, 'maskSelect');
  F.handle(f, { type: 'select', id: 'levelOrder' });
  assert.equal(f.state, 'maskSelect');
  F.handle(f, { type: 'move', dir: 1 });
  F.handle(f, { type: 'confirm' });
  assert.equal(f.maskId, 'lajkonik');
});
test('won carries the new save: unlocked mask becomes selectable next time', () => {
  const F = HW.flow;
  const f = F.create(HW.save.defaults());
  F.handle(f, { type: 'click' }); F.handle(f, { type: 'select', id: 'blok' });
  F.handle(f, { type: 'confirm' }); F.handle(f, { type: 'confirm' }); F.handle(f, { type: 'select', id: 'lajkonik' });
  const rec = HW.save.recordResult(f.save, 'blok', 9000, 'A+');
  F.handle(f, { type: 'won', results: { lines: [], total: 9000, grade: 'A+', newMasks: rec.newMasks, newLevel: rec.newLevel }, save: rec.data });
  F.update(f, 0.5);
  F.handle(f, { type: 'confirm' });
  assert.equal(f.state, 'levelSelect');
  F.handle(f, { type: 'select', id: 'blok' }); F.handle(f, { type: 'confirm' }); F.handle(f, { type: 'confirm' });
  F.handle(f, { type: 'select', id: 'bolek' });
  assert.equal(f.state, 'playing');
  assert.equal(f.maskId, 'bolek');
});
test('back: playing, maskSelect, phoneCall and results return to levelSelect', () => {
  const F = HW.flow;
  const toPlaying = () => {
    const f = F.create(HW.save.defaults());
    F.handle(f, { type: 'click' }); F.handle(f, { type: 'select', id: 'blok' });
    return f;
  };
  let f = toPlaying();
  F.handle(f, { type: 'back' });
  assert.equal(f.state, 'levelSelect');
  f = toPlaying(); F.handle(f, { type: 'confirm' }); F.handle(f, { type: 'confirm' });
  F.handle(f, { type: 'back' });
  assert.equal(f.state, 'levelSelect');
  f = toPlaying(); F.handle(f, { type: 'confirm' }); F.handle(f, { type: 'confirm' }); F.handle(f, { type: 'confirm' });
  assert.equal(f.state, 'playing');
  f.world = { fake: true };
  F.handle(f, { type: 'back' });
  assert.equal(f.state, 'levelSelect');
  assert.equal(f.world, null);
  assert.equal(f.maskId, null);
  F.handle(f, { type: 'won', results: {} }); // won outside playing is ignored
  assert.equal(f.state, 'levelSelect');
});
test('results ignore dismissal for 0.5 s after entering', () => {
  const F = HW.flow;
  const f = F.create(HW.save.defaults());
  for (let i = 0; i < 5; i++) F.handle(f, { type: 'confirm' });
  assert.equal(f.state, 'playing');
  F.handle(f, { type: 'won', results: { lines: [], total: 0, grade: 'F', newMasks: [], newLevel: null } });
  for (const type of ['click', 'confirm', 'back']) F.handle(f, { type });
  assert.equal(f.state, 'results');
  F.update(f, 0.3);
  F.handle(f, { type: 'click' });
  assert.equal(f.state, 'results');
  F.update(f, 0.25);
  F.handle(f, { type: 'click' });
  assert.equal(f.state, 'levelSelect');
  for (let i = 0; i < 5; i++) F.handle(f, { type: 'confirm' });
  F.handle(f, { type: 'won', results: { lines: [], total: 0, grade: 'F', newMasks: [], newLevel: null } });
  F.handle(f, { type: 'abort' }); // error-screen escape ignores the lock
  assert.equal(f.state, 'levelSelect');
});
test('title ignores back; playing ignores clicks and confirms', () => {
  const F = HW.flow;
  const f = F.create(HW.save.defaults());
  F.handle(f, { type: 'back' });
  assert.equal(f.state, 'title');
  F.handle(f, { type: 'confirm' }); F.handle(f, { type: 'confirm' });
  F.handle(f, { type: 'confirm' }); F.handle(f, { type: 'confirm' }); F.handle(f, { type: 'confirm' });
  assert.equal(f.state, 'playing');
  F.handle(f, { type: 'click' }); F.handle(f, { type: 'confirm' }); F.handle(f, { type: 'select', id: 'blok' });
  assert.equal(f.state, 'playing');
});
test('phone call rings for 1.5 s (a ring cue every 0.5 s) before typing', () => {
  const F = HW.flow;
  const f = F.create(HW.save.defaults());
  F.handle(f, { type: 'click' }); F.handle(f, { type: 'select', id: 'blok' });
  const cues = [];
  for (let i = 0; i < 89; i++) cues.push(...F.update(f, 1 / 60));
  assert.equal(F.ringing(f), true);
  assert.equal(f.phone.shown, 0, 'nothing typed while ringing');
  for (let i = 0; i < 2; i++) cues.push(...F.update(f, 1 / 60));
  assert.deepEqual(plain(cues), ['ring', 'ring', 'ring']);
  assert.equal(F.ringing(f), false);
  for (let i = 0; i < 60; i++) F.update(f, 1 / 60);
  assert.ok(Math.abs(f.phone.shown - 40) < 1, 'typed ~40 chars in the next second: ' + f.phone.shown);
  F.handle(f, { type: 'click' });
  assert.equal(f.phone.done, true);
  assert.equal(f.state, 'phoneCall');
});
test('update counts time in state and returns no cues outside the phone call', () => {
  const F = HW.flow;
  const f = F.create(HW.save.defaults());
  assert.deepEqual(plain(F.update(f, 0.5)), []);
  assert.equal(f.stateT, 0.5);
  F.handle(f, { type: 'click' });
  assert.equal(f.stateT, 0);
});

// ---- screens: hit testing ----------------------------------------------------
test('hitTest maps canvas pixels to actions', () => {
  const H = fresh(['pewex']);
  const F = H.flow, S = H.screens;
  const f = F.create(H.save.defaults());
  assert.deepEqual(plain(S.hitTest(f, 10, 10)), { type: 'click' });
  F.handle(f, { type: 'click' });
  const rows = S.layout(f);
  assert.deepEqual(plain(rows).map((r) => r.id), ['blok', 'pewex']);
  const c = (r) => [r.x + r.w / 2, r.y + r.h / 2];
  assert.deepEqual(plain(S.hitTest(f, ...c(rows[0]))), { type: 'select', id: 'blok' });
  assert.equal(S.hitTest(f, ...c(rows[1])), null, 'locked row not clickable');
  assert.equal(S.hitTest(f, 1, 1), null);
  F.handle(f, { type: 'select', id: 'blok' });
  assert.deepEqual(plain(S.hitTest(f, 5, 5)), { type: 'click' });
  F.handle(f, { type: 'confirm' }); F.handle(f, { type: 'confirm' });
  const masks = S.layout(f);
  assert.deepEqual(plain(masks).map((r) => r.id), ['lajkonik', 'bolek', 'lolek', 'czapka', 'kleks']);
  assert.deepEqual(plain(S.hitTest(f, ...c(masks[0]))), { type: 'select', id: 'lajkonik' });
  assert.equal(S.hitTest(f, ...c(masks[2])), null);
  F.handle(f, { type: 'select', id: 'lajkonik' });
  assert.equal(S.hitTest(f, 100, 100), null, 'no menu hits while playing');
  F.handle(f, { type: 'won', results: { lines: [], total: 0, grade: 'F', newMasks: [], newLevel: null } });
  assert.deepEqual(plain(S.hitTest(f, 100, 100)), { type: 'click' });
});

// ---- screens + hud: drawing smoke (stub 2D context) ------------------------------
function stubCtx(calls) {
  return new Proxy({}, {
    get(t, k) { if (k in t) return t[k]; return (...a) => { calls.push({ k: String(k), a }); }; },
    set(t, k, v) { t[k] = v; return true; },
  });
}
function textsDrawn(H, fn) {
  const texts = [];
  const orig = H.font.draw;
  H.font.draw = (ctx, text, ...rest) => { texts.push(String(text).toUpperCase()); return orig(ctx, text, ...rest); };
  try { fn(); } finally { H.font.draw = orig; }
  return texts;
}
// Enough browser for sprites.build() (and for main.js, which boots whenever document exists).
function docStub() {
  const canvas = () => ({ width: 0, height: 0, style: {}, addEventListener() {}, getContext: () => stubCtx([]),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 480, height: 270 }) });
  return {
    document: { createElement: canvas, getElementById: canvas },
    addEventListener() {}, requestAnimationFrame() {}, innerWidth: 480, innerHeight: 270,
    performance: { now: () => 0 },
  };
}

test('screens draw every state with the required Polish texts', () => {
  const H = loadHW(docStub());
  const F = H.flow, S = H.screens;
  const ctx = stubCtx([]);
  const f = F.create(H.save.defaults());
  let t = textsDrawn(H, () => S.draw(ctx, f, 0.1));
  assert.ok(t.includes('HOTLINE') || t.includes('HOTLINE WARSZAWA'), t.join('|'));
  assert.ok(t.some((s) => s.includes('WARSZAWA')));
  assert.ok(t.includes('PRAGA, 1986'));
  assert.ok(t.includes('KLIKNIJ ABY ZACZĄĆ'));
  F.handle(f, { type: 'click' });
  t = textsDrawn(H, () => S.draw(ctx, f, 0.2));
  assert.ok(t.some((s) => s.includes('BLOK')), t.join('|'));
  F.handle(f, { type: 'select', id: 'blok' });
  t = textsDrawn(H, () => S.draw(ctx, f, 0.3));
  assert.ok(t.some((s) => s.includes('DRRRYŃ')), t.join('|'));
  F.handle(f, { type: 'confirm' });
  t = textsDrawn(H, () => S.draw(ctx, f, 0.4));
  assert.ok(t.some((s) => s.includes('HALINKA')), t.join('|'));
  F.handle(f, { type: 'confirm' });
  const sprites = H.sprites.build();
  t = textsDrawn(H, () => S.draw(ctx, f, 0.5, { sprites, cursor: { x: 10, y: 10 } }));
  for (const n of ['LAJKONIK', 'BOLEK', 'LOLEK', 'CZAPKA MILICJANTA', 'PAN KLEKS']) assert.ok(t.some((s) => s.includes(n)), n);
  assert.ok(t.some((s) => s.includes('NOŻEM')), 'bolek perk text');
  F.handle(f, { type: 'select', id: 'lajkonik' });
  const fin = H.scoring.finish(H.scoring.create(), 30, 9000);
  F.handle(f, { type: 'won', results: Object.assign({}, fin, { newMasks: ['bolek', 'czapka'], newLevel: 'pewex' }) });
  t = textsDrawn(H, () => S.draw(ctx, f, 3));
  for (const l of fin.lines) assert.ok(t.some((s) => s.includes(l.label)), l.label);
  assert.ok(t.includes(fin.grade), 'grade letter drawn');
  assert.ok(t.some((s) => s.includes(String(Math.round(fin.total)))), 'total drawn');
  assert.ok(t.includes('NOWA MASKA: BOLEK'));
  assert.ok(t.includes('NOWA MASKA: CZAPKA MILICJANTA'));
  assert.ok(t.some((s) => s.startsWith('NOWY POZIOM: ')));
});

test('hud draws weapon, ammo, score, combo and status banners', () => {
  const H = loadHW(docStub());
  const ctx = stubCtx([]);
  const world = H.world.load(H.levels.blok, 'lajkonik', 1);
  let t = textsDrawn(H, () => H.hud.draw(ctx, world));
  assert.ok(t.some((s) => s.includes('PIĘŚCI')), t.join('|'));
  world.player.weapon = { id: 'pistol', ammo: 5 };
  world.score.kills = 1200;
  H.scoring.onKill(world.score, world.time, 'gun', {});
  H.scoring.onKill(world.score, world.time, 'gun', {});
  t = textsDrawn(H, () => H.hud.draw(ctx, world));
  assert.ok(t.some((s) => s.includes('PISTOLET P-64')), t.join('|'));
  assert.ok(t.some((s) => s.includes('5')));
  assert.ok(t.some((s) => s.includes('1800')), 'score = kills + combo + bold');
  assert.ok(t.includes('×2'), 'combo multiplier');
  world.status = 'cleared';
  t = textsDrawn(H, () => H.hud.draw(ctx, world));
  assert.ok(t.includes('WRACAJ DO AUTA'));
  world.status = 'dead';
  t = textsDrawn(H, () => H.hud.draw(ctx, world));
  assert.ok(t.includes('NIE ŻYJESZ — R'));
});
test('hud combo bar drains with the 2.5 s window', () => {
  assert.equal(HW.hud.comboLeft({ chain: [], lastKillT: 0 }, 1), 0);
  assert.ok(Math.abs(HW.hud.comboLeft({ chain: [300], lastKillT: 1 }, 1) - 1) < 1e-9);
  assert.ok(Math.abs(HW.hud.comboLeft({ chain: [300], lastKillT: 1 }, 2.25) - 0.5) < 1e-9);
  assert.equal(HW.hud.comboLeft({ chain: [300], lastKillT: 1 }, 4), 0);
});

test('hud: WRACAJ DO AUTA is drawn whenever cleared (no blink-off frames)', () => {
  const H = loadHW(docStub());
  const ctx = stubCtx([]);
  const world = H.world.load(H.levels.blok, 'lajkonik', 1);
  world.status = 'cleared';
  for (const time of [0, 0.3, 0.65, 0.75, 1.1, 2.9]) {
    world.time = time;
    const t = textsDrawn(H, () => H.hud.draw(ctx, world, H.camera.create()));
    assert.ok(t.includes('WRACAJ DO AUTA'), 'missing at t=' + time);
  }
});
test('hud: arrow target is the car on floor 0, the stairs toward floor 0 elsewhere', () => {
  const H = loadHW(docStub());
  const T = H.tilemap;
  const level = {
    id: 'blok', targetScore: 1000,
    floors: [
      { map: ['#######', '#P..S.#', '#######'], enemies: [], items: [], neon: [], stairs: [{ at: [4, 1], to: { floor: 1, at: [2, 1] } }] },
      { map: ['#######', '#S.S..#', '#######'], enemies: [], items: [], neon: [],
        stairs: [{ at: [1, 1], to: { floor: 2, at: [1, 1] } }, { at: [3, 1], to: { floor: 0, at: [4, 1] } }] },
    ],
  };
  const world = H.world.load(level, 'lajkonik', 1);
  assert.deepEqual({ ...H.hud.target(world) }, { x: T.center(1), y: T.center(1) });
  world.floorIndex = 1;
  assert.deepEqual({ ...H.hud.target(world) }, { x: T.center(3), y: T.center(1) });
});
test('hud: arrow orbits the player on screen and points at the target', () => {
  const H = loadHW(docStub());
  const world = H.world.load(H.levels.blok, 'lajkonik', 1);
  const cam = H.camera.create();
  cam.x = world.player.x - 30; cam.y = world.player.y; // player 30 px right of screen centre
  const car = H.hud.target(world);
  world.player.x = car.x + 100; world.player.y = car.y; // car straight to the left
  cam.x = world.player.x - 30;
  const a = H.hud.arrow(world, cam);
  const px = H.camera.W / 2 + 30, py = H.camera.H / 2;
  assert.ok(Math.abs(Math.hypot(a.x - px, a.y - py) - H.hud.ARROW_R) < 1e-6);
  assert.ok(a.x < px, 'arrow sits on the car side of the player');
  assert.ok(Math.abs(Math.abs(a.angle) - Math.PI) < 1e-6, 'points left');
});
test('scoring exports the combo window used by the hud', () => {
  assert.equal(HW.scoring.WINDOW, 2.5);
});
