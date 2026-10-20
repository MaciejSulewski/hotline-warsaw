'use strict';

function makeLevel(rows, opts = {}) {
  const { enemies = [], items = [], floors } = opts;
  return {
    id: 'test',
    title: 'TEST',
    subtitle: 'Test',
    phoneCall: [],
    targetScore: 1000,
    music: { root: 'A', progression: [0, 5, 3, 4] },
    floors: floors || [{ map: rows, enemies, items, neon: [], stairs: [] }],
  };
}

module.exports = { makeLevel };
