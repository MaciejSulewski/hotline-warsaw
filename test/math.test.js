'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadHW } = require('./helpers/load');
const HW = loadHW();
const M = HW.math;

test('clamp, lerp, len, approach, deg', () => {
  assert.equal(M.clamp(5, 0, 3), 3);
  assert.equal(M.clamp(-1, 0, 3), 0);
  assert.equal(M.clamp(2, 0, 3), 2);
  assert.equal(M.lerp(0, 10, 0.25), 2.5);
  assert.equal(M.len(3, 4), 5);
  assert.equal(M.approach(0, 10, 3), 3);
  assert.equal(M.approach(9, 10, 3), 10);
  assert.equal(M.approach(10, 0, 3), 7);
  assert.equal(M.deg(180), Math.PI);
});
test('norm', () => {
  // objects built inside the vm context have a foreign prototype; strict deepEqual rejects them
  assert.deepEqual({ ...M.norm(0, 0) }, { x: 0, y: 0 });
  assert.deepEqual({ ...M.norm(0, 5) }, { x: 0, y: 1 });
});
test('angleTo and angleDiff', () => {
  assert.equal(M.angleTo(0, 0, 0, 5), Math.PI / 2);
  assert.equal(M.angleDiff(M.deg(170), M.deg(-170)).toFixed(4), (-M.deg(20)).toFixed(4));
  assert.equal(M.angleDiff(M.deg(-170), M.deg(170)).toFixed(4), M.deg(20).toFixed(4));
  assert.ok(Math.abs(M.angleDiff(0, 7 * Math.PI)) <= Math.PI + 1e-9);
});
test('inArc', () => {
  assert.ok(M.inArc(0, 0, 0, M.deg(90), 20, 10, 5));
  assert.ok(!M.inArc(0, 0, 0, M.deg(90), 20, 0, 15));
  assert.ok(!M.inArc(0, 0, 0, M.deg(90), 20, 25, 0));
});
test('rng is deterministic and in range', () => {
  const a = HW.rng.create(42), b = HW.rng.create(42);
  assert.deepEqual([a.next(), a.next()], [b.next(), b.next()]);
  const r = HW.rng.create(7);
  for (let i = 0; i < 100; i++) {
    const v = r.next(); assert.ok(v >= 0 && v < 1);
    const w = r.range(2, 5); assert.ok(w >= 2 && w < 5);
  }
  assert.ok(['a', 'b'].includes(r.pick(['a', 'b'])));
});
