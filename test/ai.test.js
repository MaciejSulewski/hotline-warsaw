'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadHW } = require('./helpers/load');
const { makeLevel } = require('./helpers/fixtures');

const HW = loadHW();
const deg = (d) => d * Math.PI / 180;
const WIDE = [
  '########################################',
  '#P.....................................#',
  '#......................................#',
  '#......................................#',
  '#......................................#',
  '########################################',
];

function build(rows, defs, player) {
  const w = HW.world.load(makeLevel(rows || WIDE, { enemies: defs }), 'lajkonik');
  w.player.x = player ? player[0] : 600;
  w.player.y = player ? player[1] : 72;
  return w;
}
const def = (type, at, extra) => Object.assign({ type, at, facing: 0 }, extra);
const px = (t) => t * 16 + 8;
function step(w, n = 1, input) {
  for (let i = 0; i < n; i++) HW.sim.step(w, Object.assign(HW.sim.emptyInput(), input || {}), 1 / 60);
}
const evs = (w, t) => w.events.filter((e) => e.type === t);
const enemy = (w, i = 0) => w.floors[0].enemies[i];

test('sees player in cone, not behind', () => {
  const w = build(null, [def('dresiarz', [6, 2])], [px(6) + 100, px(2)]);
  const e = enemy(w);
  assert.equal(HW.ai.canSee(w, e, w.player.x, w.player.y), true);
  assert.equal(HW.ai.canSee(w, e, px(6) - 100, px(2)), false);
  assert.equal(HW.ai.canSee(w, e, px(6) + 230, px(2)), false);
  // just inside / outside the 55 degree half-angle
  const d = 30;
  assert.equal(HW.ai.canSee(w, e, e.x + d * Math.cos(deg(50)), e.y + d * Math.sin(deg(50))), true);
  assert.equal(HW.ai.canSee(w, e, e.x + d * Math.cos(deg(60)), e.y + d * Math.sin(deg(60))), false);
  w.player.alive = false;
  assert.equal(HW.ai.canSee(w, e, e.x + 50, e.y), false);
});

test('does not see through wall or closed door', () => {
  const walled = [
    '####################',
    '#P......#..........#',
    '#......##..........#',
    '#......#...........#',
    '#..................#',
    '####################',
  ];
  let w = build(walled, [def('dresiarz', [5, 1])], [px(12), px(1)]);
  assert.equal(HW.ai.canSee(w, enemy(w), w.player.x, w.player.y), false);
  const doored = [
    '####################',
    '#P......#..........#',
    '#.......D..........#',
    '#.......#..........#',
    '#.......#..........#',
    '####################',
  ];
  w = build(doored, [def('dresiarz', [5, 2])], [px(12), px(2)]);
  assert.equal(HW.ai.canSee(w, enemy(w), w.player.x, w.player.y), false);
  // same layout with the door swung open: visible
  const door = w.floors[0].doors[0];
  door.angle = door.closedAngle + Math.PI / 2;
  assert.equal(HW.ai.canSee(w, enemy(w), w.player.x, w.player.y), true);
});

test('reaction delay: no shot before 0.25 s, shot by 0.5 s', () => {
  const w = build(null, [def('bandzior', [6, 2])], [px(6) + 80, px(2)]);
  w.player.invulnT = 999;
  step(w, 14);
  assert.equal(enemy(w).state, 'alert');
  assert.equal(evs(w, 'shot').length, 0);
  step(w, 16);
  assert.ok(evs(w, 'shot').length >= 1);
  assert.equal(enemy(w).state, 'chase');
});

test('milicjant reacts in 0.15 s', () => {
  const w = build(null, [def('milicjant', [6, 2])], [px(6) + 80, px(2)]);
  step(w, 8);
  assert.equal(evs(w, 'shot').length, 0);
  step(w, 6);
  assert.ok(evs(w, 'shot').length >= 1);
});

