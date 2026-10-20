(function (HW) {
  'use strict';

  const SPEED = 600;
  const LIFE = 1.5;

  // Distance from point to segment (x0,y0)-(x1,y1).
  function segDist(cx, cy, x0, y0, x1, y1) {
    const ex = x1 - x0, ey = y1 - y0;
    const l2 = ex * ex + ey * ey;
    let t = l2 === 0 ? 0 : ((cx - x0) * ex + (cy - y0) * ey) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(x0 + ex * t - cx, y0 + ey * t - cy);
  }

  function spawn(world, x, y, angle, owner) {
    world.projectiles.push({
      x, y, vx: Math.cos(angle) * SPEED, vy: Math.sin(angle) * SPEED, owner, life: LIFE,
    });
  }

  function update(world, dt) {
    const floor = world.floors[world.floorIndex];
    const segs = floor.doors.map(HW.door.segment);
    const chars = HW.combat.characters(world);
    const keep = [];
    for (const b of world.projectiles) {
      const ox = b.x, oy = b.y;
      const nx = ox + b.vx * dt, ny = oy + b.vy * dt;
      const c = HW.raycast.cast(floor.map, segs, ox, oy, nx, ny, 'bullet');
      let victim = null, best = Infinity;
      for (const ch of chars) {
        if (ch === b.owner || !ch.alive) continue;
        if (segDist(ch.x, ch.y, ox, oy, c.x, c.y) > ch.r) continue;
        const d = Math.hypot(ch.x - ox, ch.y - oy);
        if (d < best) { best = d; victim = ch; }
      }
      if (victim) {
        HW.combat.kill(world, victim, 'gun', b.owner);
        continue;
      }
      b.life -= dt;
      if (c.hit || b.life <= 0) continue;
      b.x = nx; b.y = ny;
      keep.push(b);
    }
    world.projectiles.length = 0;
    for (const b of keep) world.projectiles.push(b);
  }

  HW.projectile = { spawn, update };
})(globalThis.HW);
