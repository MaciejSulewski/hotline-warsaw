(function (HW) {
  'use strict';

  HW.levels = HW.levels || {};

  // Level 2: the Pewex hard-currency shop on Marszałkowska, Śródmieście. Floor 0: the street with
  // the car under the magenta PEWEX sign, the shop floor (two banks of shelving, display stands,
  // checkouts, the bony exchange booth), and behind it the stockroom, the staff room and the stairs.
  // Floor 1: the manager's offices — archive, secretariat, the director's office and the counting room.
  // Shelves are wall islands: they stop bullets, so the aisles are where the gunfights happen.
  const UP = -Math.PI / 2, DOWN = Math.PI / 2, LEFT = Math.PI, RIGHT = 0;

  HW.levels.pewex = {
    id: 'pewex', title: 'POZIOM 2: PEWEX', subtitle: 'Śródmieście, 1987',
    phoneCall: [
      'Dzień dobry, tu Pewex na Marszałkowskiej. Dział reklamacji.',
      'Kierownik handluje dolarami na zapleczu. Ma swoich ludzi i broń.',
      'Sklep, magazyn i biura na piętrze. Proszę zamknąć nam dzisiaj wcześniej.',
      'Dziękujemy za zakupy w Pewexie.',
    ],
    targetScore: 11000,
    music: { root: 'D', progression: [0, 3, 5, 4] },
    floors: [{
      // street, shop floor, stockroom, staff room
      map: [
        '#####ww######ww######ww##########ww#########ww####',
        '#...........................#~~~~~~~~~#..........#',
        '#..##...###...##...###..##..#~~~~~~~~~#S.........#',
        '#..##...###...##...###..##..#~~~~~~~~~#S.........#',
        '#...........................#~~~###~~~#..........#',
        '#...........................#~~~###~~~#..........#',
        '#..###.....##...###....##...D~~~~~~~~~D..........#',
        '#..###.....##...###....##...#~~~~~~~~~#..........#',
        '#...........................#~~~~~~~~~#..........#',
        '######D###############D#####################D#####',
        '#......................................#.........#',
        '#......................................#.........#',
        '#..########..########...##...##........#...####..#',
        '#.......................##...##........D.........#',
        '#......................................#.........#',
        '#..########..########..................#.........#',
        '#......................................###########',
        '#................................................#',
        '#..########..########.......###...###............#',
        '#.........................................#####..#',
        '#................................................#',
        '#................................................#',
        '##wwwwww#####wwwwww#############D########wwwwww###',
        '#................................................#',
        '#................................................#',
        '#................................................#',
        '#...............................P................#',
        '#................................................#',
        '##################################################',
      ],
      ground: [
        { tile: 'pavement', rect: [1, 23, 48, 24] },
        { tile: 'asphalt', rect: [1, 25, 48, 27] },
      ],
      enemies: [
        { type: 'dresiarz', weapon: 'pipe', at: [32, 21], patrol: null, facing: DOWN },     // behind the shop door
        { type: 'bandzior', weapon: 'pistol', at: [29, 19], patrol: null, facing: RIGHT },  // at the left checkout
        { type: 'bandzior', weapon: 'pistol', at: [2, 14], patrol: [[2, 14], [21, 14]], facing: RIGHT }, // first aisle
        { type: 'bandzior', weapon: 'pistol', at: [21, 17], patrol: [[21, 17], [2, 17]], facing: LEFT }, // second aisle
        { type: 'bandzior', weapon: 'shotgun', at: [40, 13], patrol: null, facing: LEFT },  // bony booth, behind its door
        { type: 'dresiarz', weapon: 'bat', at: [6, 8], patrol: null, facing: DOWN },        // stockroom, behind its door
        { type: 'bandzior', weapon: 'pistol', at: [26, 5], patrol: [[26, 5], [1, 5]], facing: LEFT }, // stockroom, between the crates
        { type: 'bandzior', weapon: 'shotgun', at: [29, 6], patrol: null, facing: LEFT },   // staff room, behind its door
      ],
      items: [
        { weapon: 'knife', at: [36, 19] },  // under the right checkout
        { weapon: 'pipe', at: [13, 8] },    // stockroom
      ],
      neon: [{ text: 'PEWEX', color: 'magenta', at: [28, 22] }],
      stairs: [
        { at: [39, 2], to: { floor: 1, at: [40, 2] } },
        { at: [39, 3], to: { floor: 1, at: [40, 3] } },
      ],
    }, {
      // offices upstairs
      map: [
        '#####ww######ww##############ww############ww#####',
        '#....................#~~~~~~~~~~~~~~~~#..........#',
        '#...#...#...#...#....#~~~~~~~~~~~~~~~~#S.........#',
        '#...#...#...#...#....#~~~~~~~~~~~~~~~~#S.........#',
        '#...#...#...#...#....#~~~~~~####~~~~~~#..........#',
        '#...#...#...#...#....D~~~~~~####~~~~~~#..........#',
        '#...#...#...#...#....#~~~~~~~~~~~~~~~~#..........#',
        '#...#...#...#...#....#~~~~~~~~~~~~~~~~#..........#',
        '#....................#~~~~~~~~~~~~~~~~#..........#',
        '##########D###################D#############D#####',
        '#................................................#',
        '#................................................#',
        '############D#######################D#############',
        '#~~~~~~~~~~~~~~~~~~~~~~~~#.......................#',
        '#~~~~~~~~~~~~~~~~~~~~~~~~#.......................#',
        '#~~~~~~~~~~~~~~~~~~~~~~~~#...#####....#####......#',
        '#~~~~~~~~#######~~~~~~~~~#...#####....#####......#',
        '#~~~~~~~~~~~~~~~~~~~~~~~~#.......................#',
        '#~~~~~~~~~~~~~~~~~~~~~~~~#.......................#',
        '#~~~~~~~~~~~~~~~~~~~~~~~~#.......................#',
        '###ww##ww########ww##########ww#########ww###ww###',
      ],
      enemies: [
        { type: 'bandzior', weapon: 'shotgun', at: [12, 13], patrol: null, facing: UP },    // director's office, behind its door
        { type: 'bandzior', weapon: 'pistol', at: [27, 18], patrol: [[27, 18], [47, 18]], facing: RIGHT }, // counting room
        { type: 'dresiarz', weapon: 'bat', at: [18, 2], patrol: [[18, 2], [18, 8], [2, 8]], facing: DOWN }, // archive
      ],
      items: [
        { weapon: 'shotgun', at: [47, 14] }, // counting room, by the safe
      ],
      neon: [],
      stairs: [
        { at: [39, 2], to: { floor: 0, at: [40, 2] } },
        { at: [39, 3], to: { floor: 0, at: [40, 3] } },
      ],
    }],
  };
})(globalThis.HW);
