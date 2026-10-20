'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadHW } = require('./helpers/load');

const HW = loadHW();
const j = (x) => JSON.parse(JSON.stringify(x));
const DEFAULTS = { unlockedLevels: ['blok'], unlockedMasks: ['lajkonik'], bestScores: {} };
const fake = (value) => ({ getItem: () => value, setItem() {} });

test('key and defaults', () => {
  assert.equal(HW.save.KEY, 'hotline-warsaw-save-v1');
  assert.deepEqual(j(HW.save.defaults()), DEFAULTS);
});

test('null storage gives defaults', () => {
  assert.deepEqual(j(HW.save.load(null)), DEFAULTS);
});

test('getItem throwing gives defaults', () => {
  const s = { getItem() { throw new Error('denied'); } };
  assert.deepEqual(j(HW.save.load(s)), DEFAULTS);
});

test('missing item and garbage JSON give defaults', () => {
  assert.deepEqual(j(HW.save.load(fake(null))), DEFAULTS);
  assert.deepEqual(j(HW.save.load(fake('{nope'))), DEFAULTS);
  assert.deepEqual(j(HW.save.load(fake('42'))), DEFAULTS);
  assert.deepEqual(j(HW.save.load(fake('null'))), DEFAULTS);
});

test('partial JSON merges with defaults and drops unknown keys', () => {
  const d = HW.save.load(fake(JSON.stringify({ unlockedLevels: ['blok', 'pewex'], extra: 1 })));
  assert.deepEqual(j(d), { unlockedLevels: ['blok', 'pewex'], unlockedMasks: ['lajkonik'], bestScores: {} });
});

test('wrong-typed fields fall back per field', () => {
  const d = HW.save.load(fake(JSON.stringify({
    unlockedLevels: 'blok', unlockedMasks: ['bolek', 5], bestScores: [1],
  })));
  assert.deepEqual(j(d), DEFAULTS);
});

test('first default entries are always present', () => {
  const d = HW.save.load(fake(JSON.stringify({ unlockedLevels: ['pewex'], unlockedMasks: ['bolek'] })));
  assert.deepEqual(j(d.unlockedLevels), ['blok', 'pewex']);
  assert.deepEqual(j(d.unlockedMasks), ['lajkonik', 'bolek']);
});

test('store writes JSON under KEY and returns true', () => {
  const calls = [];
  const s = { setItem: (k, v) => calls.push([k, v]) };
  assert.equal(HW.save.store(s, DEFAULTS), true);
  assert.equal(calls[0][0], HW.save.KEY);
  assert.deepEqual(JSON.parse(calls[0][1]), DEFAULTS);
});

test('store returns false on throw or null storage', () => {
  assert.equal(HW.save.store({ setItem() { throw new Error('quota'); } }, DEFAULTS), false);
  assert.equal(HW.save.store(null, DEFAULTS), false);
});

test('recordResult keeps higher best and unlocks next level and masks', () => {
  const start = HW.save.defaults();
  const r1 = HW.save.recordResult(start, 'blok', 500, 'B');
  assert.deepEqual(j(start), DEFAULTS, 'input not mutated');
  assert.equal(r1.newLevel, 'pewex');
  assert.deepEqual(j(r1.newMasks), ['bolek', 'lolek']);
  assert.deepEqual(j(r1.data.unlockedLevels), ['blok', 'pewex']);
  assert.deepEqual(j(r1.data.unlockedMasks), ['lajkonik', 'bolek', 'lolek']);
  assert.deepEqual(j(r1.data.bestScores), { blok: { score: 500, grade: 'B' } });

  const r2 = HW.save.recordResult(r1.data, 'blok', 300, 'C');
  assert.deepEqual(j(r2.data.bestScores.blok), { score: 500, grade: 'B' });
  assert.equal(r2.newLevel, null);
  assert.deepEqual(j(r2.newMasks), []);

  const r3 = HW.save.recordResult(r2.data, 'blok', 900, 'A');
  assert.deepEqual(j(r3.data.bestScores.blok), { score: 900, grade: 'A' });
  assert.deepEqual(j(r3.newMasks), ['kleks']);
});

test('recordResult on last level has no next level', () => {
  const r = HW.save.recordResult(HW.save.defaults(), 'komenda', 10, 'F');
  assert.equal(r.newLevel, null);
});
