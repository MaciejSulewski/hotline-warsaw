'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadHW } = require('./helpers/load');
const { makeLevel } = require('./helpers/fixtures');

const HW = loadHW();
// Vertical door at tile (4,2): hinge (72,32), closed angle PI/2.
const doorRoom = ['#########', '#P..#...#', '#...D...#', '#...#...#', '#########'];

function load(mask, enemies = []) {
  const w = HW.world.load(makeLevel(doorRoom, { enemies }), mask);
  w.player.x = 40; w.player.y = 40;
  return w;
}
function run(w, move, secs) {
  for (let i = 0; i < Math.round(secs * 60); i++) HW.sim.step(w, { ...HW.sim.emptyInput(), move }, 1 / 60);
}
const door = (w) => w.floors[0].doors[0];
// Stationary enemy inside the door's swing arc.
const inArc = [{ type: 'dresiarz', at: [5, 2], facing: 0 }];
function placeEnemy(w) { const e = w.floors[0].enemies[0]; e.x = 84; e.y = 40; return e; }

test('player running into a door swings it open', () => {
  const w = load('lajkonik');
  const a0 = door(w).angle;
  run(w, { x: 1, y: 0 }, 0.5);
  assert.ok(Math.abs(door(w).angle - a0) > 0.5, String(door(w).angle));
});

test('sprinting through a door knocks down an enemy for 2.5 s', () => {
  const w = load('lajkonik', inArc);
  const e = placeEnemy(w);
  run(w, { x: 1, y: 0 }, 0.5);
  assert.equal(e.state, 'downed');
  assert.ok(e.downedT > 2.0 && e.downedT <= 2.5, String(e.downedT)); // ai.update counts it down
  assert.equal(e.downedBy, 'door');
  assert.ok(w.events.some((ev) => ev.type === 'knockdown'));
  assert.equal(w.events.filter((ev) => ev.type === 'door').length, 1);
});

test('lolek doubles the door knockdown to 5 s', () => {
  const w = load('lolek', inArc);
  const e = placeEnemy(w);
  run(w, { x: 1, y: 0 }, 0.5);
  assert.equal(e.state, 'downed');
  assert.ok(e.downedT > 4.5 && e.downedT <= 5, String(e.downedT));
});

test('slowly nudging a door does not knock down', () => {
  const w = load('lajkonik', inArc);
  const e = placeEnemy(w);
  w.player.speed = 20; w.player.x = 60;
  run(w, { x: 1, y: 0 }, 1);
  assert.ok(Math.abs(door(w).angle - Math.PI / 2) > 0.05, 'door should move');
  assert.notEqual(e.state, 'downed');
  assert.ok(!w.events.some((ev) => ev.type === 'door'));
});

test('door angle never exceeds closedAngle +- PI/2', () => {
  const w = load('lajkonik');
  const d = door(w);
  for (let i = 0; i < 300; i++) {
    HW.sim.step(w, { ...HW.sim.emptyInput(), move: { x: 1, y: 0 } }, 1 / 60);
    assert.ok(Math.abs(d.angle - d.closedAngle) <= Math.PI / 2 + 1e-9, String(d.angle));
  }
  d.av = 50;
  for (let i = 0; i < 120; i++) HW.door.update(w, d, 1 / 60);
  assert.ok(Math.abs(d.angle - d.closedAngle) <= Math.PI / 2 + 1e-9);
  assert.equal(d.av, 0);
});

test('push is not cumulative and ignores non-touching circles', () => {
  const w = load('lajkonik');
  const d = door(w);
  HW.door.push(d, 66, 40, 5, 60, 0);
  const av1 = d.av;
  HW.door.push(d, 66, 40, 5, 60, 0);
  assert.equal(d.av, av1);
  const d2 = HW.door.create(4, 2, HW.tilemap.parse(doorRoom));
  HW.door.push(d2, 20, 40, 5, 120, 0);
  assert.equal(d2.av, 0);
});

test('pushing a door swings it away from the pusher, from either side', () => {
  const w = load('lajkonik');
  const d = door(w); // vertical, hinge (72,32), free end at (72,48)
  HW.door.push(d, 68, 40, 5, 30, 0);
  assert.ok(d.av < 0, 'pushed from the left: free end swings toward +x, av ' + d.av);
  d.av = 0;
  HW.door.push(d, 76, 40, 5, -30, 0);
  assert.ok(d.av > 0, 'pushed from the right: free end swings toward -x, av ' + d.av);
});
