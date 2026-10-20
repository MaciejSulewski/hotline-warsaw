(function (HW) {
  'use strict';

  HW.levels = HW.levels || {};

  // TEMPORARY one-floor draft for the playable slice (Task 12); Task 15 replaces it.
  HW.levels.blok = {
    id: 'blok', title: 'POZIOM 1: BLOK', subtitle: 'Praga, 1986',
    phoneCall: ['Dzień dobry, tu pani Halinka z administracji.', 'Lokatorzy z parteru znowu hałasują.'],
    targetScore: 9000,
    music: { root: 'A', progression: [0, 5, 3, 4] },
    floors: [{
      map: [
        '############################',
        '#~~~~~~~#.........#........#',
        '#~~~~~~~#.........#........#',
        '#~~~~~~~D.........D........#',
        '#~~~~~~~#.........#........#',
        '#~~~~~~~#.........#........#',
        '####D#######D########w######',
        '#..........................#',
        '#..........................#',
        '#####w#####D#####w##########',
        '............................',
        '..........P.................',
        '............................',
        '############################',
      ],
      enemies: [
        { type: 'dresiarz', weapon: 'pipe', at: [4, 3], patrol: null, facing: 0 },
        { type: 'bandzior', weapon: 'pistol', at: [13, 2], patrol: null, facing: Math.PI / 2 },
        { type: 'dresiarz', weapon: 'bat', at: [12, 4], patrol: [[10, 4], [16, 4]], facing: 0 },
        { type: 'bandzior', weapon: 'shotgun', at: [23, 3], patrol: null, facing: Math.PI },
        { type: 'dresiarz', weapon: 'pipe', at: [20, 7], patrol: [[3, 7], [25, 7]], facing: Math.PI },
      ],
      items: [{ weapon: 'pistol', at: [5, 8] }],
      neon: [{ text: 'BAR MLECZNY', color: 'cyan', at: [12, 9] }],
      stairs: [],
    }],
  };
})(globalThis.HW);
