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

test('optimal vs Dijkstra on seeded random maps', () => {
  const walkable = (m, x, y) => T.isWalkable(T.get(m, x, y));
  const dijkstra = (m, s, g) => {
    const N = 12, dist = new Map([[s.join(), 0]]), done = new Set();
    for (;;) {
      let best = null, bd = Infinity;
      for (const [k, d] of dist) if (!done.has(k) && d < bd) { best = k; bd = d; }
      if (best === null) return Infinity;
      if (best === g.join()) return bd;
      done.add(best);
      const [cx, cy] = best.split(',').map(Number);
      for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N || !walkable(m, nx, ny)) continue;
        if (dx && dy && !(walkable(m, cx + dx, cy) && walkable(m, cx, cy + dy))) continue;
        const nd = bd + (dx && dy ? Math.SQRT2 : 1), k = nx + ',' + ny;
        if (nd < (dist.has(k) ? dist.get(k) : Infinity)) dist.set(k, nd);
      }
    }
  };
  let seed = 12345;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 6000; i++) {
    const rows = [];
    for (let y = 0; y < 12; y++) {
      let r = '';
      for (let x = 0; x < 12; x++) r += rnd() < 0.3 ? '#' : '.';
      rows.push(r);
    }
    const map = T.parse(rows);
    const s = [(rnd() * 12) | 0, (rnd() * 12) | 0], g = [(rnd() * 12) | 0, (rnd() * 12) | 0];
    if (!walkable(map, ...s) || !walkable(map, ...g) || s.join() === g.join()) continue;
    const want = dijkstra(map, s, g);
    const p = PF.find(map, s, g);
    if (want === Infinity) { assert.equal(p, null); continue; }
    let cost = 0, prev = s;
    for (const q of p) {
      cost += q[0] !== prev[0] && q[1] !== prev[1] ? Math.SQRT2 : 1;
      prev = q;
    }
    assert.ok(Math.abs(cost - want) < 1e-9, `map ${i}: ${cost} vs ${want}`);
  }
});

test('out-of-bounds start or goal returns null', () => {
  const map = T.parse(['###', '#.#', '###']);
  assert.equal(PF.find(map, [-1, 1], [1, 1]), null);
  assert.equal(PF.find(map, [1, 1], [5, 5]), null);
});
