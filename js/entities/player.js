(function (HW) {
  'use strict';

  const M = HW.math;
  const BASE_SPEED = 120;
  const ACCEL_TIME = 0.08;

  function create(x, y, maskId) {
    const perk = HW.masks[maskId] ? HW.masks[maskId].perk : null;
    return {
      x, y, r: 5, vx: 0, vy: 0, facing: 0,
      weapon: perk === 'knife' ? { id: 'knife', ammo: null } : null,
      cooldown: 0, executing: null, alive: true,
      shield: perk === 'shield',
      speed: perk === 'speed' ? BASE_SPEED * 1.2 : BASE_SPEED,
    };
  }

  function update(world, input, dt) {
    const p = world.player;
    const floor = world.floors[world.floorIndex];
    const dir = M.norm(input.move.x, input.move.y);
    const step = p.speed / ACCEL_TIME * dt;
    p.vx = M.approach(p.vx, dir.x * p.speed, step);
    p.vy = M.approach(p.vy, dir.y * p.speed, step);
    const segs = floor.doors.map(HW.door.segment);
    const pos = HW.collision.moveCircle(floor.map, segs, p.x, p.y, p.r, p.vx * dt, p.vy * dt);
    p.x = pos.x; p.y = pos.y;
    p.facing = M.angleTo(p.x, p.y, input.aim.x, input.aim.y);
  }

  HW.player = { create, update };
})(globalThis.HW);
