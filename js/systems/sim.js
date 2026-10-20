(function (HW) {
  'use strict';

  function emptyInput() {
    return {
      move: { x: 0, y: 0 }, aim: { x: 0, y: 0 },
      fire: false, firePressed: false, throwPressed: false, executePressed: false, look: false,
    };
  }

  function step(world, input, dt) {
    world.noises.length = 0;
    world.time += dt;
    const floor = world.floors[world.floorIndex];
    world.player.cooldown = Math.max(0, world.player.cooldown - dt);
    for (const e of floor.enemies) e.cooldown = Math.max(0, e.cooldown - dt);
    HW.player.update(world, input, dt);
    const chars = [world.player].concat(floor.enemies.filter((e) => e.alive && e.state !== 'downed'));
    for (const door of floor.doors) {
      for (const c of chars) {
        if (c === world.player && !c.alive) continue;
        if (HW.door.push(door, c.x, c.y, c.r, c.vx || 0, c.vy || 0)) {
          const s = HW.door.segment(door);
          world.events.push({ type: 'door', x: (s.x0 + s.x1) / 2, y: (s.y0 + s.y1) / 2 });
        }
      }
    }
    for (const door of floor.doors) HW.door.update(world, door, dt);
    HW.projectile.update(world, dt);
    HW.combat.updateThrown(world, dt);
  }

  HW.sim = { step, emptyInput };
})(globalThis.HW);
