'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { loadHW } = require('./helpers/load');

const HW = loadHW();
const C = HW.collision, R = HW.raycast, TM = HW.tilemap;
const map = TM.parse(['#####', '#...#', '#.#.#', '#.w.#', '#####']);

test('tilemap basics', () => {
  assert.equal(map.w, 5); assert.equal(map.h, 5);
  assert.equal(TM.get(map, -1, 0), '#'); assert.equal(TM.get(map, 1, 1), '.');
  assert.ok(TM.isSolid('w') && !TM.blocksBullets('w') && !TM.blocksSight('w'));
  assert.ok(TM.isWalkable('~') && !TM.isWalkable('w') && !TM.isWalkable('#'));
  assert.deepEqual(JSON.parse(JSON.stringify(TM.find(map, 'w'))), [[2, 3]]);
  assert.equal(TM.toTile(33), 2); assert.equal(TM.center(2), 40);
});
test('circle cannot pass into wall', () => { const p = C.moveCircle(map, [], 24, 24, 5, -20, 0); assert.ok(p.x >= 16 + 5); });
test('circle slides along wall', () => { const p = C.moveCircle(map, [], 24, 24, 5, -20, 6); assert.equal(p.y, 30); });
test('large move does not tunnel', () => {
  const p = C.moveCircle(map, [], 24, 24, 5, 200, 0);
  assert.ok(p.x <= 64 - 5);
});
test('window blocks movement', () => {
  const p = C.moveCircle(map, [], 40, 40, 5, 0, 0);
  assert.equal(p.y, 40);
  const q = C.moveCircle(map, [], 24, 56, 5, 20, 0);
  assert.ok(q.x <= 32 - 5 + 1e-3);
});
test('segment blocks circle', () => {
  const p = C.moveCircle(map, [{ x0: 40, y0: 16, x1: 40, y1: 32 }], 24, 24, 5, 30, 0);
  assert.ok(p.x <= 35 + 1e-3);
  assert.ok(C.circleSegment(37, 24, 5, { x0: 40, y0: 16, x1: 40, y1: 32 }));
});
test('window blocks movement but not bullets or sight', () => {
  assert.ok(R.clear(map, [], 24, 56, 56, 56, 'bullet'));
  assert.ok(R.clear(map, [], 24, 56, 56, 56, 'sight'));
});
test('wall blocks sight', () => assert.ok(!R.clear(map, [], 24, 40, 56, 40, 'sight')));
test('segment blocks ray and reports index', () => {
  const r = R.cast(map, [{ x0: 40, y0: 16, x1: 40, y1: 32 }], 24, 24, 56, 24, 'bullet');
  assert.equal(r.segIndex, 0); assert.equal(Math.round(r.x), 40);
});
test('tile hit reports -1 and nothing hit returns endpoint', () => {
  const r = R.cast(map, [], 24, 40, 56, 40, 'bullet');
  assert.ok(r.hit); assert.equal(r.segIndex, -1); assert.equal(Math.round(r.x), 32);
  const n = R.cast(map, [], 24, 24, 56, 24, 'bullet');
  assert.deepEqual(JSON.parse(JSON.stringify(n)), { hit: false, x: 56, y: 24, t: 1, segIndex: -1 });
});
