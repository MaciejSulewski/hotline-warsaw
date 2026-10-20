'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadHW } = require('./helpers/load');

const HW = loadHW();
const j = (x) => JSON.parse(JSON.stringify(x));

test('blok with C unlocks bolek only', () => {
  assert.deepEqual(j(HW.masks.unlocksAfter('blok', 'C', ['lajkonik'])), ['bolek']);
});

test('blok with B unlocks bolek and lolek', () => {
  assert.deepEqual(j(HW.masks.unlocksAfter('blok', 'B', ['lajkonik'])), ['bolek', 'lolek']);
});

test('pewex with A unlocks czapka and kleks', () => {
  assert.deepEqual(j(HW.masks.unlocksAfter('pewex', 'A', ['lajkonik'])), ['czapka', 'kleks']);
});

test('already unlocked ids are not repeated', () => {
  assert.deepEqual(j(HW.masks.unlocksAfter('blok', 'A+', ['lajkonik', 'bolek'])), ['lolek', 'kleks']);
});

test('komenda with F unlocks nothing', () => {
  assert.deepEqual(j(HW.masks.unlocksAfter('komenda', 'F', ['lajkonik'])), []);
});

test('level order and nextLevel', () => {
  assert.deepEqual(j(HW.masks.levelOrder), ['blok', 'pewex', 'komenda']);
  assert.equal(HW.masks.nextLevel('blok'), 'pewex');
  assert.equal(HW.masks.nextLevel('pewex'), 'komenda');
  assert.equal(HW.masks.nextLevel('komenda'), null);
  assert.equal(HW.masks.nextLevel('nope'), null);
});
