(function (HW) {
  'use strict';

  HW.enemyTypes = {
    dresiarz: { reaction: 0.25 },
    bandzior: { reaction: 0.25 },
    milicjant: { reaction: 0.15 },
  };

  const DEFAULT_WEAPON = { dresiarz: 'pipe', bandzior: 'pistol', milicjant: 'ak' };

  // Builds the initial record; behaviour lives in systems/ai.js.
  function create(def, floorIndex) {
    const id = def.weapon !== undefined ? def.weapon : DEFAULT_WEAPON[def.type];
    const x = HW.tilemap.center(def.at[0]), y = HW.tilemap.center(def.at[1]);
    const facing = def.facing || 0;
    return {
      type: def.type,
      x, y, vx: 0, vy: 0,
      r: 5, facing,
      home: { x, y, facing },
      wp: 0, reactT: 0, searchT: 0, lastSeen: null, target: null,
      path: null, repathT: 0,
      weapon: { id, ammo: HW.weapons[id].ammo },
      state: 'patrol',
      patrol: def.patrol ? def.patrol.map((p) => p.slice()) : null,
      floor: floorIndex, downedT: 0, cooldown: 0, alive: true,
    };
  }

  HW.enemy = { create };
})(globalThis.HW);