test('gunshot within radius sends unaware enemy to investigate', () => {
  const w = build(null, [def('dresiarz', [12, 2], { facing: Math.PI }), def('dresiarz', [30, 2], { facing: Math.PI })], [px(2), px(2)]);
  // enemies face away (A looks left, towards the player, so turn it around)
  enemy(w, 0).facing = 0;
  enemy(w, 1).facing = 0;
  w.player.weapon = { id: 'pistol', ammo: 8 };
  step(w, 1, { fire: true, firePressed: true, aim: { x: w.player.x, y: w.player.y - 50 } });
  assert.equal(evs(w, 'shot').length, 1);
  assert.equal(enemy(w, 0).state, 'investigate');
  assert.equal(enemy(w, 1).state, 'patrol');
  const x0 = enemy(w, 0).x;
  step(w, 30);
  assert.ok(enemy(w, 0).x < x0 - 20);
  step(w, 400);
  assert.equal(enemy(w, 0).state === 'search' || enemy(w, 0).state === 'return' || enemy(w, 0).state === 'patrol', true);
});

test('enemy beyond noise radius stays on patrol', () => {
  const w = build(null, [def('dresiarz', [36, 2])], [px(2), px(2)]);
  w.player.weapon = { id: 'pistol', ammo: 8 };
  step(w, 1, { fire: true, firePressed: true, aim: { x: w.player.x, y: w.player.y - 50 } });
  assert.equal(w.noises.length, 1);
  assert.equal(enemy(w).state, 'patrol');
});

test('lost sight -> search -> patrol after 3 s wait', () => {
  const w = build(null, [def('dresiarz', [10, 2], { facing: Math.PI })], [px(36), px(2)]);
  const e = enemy(w);
  e.state = 'chase';
  e.lastSeen = { x: px(7), y: px(2) };
  step(w, 1);
  assert.equal(e.state, 'search');
  step(w, 60); // reaches lastSeen (48 px at 115 px/s) in ~0.42 s
  assert.ok(Math.abs(e.x - px(7)) < 5);
  assert.equal(e.state, 'search');
  step(w, 120); // ~2.4 s of waiting so far
  assert.equal(e.state, 'search');
  step(w, 40); // past 3 s
  assert.equal(e.state, 'return');
  let n = 0;
  while (e.state !== 'patrol' && n++ < 300) step(w, 1);
  assert.equal(e.state, 'patrol');
  assert.ok(Math.abs(e.x - px(10)) < 5 && Math.abs(e.y - px(2)) < 5);
  assert.ok(Math.abs(Math.abs(e.facing) - Math.PI) < 1e-9);
});

test('chasing enemy pathfinds around wall to reach player', () => {
  const rows = [
    '####################',
    '#P.......#.........#',
    '#........#.........#',
    '#........#.........#',
    '#..................#',
    '####################',
  ];
  const w = build(rows, [def('dresiarz', [15, 2], { facing: Math.PI })], [px(3), px(2)]);
  const e = enemy(w);
  e.state = 'chase';
  e.lastSeen = { x: w.player.x, y: w.player.y };
  let maxY = 0, minD = Infinity;
  for (let i = 0; i < 500; i++) {
    step(w, 1);
    maxY = Math.max(maxY, e.y);
    minD = Math.min(minD, Math.hypot(e.x - w.player.x, e.y - w.player.y));
  }
  assert.ok(maxY > 60, 'went through the gap along the bottom');
  assert.ok(minD < 20, 'reached the player');
});

test('downed enemy gets up after 2.5 s', () => {
  let w = build(null, [def('dresiarz', [10, 2])], [px(36), px(2)]);
  let e = enemy(w);
  HW.combat.knockdown(w, e, 2.5, 'fists');
  const x0 = e.x;
  step(w, 140);
  assert.equal(e.state, 'downed');
  assert.equal(e.x, x0);
  step(w, 20);
  assert.equal(e.state, 'search');
  // player visible when getting up -> chase
  w = build(null, [def('dresiarz', [10, 2])], [px(10) + 80, px(2)]);
  e = enemy(w);
  HW.combat.knockdown(w, e, 2.5, 'fists');
  w.player.invulnT = 999;
  step(w, 155);
  assert.equal(e.state, 'chase');
});

