(function (HW) {
  'use strict';

  HW.levels = HW.levels || {};

  // Level 1: a wielka płyta block on Ząbkowska street, Praga. Floor 0: the street with the car and the
  // BAR MLECZNY neon, the milk bar, the stairwell lobby, three flats off the corridor and one off the
  // lobby. Floor 1: four more flats round the same stairwell. Door guards stand right behind doors,
  // so running in knocks them down.
  const UP = -Math.PI / 2, DOWN = Math.PI / 2, LEFT = Math.PI, RIGHT = 0;

  HW.levels.blok = {
    id: 'blok', title: 'POZIOM 1: BLOK', subtitle: 'Praga, 1986',
    phoneCall: [
      'Dzień dobry, tu pani Halinka z administracji.',
      'Blok na Ząbkowskiej, ten nad barem mlecznym. Lokatorzy znowu hałasują.',
      'Parter i pierwsze piętro. Proszę ich uciszyć. Wszystkich.',
      'Spółdzielnia będzie wdzięczna. Do widzenia.',
    ],
    targetScore: 9000,
    music: { root: 'A', progression: [0, 5, 3, 4] },
    floors: [{
      // ground floor + street
      map: [
        '###ww##w####w#####ww####ww##w#####ww#w#####ww###',
        '#~~~~~~~~~#....#.....#~~~~~~~~~#~~~~~~~~#......#',
        '#~~~~~~~~~#....#.....D~~~~~~~~~#~~~~~~~~#......#',
        '#~~~~~~~~~D....#.....#~~~~~~~~~#~~~~~~~~#......#',
        '#~~~~~~~~~#....#######~~~~~~~~~#~~~~~~~~#......#',
        '#~~~~~~~~~##D###.....#~~~~~~~~~#~~~~~~~~#......#',
        '#~~~~~~~~~#....#.....#~~~~~~~~~####D#######D####',
        '#~~~~~~~~~#....###D#######D#####...............#',
        '#~~~~~~~~~#....#...............#...............#',
        '#~~~~~~~~~#....#...............#...............#',
        '#####D#################D##############D#########',
        'w..............................................w',
        'w..............................................w',
        '##########D###########....######################',
        '#...................#......#~~~~~~~~~~#........#',
        '#...#...#......#....#S.....#~~~~~~~~~~D........#',
        '#...#...#......#....#S.....#~~~~~~~~~~#........#',
        '#...................#......D~~~~~~~~~~#........#',
        '##############......#......#~~~~~~~~~~####D#####',
        '#...................#......#~~~~~~~~~~#........#',
        '#...................#......#~~~~~~~~~~#........#',
        '#...................#......#~~~~~~~~~~#........#',
        '#...................#......#~~~~~~~~~~#........#',
        '##ww############D#w#####D#####ww##ww#####w##w###',
        '#..............................................#',
        '#..............................................#',
        '#..............................................#',
        '#..........P...................................#',
        '#..............................................#',
        '#..............................................#',
        '################################################',
      ],
      ground: [
        { tile: 'pavement', rect: [1, 24, 46, 25] },
        { tile: 'asphalt', rect: [1, 26, 46, 29] },
      ],
      enemies: [
        { type: 'dresiarz', weapon: 'pipe', at: [24, 22], patrol: null, facing: DOWN },     // behind the main entrance
        { type: 'dresiarz', weapon: 'pipe', at: [10, 14], patrol: null, facing: UP },       // milk bar, behind the corridor door
        { type: 'dresiarz', weapon: 'bat', at: [12, 17], patrol: [[2, 17], [18, 17]], facing: LEFT }, // milk bar, along the counter
        { type: 'dresiarz', weapon: 'pipe', at: [5, 9], patrol: null, facing: DOWN },       // flat 1, behind its door
        { type: 'dresiarz', weapon: 'pipe', at: [23, 2], patrol: [[23, 2], [29, 5]], facing: RIGHT }, // flat 2, pacing the room
        { type: 'bandzior', weapon: 'pistol', at: [28, 17], patrol: null, facing: LEFT },   // flat off the lobby, behind its door
      ],
      items: [
        { weapon: 'knife', at: [3, 20] },   // milk bar kitchen, behind the counter
        { weapon: 'pistol', at: [13, 2] },  // flat 1 kitchen
      ],
      neon: [{ text: 'BAR MLECZNY', color: 'cyan', at: [5, 23] }],
      stairs: [
        { at: [21, 15], to: { floor: 1, at: [22, 15] } },
        { at: [21, 16], to: { floor: 1, at: [22, 16] } },
      ],
    }, {
      // first floor
      map: [
        '###ww#####w###ww########ww####ww#######w####w###',
        '#......#~~~~~~~~~~~~#~~~~~~~~~~~~~~#...........#',
        '#......D~~~~~~~~~~~~#~~~~~~~~~~~~~~#...........#',
        '#......#~~~~~~~~~~~~#~~~~~~~~~~~~~~D...........#',
        '########~~~~~~~~~~~~#~~~~~~~~~~~~~~#...........#',
        '#......#~~~~~~~~~~~~#~~~~~~~~~~~~~~#####D#######',
        '#......#~~~~~~~~~~~~#~~~~~~~~~~~~~~#...........#',
        '###D#########D#######~~~~~~~~~~~~~~#...........#',
        '#...................#~~~~~~~~~~~~~~#...........#',
        '#...................#~~~~~~~~~~~~~~#...........#',
        '##########D#################D###################',
        'w..............................................w',
        'w..............................................w',
        '#######D##############....######################',
        '#...................#......#~~~~~~~~~~#........#',
        '#...................#S.....#~~~~~~~~~~D........#',
        '#####D##########D####S.....#~~~~~~~~~~#........#',
        '#~~~~~~~~~~~#.......#......D~~~~~~~~~~#........#',
        '#~~~~~~~~~~~#.......#......#~~~~~~~~~~####D#####',
        '#~~~~~~~~~~~#.......#......#~~~~~~~~~~#........#',
        '#~~~~~~~~~~~#.......#......#~~~~~~~~~~#........#',
        '#~~~~~~~~~~~#.......#......#~~~~~~~~~~#........#',
        '#~~~~~~~~~~~#.......#......#~~~~~~~~~~#........#',
        '###ww####w######ww############ww##ww#####w##w###',
      ],
      enemies: [
        { type: 'dresiarz', weapon: 'pipe', at: [12, 12], patrol: [[2, 12], [19, 12]], facing: LEFT }, // corridor
        { type: 'dresiarz', weapon: 'bat', at: [28, 9], patrol: null, facing: DOWN },     // the den, behind its door
        { type: 'bandzior', weapon: 'pistol', at: [44, 2], patrol: null, facing: LEFT },  // the den's kitchen
        { type: 'dresiarz', weapon: 'pipe', at: [7, 14], patrol: null, facing: UP },      // flat 6 hallway, behind its door
      ],
      items: [
        { weapon: 'bat', at: [32, 19] },  // flat 7
      ],
      neon: [],
      stairs: [
        { at: [21, 15], to: { floor: 0, at: [22, 15] } },
        { at: [21, 16], to: { floor: 0, at: [22, 16] } },
      ],
    }],
  };
})(globalThis.HW);
