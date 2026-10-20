(function (HW) {
  'use strict';

  const T = HW.tilemap;

  function load(level, maskId, seed = 1) {
    const floors = level.floors.map((f, fi) => {
      const map = T.parse(f.map);
      return {
        map,
        doors: T.find(map, 'D').map((d) => HW.door.create(d[0], d[1], map)),
        items: (f.items || []).map((it) => ({
          id: it.weapon, x: T.center(it.at[0]), y: T.center(it.at[1]),
          ammo: HW.weapons[it.weapon].ammo, vx: 0, vy: 0, spin: 0,
        })),
        enemies: (f.enemies || []).map((e) => HW.enemy.create(e, fi)),
      };
    });
    const start = T.find(floors[0].map, 'P')[0];
    return {
      level, floorIndex: 0, floors,
      player: HW.player.create(T.center(start[0]), T.center(start[1]), maskId),
      projectiles: [], thrown: [], corpses: [], noises: [], events: [],
      time: 0, status: 'alive',
      score: HW.scoring ? HW.scoring.create() : null,
      mask: maskId,
      rng: HW.rng.create(seed),
    };
  }

  HW.world = { load };
})(globalThis.HW);
