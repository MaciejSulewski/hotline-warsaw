(function (HW) {
  'use strict';

  HW.enemyTypes = {
    dresiarz: { reaction: 0.25 },
    bandzior: { reaction: 0.25 },
    milicjant: { reaction: 0.15 },
  };

  const DEFAULT_WEAPON = { dresiarz: 'pipe', bandzior: 'pistol', milicjant: 'ak' };

  // Behaviour is filled in by the AI task; this builds the initial record.
  function create(def, floorIndex) {
    const id = def.weapon !== undefined ? def.weapon : DEFAULT_WEAPON[def.type];
    return {
      type: def.type,
      x: HW.tilemap.center(def.at[0]), y: HW.tilemap.center(def.at[1]),
      r: 5, facing: def.facing || 0,
      weapon: { id, ammo: HW.weapons[id].ammo },
      state: 'patrol',
      patrol: def.patrol ? def.patrol.map((p) => p.slice()) : null,
      floor: floorIndex, downedT: 0, cooldown: 0, alive: true,
    };
  }

  HW.enemy = { create };
})(globalThis.HW);
