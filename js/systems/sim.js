(function (HW) {
  'use strict';

  function emptyInput() {
    return {
      move: { x: 0, y: 0 }, aim: { x: 0, y: 0 },
      fire: false, firePressed: false, throwPressed: false, executePressed: false, look: false,
    };
  }

  function enemiesAllDead(world) {
    // A level with no enemies at all is never "cleared" (keeps empty fixture levels playable).
    const all = world.floors.reduce((a, f) => a.concat(f.enemies), []);
    return all.length > 0 && all.every((e) => !e.alive);
  }

  function updateStairs(world) {
    const p = world.player;
    const T = HW.tilemap;
    const floor = world.floors[world.floorIndex];
    const tx = T.toTile(p.x), ty = T.toTile(p.y);
    const onStairs = T.get(floor.map, tx, ty) === 'S';
    if (!onStairs) { p.stairLock = false; return; }
    if (p.stairLock) return;
    const link = (world.level.floors[world.floorIndex].stairs || [])
      .find((s) => s.at[0] === tx && s.at[1] === ty);
    if (!link) return;
    world.floorIndex = link.to.floor;
    p.x = T.center(link.to.at[0]); p.y = T.center(link.to.at[1]);
    p.stairLock = true;
    world.projectiles.length = 0;
    world.thrown.length = 0;
    world.events.push({ type: 'floor', floor: link.to.floor, x: p.x, y: p.y });
  }

  function updateStatus(world) {
    const p = world.player;
    if (world.status === 'cleared' && world.floorIndex === 0) {
      const T = HW.tilemap;
      if (T.get(world.floors[0].map, T.toTile(p.x), T.toTile(p.y)) === 'P') {
        world.status = 'won';
        world.events.push({ type: 'won', x: p.x, y: p.y });
      }
    }
    if (world.status === 'alive' && enemiesAllDead(world)) {
      world.status = 'cleared';
      world.events.push({ type: 'cleared', x: p.x, y: p.y });
    }
  }

  function step(world, input, dt) {
    if (world.status === 'won') return;
    world.noises.length = 0;
    world.time += dt;
    const floor = world.floors[world.floorIndex];
    world.player.cooldown = Math.max(0, world.player.cooldown - dt);
    for (const e of floor.enemies) e.cooldown = Math.max(0, e.cooldown - dt);
    HW.player.update(world, input, dt);
    for (const e of floor.enemies) if (e.alive) HW.ai.update(world, e, dt);
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
    HW.scoring.tick(world.score, world.time);
    if (world.player.alive) updateStairs(world);
    updateStatus(world);
  }

  HW.sim = { step, emptyInput };
})(globalThis.HW);
