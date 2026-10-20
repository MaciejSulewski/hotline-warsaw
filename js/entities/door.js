(function (HW) {
  'use strict';

  const T = HW.tilemap;

  // Hinge on the left edge midpoint (horizontal door, walls left+right) or the top
  // edge midpoint (vertical door, walls top+bottom).
  function create(tx, ty, map) {
    const solid = (x, y) => T.isSolid(T.get(map, x, y));
    const horizontal = !(solid(tx, ty - 1) && solid(tx, ty + 1) && !(solid(tx - 1, ty) && solid(tx + 1, ty)));
    const closedAngle = horizontal ? 0 : Math.PI / 2;
    return {
      hx: horizontal ? tx * T.TILE : tx * T.TILE + T.TILE / 2,
      hy: horizontal ? ty * T.TILE + T.TILE / 2 : ty * T.TILE,
      angle: closedAngle, closedAngle, av: 0, len: T.TILE,
    };
  }

  function segment(d) {
    return { x0: d.hx, y0: d.hy, x1: d.hx + d.len * Math.cos(d.angle), y1: d.hy + d.len * Math.sin(d.angle) };
  }

  const SLAM_AV = 4;

  // A character pressing into the door sets its spin (not cumulative), swinging it away.
  // Returns true when this push takes the door over the slam threshold.
  function push(door, x, y, r, vx, vy) {
    const seg = segment(door);
    if (!HW.collision.circleSegment(x, y, r + 1, seg)) return false;
    const nx = -Math.sin(door.angle), ny = Math.cos(door.angle);
    const vn = vx * nx + vy * ny;
    if (vn === 0) return false;
    // Only a character moving into the door pushes it.
    const side = (x - door.hx) * nx + (y - door.hy) * ny;
    if (side !== 0 && side * vn > 0) return false;
    const cross = (x - door.hx) * vy - (y - door.hy) * vx;
    const sign = cross > 0 ? 1 : cross < 0 ? -1 : (vn > 0 ? -1 : 1);
    const w = Math.abs(vn) / 16 * 1.2;
    const before = Math.abs(door.av);
    door.av = Math.sign(door.av) === sign ? sign * Math.max(Math.abs(door.av), w) : sign * w;
    return before <= SLAM_AV && Math.abs(door.av) > SLAM_AV;
  }

  function update(world, door, dt) {
    door.angle += door.av * dt;
    const lo = door.closedAngle - Math.PI / 2, hi = door.closedAngle + Math.PI / 2;
    if (door.angle > hi) { door.angle = hi; door.av = 0; }
    else if (door.angle < lo) { door.angle = lo; door.av = 0; }
    door.av *= Math.pow(0.9, dt * 60);
    if (Math.abs(door.av) <= SLAM_AV) return;
    const seg = segment(door);
    const floor = world.floors[world.floorIndex];
    for (const e of floor.enemies) {
      if (!e.alive || e.state === 'downed') continue;
      if (HW.collision.circleSegment(e.x, e.y, e.r, seg)) {
        HW.combat.knockdown(world, e, world.mask === 'lolek' ? 5 : 2.5, 'door');
      }
    }
  }

  HW.door = { create, segment, push, update };
})(globalThis.HW);
