'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadHW } = require('./helpers/load');
const { makeLevel } = require('./helpers/fixtures');

const HW = loadHW();
const openRoom = ['########', '#P.....#', '#......#', '#......#', '#......#', '########'];
const doorRoom = ['#########', '#P..#...#', '#...D...#', '#...#...#', '#########'];
const hDoorRoom = ['#####', '#P..#', '##D##', '#...#', '#####'];

function strip(w) {
  return JSON.parse(JSON.stringify(w, (k, v) => (k === 'rng' || k === 'level' ? undefined : v)));
}
function run(w, move, secs) {
  for (let i = 0; i < Math.round(secs * 60); i++) HW.sim.step(w, { ...HW.sim.emptyInput(), move }, 1 / 60);
}

test('player moves right at 120 px/s after acceleration', () => {
  const w = HW.world.load(makeLevel(['#' + '#'.repeat(40), '#P' + '.'.repeat(39), '#' + '#'.repeat(40)]), 'lajkonik');
  const x0 = w.player.x;
  run(w, { x: 1, y: 0 }, 1);
  assert.ok(Math.abs(w.player.x - x0 - 120) < 8, String(w.player.x - x0));
});
test('diagonal speed is normalized', () => {
  const rows = ['#'.repeat(40)].concat(Array.from({ length: 38 }, (_, i) => '#' + (i === 0 ? 'P' : '.').repeat(1) + '.'.repeat(37) + '#'), ['#'.repeat(40)]);
  const w = HW.world.load(makeLevel(rows), 'lajkonik');
  run(w, { x: 1, y: 1 }, 1);
  assert.ok(Math.abs(Math.hypot(w.player.vx, w.player.vy) - 120) < 1);
});
test('kleks mask moves at 144 px/s', () => {
  const w = HW.world.load(makeLevel(['#' + '#'.repeat(40), '#P' + '.'.repeat(39), '#' + '#'.repeat(40)]), 'kleks');
  assert.equal(w.player.speed, 144);
  const x0 = w.player.x;
  run(w, { x: 1, y: 0 }, 1);
  assert.ok(Math.abs(w.player.x - x0 - 144) < 9, String(w.player.x - x0));
});
test('bolek starts with knife; czapka has shield', () => {
  const lvl = makeLevel(openRoom);
  assert.equal(HW.world.load(lvl, 'bolek').player.weapon.id, 'knife');
  assert.equal(HW.world.load(lvl, 'lajkonik').player.weapon, null);
  assert.equal(HW.world.load(lvl, 'czapka').player.shield, true);
  assert.equal(HW.world.load(lvl, 'lajkonik').player.shield, false);
  assert.equal(HW.masks.lolek.perk, 'doorStun');
  assert.equal(HW.masks.czapka.name, 'Czapka milicjanta');
});
test('player cannot walk through a closed door', () => {
  const w = HW.world.load(makeLevel(doorRoom), 'lajkonik');
  w.player.x = 56; w.player.y = 40; // tile (3,2); vertical door segment at x=72
  run(w, { x: 1, y: 0 }, 1.5);
  assert.ok(w.player.x > 60 && w.player.x <= 67.01, String(w.player.x));
});
test('door geometry for horizontal and vertical doors', () => {
  // D in a horizontal wall (walls left+right): hinge at left edge midpoint, closed angle 0
  const h = HW.world.load(makeLevel(hDoorRoom), 'lajkonik').floors[0].doors[0];
  assert.deepEqual({ hx: h.hx, hy: h.hy, a: h.angle, c: h.closedAngle, av: h.av, len: h.len }, { hx: 32, hy: 40, a: 0, c: 0, av: 0, len: 16 });
  const s = HW.door.segment(h);
  assert.deepEqual({ x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1 }, { x0: 32, y0: 40, x1: 48, y1: 40 });
  // D in a vertical wall (walls top+bottom): hinge at top edge midpoint, closed angle pi/2
  const v = HW.world.load(makeLevel(doorRoom), 'lajkonik').floors[0].doors[0];
  assert.equal(v.hx, 72); assert.equal(v.hy, 32);
  assert.equal(v.closedAngle, Math.PI / 2); assert.equal(v.angle, Math.PI / 2);
  const vs = HW.door.segment(v);
  assert.ok(Math.abs(vs.x1 - 72) < 1e-9 && Math.abs(vs.y1 - 48) < 1e-9);
});
test('facing follows aim', () => {
  const w = HW.world.load(makeLevel(openRoom), 'lajkonik');
  HW.sim.step(w, { ...HW.sim.emptyInput(), aim: { x: w.player.x, y: w.player.y + 50 } }, 1 / 60);
  assert.ok(Math.abs(w.player.facing - Math.PI / 2) < 1e-9);
});
test('sim.step clears noises and advances time', () => {
  const w = HW.world.load(makeLevel(openRoom), 'lajkonik');
  w.noises.push({ x: 0, y: 0, radius: 5 });
  HW.sim.step(w, HW.sim.emptyInput(), 1 / 60);
  assert.equal(w.noises.length, 0);
  assert.ok(Math.abs(w.time - 1 / 60) < 1e-12);
});
test('world shape, enemy and item defaults, level not mutated', () => {
  const lvl = makeLevel(openRoom, {
    enemies: [{ type: 'dresiarz', at: [3, 2] }, { type: 'bandzior', at: [4, 2], patrol: [[4, 2], [5, 2]], facing: 1 }, { type: 'milicjant', weapon: 'shotgun', at: [5, 3] }],
    items: [{ weapon: 'pistol', at: [2, 3] }, { weapon: 'bat', at: [2, 4] }],
  });
  const before = JSON.stringify(lvl);
  const w = HW.world.load(lvl, 'lajkonik', 7);
  const [a, b, c] = w.floors[0].enemies;
  assert.deepEqual([a.weapon.id, b.weapon.id, c.weapon.id], ['pipe', 'pistol', 'shotgun']);
  assert.equal(b.weapon.ammo, 8); assert.equal(a.weapon.ammo, null);
  assert.equal(a.x, 3 * 16 + 8); assert.equal(a.cooldown, 0); assert.equal(a.patrol, null); assert.equal(a.facing, 0);
  assert.equal(a.state, 'patrol'); assert.equal(a.floor, 0); assert.equal(a.alive, true);
  assert.deepEqual(JSON.parse(JSON.stringify(b.patrol)), [[4, 2], [5, 2]]);
  const it = w.floors[0].items[0];
  assert.deepEqual({ id: it.id, x: it.x, y: it.y, ammo: it.ammo, vx: it.vx, vy: it.vy, spin: it.spin }, { id: 'pistol', x: 40, y: 56, ammo: 8, vx: 0, vy: 0, spin: 0 });
  assert.equal(w.floors[0].items[1].ammo, null);
  assert.equal(w.player.x, 24); assert.equal(w.player.y, 24); assert.equal(w.player.cooldown, 0);
  assert.equal(w.floorIndex, 0); assert.equal(w.status, 'alive'); assert.equal(w.time, 0); assert.equal(w.mask, 'lajkonik');
  for (const k of ['projectiles', 'thrown', 'corpses', 'noises', 'events']) assert.deepEqual(JSON.parse(JSON.stringify(w[k])), []);
  w.floors[0].enemies[0].x = 999; w.floors[0].map.rows[0] = 'x';
  assert.equal(JSON.stringify(lvl), before);
});
test('load is deterministic and independent of previous worlds', () => {
  const lvl = makeLevel(doorRoom, { enemies: [{ type: 'dresiarz', at: [2, 3] }], items: [{ weapon: 'pistol', at: [2, 1] }] });
  const a = HW.world.load(lvl, 'lajkonik');
  run(a, { x: 1, y: 0 }, 2);
  const b = HW.world.load(lvl, 'lajkonik'), c = HW.world.load(lvl, 'lajkonik');
  assert.deepEqual(strip(b), strip(c));
  assert.notStrictEqual(b.floors[0].enemies[0], a.floors[0].enemies[0]);
  assert.equal(b.rng.next(), c.rng.next());
});
