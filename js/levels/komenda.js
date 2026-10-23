(function (HW) {
  'use strict';

  HW.levels = HW.levels || {};

  // Level 3: the Milicja station (Komenda Dzielnicowa) on Mokotów. Floor 0: the street with the car
  // under two flickering MO signs, the lobby with the duty desk, the office, the interrogation room
  // with its one-way mirror onto the observation room, the guard room, and the cell block: four cells
  // whose barred fronts ('w') face one corridor. Floor 1: the armoury (AKs on the floor), the
  // commandant's office, the briefing room and the lockers.
  // Bars stop bodies, not eyes or bullets: an armed inmate who spots you in the cell corridor shoots
  // through them, then comes out through his cell door. Every floor is one connected region, so
  // nobody is ever stranded behind bars as a turret (R16 hold); the observation room's AK watches the
  // interrogation room through the mirror, but its own door comes first along the corridor.
  const UP = -Math.PI / 2, DOWN = Math.PI / 2, LEFT = Math.PI;

  HW.levels.komenda = {
    id: 'komenda', title: 'POZIOM 3: KOMENDA', subtitle: 'Mokotów, 1988',
    phoneCall: [
      'Dzień dobry, mówi sierżant Wąsik z drogówki. Chodzi o pański mandat.',
      'Komenda na Mokotowie. Komendant trzyma z ludźmi z Pewexu.',
      'Areszt, pokój przesłuchań, a na górze zbrojownia. Mają kałachy.',
      'Proszę uregulować sprawę osobiście. Dziękuję, obywatelu.',
    ],
    targetScore: 14000,
    music: { root: 'E', progression: [0, 5, 6, 4] },
    floors: [{
      // street, lobby, office, interrogation, guard room, cell block
      map: [
        '############################ww##ww######ww###ww###',
        '#.....#.....#.....#.....#..........#.............#',
        '#.....#.....#.....#.....#..........#S............#',
        '#.....#.....#.....#.....#..####....#S............#',
        '#www#D#D#www#www#D#D#www#..####....#.............#',
        '#.......................D..........D.............#',
        '#.......................#..........#.............#',
        '####D########D######D#####################D#######',
        '#.........#.....#..................#.............#',
        '#.........w.....#..##....##....##..#.............#',
        '#...##....w.....#..##....##....##..D.............#',
        '#...##....w.....#..................#....######...#',
        '#.........w.....#..##....##....##..#.............#',
        '#.........#.....#..##....##....##..#.............#',
        '#######################D##################D#######',
        '#................................................#',
        '#..######........................................#',
        '#..................###########..............####.#',
        '#................................................#',
        '#..######...........................######.......#',
        '#................................................#',
        '###wwww###wwww##########D##########wwww###wwww####',
        '#................................................#',
        '#................................................#',
        '#................................................#',
        '#.......................P........................#',
        '#................................................#',
        '##################################################',
      ],
      ground: [
        { tile: 'pavement', rect: [1, 22, 48, 23] },
        { tile: 'asphalt', rect: [1, 24, 48, 26] },
      ],
      enemies: [
        { type: 'milicjant', weapon: 'pistol', at: [24, 20], patrol: null, facing: DOWN },  // behind the entrance
        { type: 'bandzior', weapon: 'pistol', at: [2, 18], patrol: [[2, 18], [17, 18]], facing: 0 }, // lobby, by the benches
        { type: 'milicjant', weapon: 'ak', at: [25, 5], patrol: null, facing: LEFT },       // guard room, behind the corridor door
        { type: 'milicjant', weapon: 'pistol', at: [23, 6], patrol: [[23, 6], [1, 6]], facing: LEFT }, // cell corridor
        { type: 'bandzior', weapon: 'shotgun', at: [7, 3], patrol: null, facing: DOWN },   // cell 2, behind its door
        { type: 'bandzior', weapon: 'pistol', at: [21, 2], patrol: null, facing: DOWN },   // cell 4, watching through the bars
        { type: 'bandzior', weapon: 'bat', at: [6, 10], patrol: null, facing: LEFT },      // interrogation room, at the table
        { type: 'milicjant', weapon: 'ak', at: [12, 10], patrol: null, facing: LEFT },     // observation room, at the mirror
      ],
      items: [
        { weapon: 'knife', at: [2, 12] },   // interrogation room
        { weapon: 'pistol', at: [33, 1] },  // guard room
        { weapon: 'pipe', at: [22, 11] },   // office
      ],
      neon: [
        { text: 'MO', color: 'cyan', at: [20, 21], flicker: true },
        { text: 'MO', color: 'magenta', at: [27, 21], flicker: true },
      ],
      stairs: [
        { at: [36, 2], to: { floor: 1, at: [37, 2] } },
        { at: [36, 3], to: { floor: 1, at: [37, 3] } },
      ],
    }, {
      // armoury, commandant's office, briefing room, lockers
      map: [
        '###ww###ww######ww########ww############ww###ww###',
        '#...........#~~~~~~~~~~~~~~~~~~#####.............#',
        '#.########..#~~~~~~~~~~~~~~~~~~~~~~#S............#',
        '#...........#~~~~~~~~#######~~~~~~~#S............#',
        '#.########..#~~~~~~~~#######~~~~~~~#.............#',
        '#...........#~~~~~~~~~~~~~~~~~~~~~~#.............#',
        '#...........#~~~~~~~~~~~~~~~~~~~~~~#.............#',
        '######D#################D#################D#######',
        '#................................................#',
        '#................................................#',
        '######################D####D######################',
        '#........................#.......................#',
        '#......######..######....#.......................#',
        '#........................#....##..##..##..##.....#',
        '#......######..######....#....##..##..##..##.....#',
        '#........................#....##..##..##..##.....#',
        '#......######..######....#.......................#',
        '#........................#.......................#',
        '###ww#####ww######ww##########ww######ww####ww####',
      ],
      enemies: [
        { type: 'milicjant', weapon: 'ak', at: [6, 6], patrol: null, facing: DOWN },       // armoury, behind its door
        { type: 'milicjant', weapon: 'ak', at: [28, 9], patrol: [[28, 9], [2, 9]], facing: LEFT }, // corridor
        { type: 'milicjant', weapon: 'shotgun', at: [24, 2], patrol: null, facing: UP },   // the commandant, at his desk
        { type: 'milicjant', weapon: 'ak', at: [2, 14], patrol: null, facing: LEFT },      // briefing room, at the blackboard
        { type: 'bandzior', weapon: 'shotgun', at: [10, 13], patrol: null, facing: LEFT }, // briefing room, in the chairs
        { type: 'bandzior', weapon: 'pistol', at: [27, 12], patrol: [[27, 12], [47, 12], [47, 17], [27, 17]], facing: 0 }, // lockers
      ],
      items: [
        { weapon: 'ak', at: [3, 3] },       // armoury, between the racks
        { weapon: 'ak', at: [8, 3] },
        { weapon: 'shotgun', at: [10, 1] }, // armoury
      ],
      neon: [],
      stairs: [
        { at: [36, 2], to: { floor: 0, at: [37, 2] } },
        { at: [36, 3], to: { floor: 0, at: [37, 3] } },
      ],
    }],
  };
})(globalThis.HW);