test('patrol follows waypoints in a loop', () => {
  const w = build(null, [def('dresiarz', [2, 1], { patrol: [[2, 1], [6, 1], [6, 3], [2, 3]] })]);
  const e = enemy(w);
  const wps = [[2, 1], [6, 1], [6, 3], [2, 3]].map((p) => [px(p[0]), px(p[1])]);
  const hits = [];
  for (let i = 0; i < 700; i++) {
    step(w, 1);
    const k = wps.findIndex((p) => Math.hypot(e.x - p[0], e.y - p[1]) < 6);
    if (k >= 0 && hits[hits.length - 1] !== k) hits.push(k);
  }
  assert.deepEqual(hits.slice(0, 6), [0, 1, 2, 3, 0, 1]);
  assert.equal(e.state, 'patrol');
});

test('stationary patrol keeps spawn facing; enemies on other floors are not updated', () => {
  const w = build(null, [def('dresiarz', [10, 2], { facing: 1 }), def('dresiarz', [20, 2])]);
  step(w, 30);
  assert.equal(enemy(w).facing, 1);
  assert.equal(enemy(w).state, 'patrol');
  const o = enemy(w, 1);
  o.floor = 3; o.state = 'downed'; o.downedT = 1;
  HW.ai.update(w, o, 2);
  assert.equal(o.downedT, 1);
});

test('unreachable goal does not strand the enemy', () => {
  const rows = [
    '####################',
    '#P.......#.#.......#',
    '#........###.......#',
    '#..................#',
    '####################',
  ];
  const w = build(rows, [def('dresiarz', [3, 2])]);
  const e = enemy(w);
  e.state = 'investigate';
  e.target = { x: px(10), y: px(1) }; // sealed pocket
  step(w, 5);
  assert.equal(e.state, 'search');
  step(w, 200);
  assert.equal(e.state, 'patrol');
  // chase towards an unreachable lastSeen falls back to search
  e.state = 'chase';
  e.lastSeen = { x: px(10), y: px(1) };
  step(w, 1);
  assert.equal(e.state, 'search');
});

test('melee enemy swings at range <= weapon.range + player.r', () => {
  const reach = HW.weapons.pipe.range + 5;
  let w = build(null, [def('dresiarz', [6, 2])], [px(6) + reach - 1, px(2)]);
  w.player.invulnT = 999;
  enemy(w).state = 'chase';
  step(w, 1);
  assert.equal(evs(w, 'swing').length, 1);
  w = build(null, [def('dresiarz', [6, 2])], [px(6) + reach + 6, px(2)]);
  w.player.invulnT = 999;
  enemy(w).state = 'chase';
  step(w, 1);
  assert.equal(evs(w, 'swing').length, 0);
});

test('gun enemy with empty gun drops it and fights with fists', () => {
  const w = build(null, [def('bandzior', [6, 2])], [px(6) + 60, px(2)]);
  w.player.invulnT = 999;
  const e = enemy(w);
  e.weapon.ammo = 0;
  e.state = 'chase';
  step(w, 1);
  assert.equal(e.weapon, null);
  const item = w.floors[0].items.find((i) => i.id === 'pistol');
  assert.ok(item && item.ammo === 0);
  const x0 = e.x;
  step(w, 30);
  assert.ok(e.x > x0 + 10, 'closes in to melee');
  assert.equal(evs(w, 'click').length, 0);
});

test('visible but unreachable player: stays in chase, holds position, keeps shooting', () => {
  const rows = ['####################', '#P.................#', '#wwwwwwwwwwwwwwwwww#']
    .concat(Array(6).fill('#..................#')).concat(['####################']);
  const w = build(rows, [def('bandzior', [5, 1], { facing: Math.PI / 2 })], [px(5), px(7)]);
  w.player.invulnT = 999;
  const e = enemy(w);
  e.state = 'chase';
  const x0 = e.x, y0 = e.y;
  step(w, 120);
  assert.equal(e.state, 'chase');
  assert.equal(e.x, x0);
  assert.equal(e.y, y0);
  assert.ok(evs(w, 'shot').length >= 2);
});
