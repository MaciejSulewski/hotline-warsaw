'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadHW } = require('./helpers/load');
const { makeLevel } = require('./helpers/fixtures');

const HW = loadHW();
const V = (lvl) => Array.from(HW.levels.validate(lvl));
const ROWS = [
  '#######',
  '#P.#..#',
  '#..D..#',
  '#.w#..#',
  '#######',
];
const enemy = (o) => Object.assign({ type: 'dresiarz', weapon: 'pipe', at: [1, 2], patrol: null, facing: 0 }, o);

function one(lvl, fragment) {
  const errs = V(lvl);
  assert.equal(errs.length, 1, JSON.stringify(errs));
  assert.ok(errs[0].includes(fragment), errs[0]);
  assert.ok(errs[0].startsWith('TEST'), errs[0]);
}

test('valid fixture has no errors', () => {
  const lvl = makeLevel(ROWS, { enemies: [enemy({}), enemy({ at: [4, 1], patrol: [[4, 1], [5, 2]] }), enemy({ weapon: undefined })], items: [{ weapon: 'pistol', at: [5, 3] }] });
  assert.deepEqual(V(lvl), []);
});
test('weapon and enemy tables', () => {
  assert.equal(HW.weapons.pistol.ammo, 8);
  assert.equal(HW.weapons.shotgun.pellets, 6);
  assert.ok(Math.abs(HW.weapons.shotgun.spread - HW.math.deg(12)) < 1e-9);
  assert.ok(Math.abs(HW.weapons.pipe.arc - HW.math.deg(120)) < 1e-9);
  assert.equal(HW.weapons.fists.lethal, false);
  assert.equal(HW.weapons.knife.throwLethal, true);
  assert.equal(HW.weapons.ak.auto, true);
  assert.equal(HW.weapons.ak.name, 'Kałach');
  assert.equal(HW.enemyTypes.milicjant.reaction, 0.15);
});
test('non-rectangular map', () => one(makeLevel(['####', '#P.', '####']), 'rectangular'));
test('unknown tile', () => one(makeLevel(['####', '#Px#', '####']), 'unknown tile'));
test('zero P', () => one(makeLevel(['####', '#..#', '####']), 'exactly one P'));
test('two P', () => one(makeLevel(['#####', '#PP.#', '#####']), 'exactly one P'));
test('door without opposing walls', () => one(makeLevel(['#####', '#P..#', '#.D.#', '#####']), 'door'));
test('door with both pairs walled', () => one(makeLevel(['#####', '#P.##', '###D#', '#####']), 'door'));
test('enemy in wall', () => one(makeLevel(ROWS, { enemies: [enemy({ at: [0, 0] })] }), 'walkable'));
test('patrol point in wall', () => one(makeLevel(ROWS, { enemies: [enemy({ patrol: [[1, 2], [0, 0]] })] }), 'patrol'));
test('unknown weapon', () => one(makeLevel(ROWS, { enemies: [enemy({ weapon: 'bazooka' })] }), 'weapon'));
test('unknown item weapon', () => one(makeLevel(ROWS, { items: [{ weapon: 'bazooka', at: [1, 2] }] }), 'weapon'));
test('unknown enemy type', () => one(makeLevel(ROWS, { enemies: [enemy({ type: 'ufo' })] }), 'type'));
test('stair target on missing floor', () => {
  const rows = ['#####', '#PS.#', '#####'];
  one(makeLevel(null, { floors: [{ map: rows, enemies: [], items: [], neon: [], stairs: [{ at: [2, 1], to: { floor: 1, at: [1, 1] } }] }] }), 'stair');
});
test('stair on non-S tile and bad target tile', () => {
  const f0 = { map: ['#####', '#PS.#', '#####'], enemies: [], items: [], neon: [], stairs: [{ at: [3, 1], to: { floor: 1, at: [1, 1] } }] };
  const f1 = { map: ['#####', '#.S.#', '#####'], enemies: [], items: [], neon: [], stairs: [{ at: [2, 1], to: { floor: 0, at: [0, 0] } }] };
  assert.equal(V(makeLevel(null, { floors: [f0, f1] })).length, 2);
});
test('targetScore 0', () => { const l = makeLevel(ROWS); l.targetScore = 0; one(l, 'targetScore'); });
