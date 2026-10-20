'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { scriptList, allJsFiles, loadHW } = require('./helpers/load');

test('index.html references every js file', () => {
  const listed = new Set(scriptList());
  for (const f of allJsFiles('js')) assert.ok(listed.has(f), `${f} not in index.html`);
});
test('all scripts load in node without DOM', () => { const HW = loadHW(); assert.equal(typeof HW, 'object'); });
