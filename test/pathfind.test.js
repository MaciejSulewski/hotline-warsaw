'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadHW } = require('./helpers/load');

const HW = loadHW();
const PF = { find: (...a) => { const r = HW.pathfind.find(...a); return r && JSON.parse(JSON.stringify(r)); } };
const T = HW.tilemap;

test('finds route around wall', () => {
  const map = T.parse([
    '#####',
    '#.#.#',
    '#...#',
    '#####',
  ]);
  const p = PF.find(map, [1, 1], [3, 1]);
  assert.deepEqual(p.at(-1), [3, 1]);
  assert.ok(!p.some(([x, y]) => x === 1 && y === 1), 'excludes start');
  assert.ok(p.every(([x, y]) => T.isWalkable(T.get(map, x, y))));
});

test('no corner cutting', () => {
  const map = T.parse([
    '####',
    '#.##',
    '##.#',
    '####',
  ]);
  assert.equal(T.get(map, 2, 2), '.');
  assert.equal(PF.find(map, [1, 1], [2, 2]), null);
});

test('diagonal allowed when both orthogonals walkable', () => {
  const map = T.parse(['####', '#..#', '#..#', '####']);
  assert.deepEqual(PF.find(map, [1, 1], [2, 2]), [[2, 2]]);
});

test('unreachable returns null', () => {
  const map = T.parse(['#####', '#.#.#', '#####']);
  assert.equal(PF.find(map, [1, 1], [3, 1]), null);
  assert.equal(PF.find(map, [1, 1], [0, 0]), null);
});

test('start equals goal returns []', () => {
  const map = T.parse(['###', '#.#', '###']);
  assert.deepEqual(PF.find(map, [1, 1], [1, 1]), []);
});

test('doors are passable and shortest path is chosen', () => {
  const map = T.parse(['#####', '#.D.#', '#####']);
  assert.deepEqual(PF.find(map, [1, 1], [3, 1]), [[2, 1], [3, 1]]);
});
