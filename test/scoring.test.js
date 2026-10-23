'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadHW } = require('./helpers/load');
const { makeLevel } = require('./helpers/fixtures');

const HW = loadHW();
const S = HW.scoring;
const kill = (s, t, cause, extra) => S.onKill(s, t, cause, extra || { victimHadGun: false, door: false });
const line = (r, label) => r.lines.find((l) => l.label === label).points;

test('three kills 1 s apart bank sum x 2 after idle window', () => {
  const s = S.create();
  kill(s, 0, 'melee'); kill(s, 1, 'melee'); kill(s, 2, 'gun');
  assert.equal(s.multiplier, 3);
  S.tick(s, 4);
  assert.equal(s.combo, 0, 'window not yet expired');
  S.tick(s, 4.6);
  assert.equal(s.combo, (400 + 400 + 300) * 2);
  assert.equal(s.chain.length, 0);
  assert.equal(s.multiplier, 1);
});

test('kill 3 s later starts a new chain', () => {
  const s = S.create();
  kill(s, 0, 'melee'); kill(s, 1, 'melee');
  kill(s, 4, 'melee');
  assert.equal(s.combo, 800, "first chain banked (400+400)*1");
  assert.equal(s.chain.length, 1);
  assert.equal(s.multiplier, 1);
});

test('multiplier caps at 8', () => {
  const s = S.create();
  for (let i = 0; i < 12; i++) kill(s, i * 0.1, 'gun');
  assert.equal(s.multiplier, 8);
});

test('door execution scores 1100 and counts as door kind only', () => {
  const s = S.create();
  kill(s, 0, 'execution', { victimHadGun: false, door: true });
  assert.equal(s.kills, 1100);
  assert.deepEqual([...s.kinds], ['door']);
});

test('boldness for melee/execution/door on gun holders, not gun kills', () => {
  const s = S.create();
  kill(s, 0, 'melee', { victimHadGun: true, door: false });
  kill(s, 10, 'execution', { victimHadGun: true, door: true });
  kill(s, 20, 'gun', { victimHadGun: true, door: false });
  assert.equal(s.bold, 600);
});

test('flexibility 200 per kind; melee + gun = 400', () => {
  const s = S.create();
  kill(s, 0, 'melee'); kill(s, 10, 'gun'); kill(s, 20, 'melee');
  assert.equal(line(S.finish(s, 0, 1000), 'ELASTYCZNOŚĆ'), 400);
});

test('time bonus', () => {
  assert.equal(line(S.finish(S.create(), 60, 1000), 'CZAS'), 1800);
  assert.equal(line(S.finish(S.create(), 200, 1000), 'CZAS'), 0);
});

test('finish banks open chain, orders lines, sums total', () => {
  const s = S.create();
  kill(s, 0, 'melee', { victimHadGun: true, door: false });
  kill(s, 1, 'gun');
  const r = S.finish(s, 100, 2000);
  assert.deepEqual([...r.lines.map((l) => l.label)], ['ZABÓJSTWA', 'COMBO', 'ELASTYCZNOŚĆ', 'CZAS', 'ODWAGA']);
  assert.equal(line(r, 'ZABÓJSTWA'), 700);
  assert.equal(line(r, 'COMBO'), 700);
  assert.equal(r.total, r.lines.reduce((a, l) => a + l.points, 0));
  assert.equal(r.grade, S.grade(r.total / 2000));
});

test('grade boundaries', () => {
  assert.equal(S.grade(1), 'A+');
  assert.equal(S.grade(0.85), 'A');
  assert.equal(S.grade(0.8499), 'B');
  assert.equal(S.grade(0.7), 'B');
  assert.equal(S.grade(0.55), 'C');
  assert.equal(S.grade(0.4), 'D');
  assert.equal(S.grade(0.39), 'F');
});

test('score state is JSON-serialisable', () => {
  const s = S.create();
  kill(s, 0, 'melee');
  assert.deepEqual(JSON.parse(JSON.stringify(s)).kinds, ['melee']);
});

// ---- sim integration ----
const floor0 = ['########', '#P.....#', '#.....S#', '########'];
const floor1 = ['########', '#S.....#', '#......#', '########'];
function twoFloor() {
  return makeLevel(null, { floors: [
    { map: floor0, enemies: [{ type: 'dresiarz', at: [4, 1], facing: 0 }], items: [], neon: [],
      stairs: [{ at: [6, 2], to: { floor: 1, at: [1, 1] } }] },
    { map: floor1, enemies: [{ type: 'dresiarz', at: [5, 2], facing: 0 }], items: [], neon: [],
      stairs: [{ at: [1, 1], to: { floor: 0, at: [6, 2] } }] },
  ] });
}
function step(w, n = 1, input) {
  for (let i = 0; i < n; i++) HW.sim.step(w, { ...HW.sim.emptyInput(), aim: { x: 0, y: 0 }, ...input }, 1 / 60);
}
const types = (w) => w.events.map((e) => e.type);

test('world always has a score state', () => {
  const w = HW.world.load(twoFloor(), 'lajkonik');
  assert.equal(w.score.multiplier, 1);
});

test('sim.step ticks scoring to bank expired chains', () => {
  const w = HW.world.load(twoFloor(), 'lajkonik');
  kill(w.score, 0, 'melee'); kill(w.score, 0.5, 'melee');
  w.time = 4;
  step(w);
  assert.equal(w.score.combo, 800);
});

test('cleared only when enemies on both floors are dead; won only on P', () => {
  const w = HW.world.load(twoFloor(), 'lajkonik');
  w.floors[0].enemies[0].alive = false;
  step(w);
  assert.equal(w.status, 'alive');
  w.floors[1].enemies[0].alive = false;
  step(w);
  assert.equal(w.status, 'cleared');
  step(w);
  assert.equal(types(w).filter((t) => t === 'cleared').length, 1);
  // player starts on P: first cleared step may already win only if on P; move away first
  const w2 = HW.world.load(twoFloor(), 'lajkonik');
  w2.player.x = 5 * 16 + 8; w2.player.y = 24;
  for (const f of w2.floors) f.enemies.forEach((e) => { e.alive = false; });
  step(w2);
  assert.equal(w2.status, 'cleared');
  w2.player.x = 24; w2.player.y = 24;
  step(w2);
  assert.equal(w2.status, 'won');
  assert.ok(types(w2).includes('won'));
  const t = w2.time;
  step(w2, 3);
  assert.equal(w2.time, t, 'frozen after won');
});

test('stairs move between floors and do not bounce back', () => {
  const w = HW.world.load(twoFloor(), 'lajkonik');
  w.player.x = 6 * 16 + 8; w.player.y = 2 * 16 + 8;
  w.projectiles.push({ x: 1, y: 1 });
  step(w);
  assert.equal(w.floorIndex, 1);
  assert.deepEqual([w.player.x, w.player.y], [24, 24]);
  assert.equal(w.projectiles.length, 0);
  assert.ok(types(w).includes('floor'));
  step(w, 5);
  assert.equal(w.floorIndex, 1, 'no bounce while standing on arrival tile');
  w.player.x = 4 * 16 + 8; w.player.y = 24;
  step(w);
  w.player.x = 24; w.player.y = 24;
  step(w);
  assert.equal(w.floorIndex, 0);
  assert.deepEqual([w.player.x, w.player.y], [6 * 16 + 8, 2 * 16 + 8]);
});

test('finish rounds the time line so lines and total are integers', () => {
  const r = S.finish(S.create(), 50.7333, 1000);
  assert.equal(line(r, 'CZAS'), 1985);
  assert.ok(Number.isInteger(r.total));
});
