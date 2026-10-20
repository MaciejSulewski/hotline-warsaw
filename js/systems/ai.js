(function (HW) {
  'use strict';

  const M = HW.math;
  const T = HW.tilemap;
  const SIGHT_RANGE = 220;
  const SIGHT_HALF = M.deg(55);
  const PATROL_SPEED = 90;
  const CHASE_SPEED = 115;
  const ARRIVE = 4;
  const REPATH = 0.5;
  const SEARCH_WAIT = 3;
  const AIM_ERROR = M.deg(4);
  const GUN_STANDOFF = 90;

  function floorOf(world) { return world.floors[world.floorIndex]; }

  function canSee(world, e, x, y) {
    if (!world.player.alive) return false;
    const dx = x - e.x, dy = y - e.y;
    if (dx * dx + dy * dy > SIGHT_RANGE * SIGHT_RANGE) return false;
    if (Math.abs(M.angleDiff(e.facing, Math.atan2(dy, dx))) > SIGHT_HALF) return false;
    const floor = floorOf(world);
    return HW.raycast.clear(floor.map, floor.doors.map(HW.door.segment), e.x, e.y, x, y, 'sight');
  }

  // True when a body-width corridor along the line to (x, y) is free of walls and doors.
  function wideClear(world, e, x, y) {
    const floor = floorOf(world);
    const segs = floor.doors.map(HW.door.segment);
    const a = Math.atan2(y - e.y, x - e.x) + Math.PI / 2;
    const ox = Math.cos(a) * e.r, oy = Math.sin(a) * e.r;
    return [-1, 0, 1].every((k) => HW.raycast.clear(floor.map, segs, e.x + ox * k, e.y + oy * k, x + ox * k, y + oy * k, 'sight'));
  }

  function setState(e, state) {
    e.state = state;
    e.path = null; e.repathT = 0;
  }

  // Moves one step toward (gx, gy), by straight line when `direct`, else along an A* path.
  // Returns true once within ARRIVE px of the goal (or when the goal is unreachable).
  function walkTo(world, e, gx, gy, speed, dt, direct) {
    const floor = floorOf(world);
    let tx = gx, ty = gy;
    if (!direct) {
      const etx = T.toTile(e.x), ety = T.toTile(e.y);
      const gtx = T.toTile(gx), gty = T.toTile(gy);
      e.repathT -= dt;
      if (e.path === null || e.repathT <= 0) {
        e.path = HW.pathfind.find(floor.map, [etx, ety], [gtx, gty]) || [];
        e.repathT = REPATH;
      }
      while (e.path.length && Math.hypot(T.center(e.path[0][0]) - e.x, T.center(e.path[0][1]) - e.y) < ARRIVE) e.path.shift();
      if (e.path.length) { tx = T.center(e.path[0][0]); ty = T.center(e.path[0][1]); }
    }
    const dx = tx - e.x, dy = ty - e.y;
    const dist = Math.hypot(dx, dy);
    if (e.path && !e.path.length && Math.hypot(gx - e.x, gy - e.y) < ARRIVE) { e.vx = 0; e.vy = 0; return true; }
    if (direct && dist < ARRIVE) { e.vx = 0; e.vy = 0; return true; }
    if (dist === 0) { e.vx = 0; e.vy = 0; return !direct && !e.path.length; }
    const sp = Math.min(speed, dist / dt);
    e.vx = dx / dist * sp; e.vy = dy / dist * sp;
    const pos = HW.collision.moveCircle(floor.map, floor.doors.map(HW.door.segment), e.x, e.y, e.r, e.vx * dt, e.vy * dt);
    e.x = pos.x; e.y = pos.y;
    e.facing = Math.atan2(e.vy, e.vx);
    return false;
  }

  function stop(e) { e.vx = 0; e.vy = 0; }

  function weaponDef(e) { return e.weapon ? HW.weapons[e.weapon.id] : HW.weapons.fists; }

  function hear(world, e) {
    let best = null, bd = Infinity;
    for (const n of world.noises) {
      const d = Math.hypot(n.x - e.x, n.y - e.y);
      if (d <= n.radius && d < bd) { bd = d; best = n; }
    }
    if (!best) return;
    if (e.state !== 'investigate') setState(e, 'investigate');
    e.target = { x: best.x, y: best.y };
    e.path = null;
  }

  function startSearch(e, x, y) {
    setState(e, 'search');
    e.target = { x, y };
    e.searchT = SEARCH_WAIT;
    e.arrived = false;
  }

  function chase(world, e, dt, seen) {
    const p = world.player;
    if (!seen) { startSearch(e, e.lastSeen.x, e.lastSeen.y); return; }
    const dist = Math.hypot(p.x - e.x, p.y - e.y);
    const angle = M.angleTo(e.x, e.y, p.x, p.y);
    e.facing = angle;
    const w = weaponDef(e);
    if (w.kind === 'gun') {
      HW.combat.attack(world, e, angle + (world.rng.next() * 2 - 1) * AIM_ERROR);
      if (dist <= GUN_STANDOFF) { stop(e); return; }
    } else {
      if (dist <= w.range + p.r) HW.combat.attack(world, e, angle);
      if (dist <= w.range - 2) { stop(e); return; }
    }
    walkTo(world, e, p.x, p.y, CHASE_SPEED, dt, wideClear(world, e, p.x, p.y));
    e.facing = angle;
  }

  function update(world, e, dt) {
    if (!e.alive || e.floor !== world.floorIndex) return;
    const p = world.player;

    if (e.state === 'downed') {
      stop(e);
      e.downedT -= dt;
      if (e.downedT > 0) return;
      e.downedT = 0;
      if (canSee(world, e, p.x, p.y)) {
        e.lastSeen = { x: p.x, y: p.y };
        setState(e, 'chase');
      } else {
        startSearch(e, e.x, e.y);
      }
      return;
    }

    const seen = canSee(world, e, p.x, p.y);
    if (seen) e.lastSeen = { x: p.x, y: p.y };
    const unaware = e.state === 'patrol' || e.state === 'search' || e.state === 'return' || e.state === 'investigate';
    if (unaware && seen) {
      setState(e, 'alert');
      e.reactT = HW.enemyTypes[e.type].reaction;
    } else if (unaware) {
      hear(world, e);
    }

    switch (e.state) {
      case 'alert':
        stop(e);
        if (seen) e.facing = M.angleTo(e.x, e.y, p.x, p.y);
        e.reactT -= dt;
        if (e.reactT <= 0) { setState(e, 'chase'); chase(world, e, dt, seen); }
        break;
      case 'chase':
        chase(world, e, dt, seen);
        break;
      case 'investigate':
        if (walkTo(world, e, e.target.x, e.target.y, CHASE_SPEED, dt, false)) startSearch(e, e.target.x, e.target.y);
        break;
      case 'search':
        if (!e.arrived) {
          if (walkTo(world, e, e.target.x, e.target.y, CHASE_SPEED, dt, false)) e.arrived = true;
        } else {
          stop(e);
          e.searchT -= dt;
          if (e.searchT <= 0) setState(e, 'return');
        }
        break;
      case 'return': {
        const start = e.patrol ? { x: T.center(e.patrol[0][0]), y: T.center(e.patrol[0][1]) } : e.home;
        if (walkTo(world, e, start.x, start.y, PATROL_SPEED, dt, false)) {
          e.wp = e.patrol ? (e.patrol.length > 1 ? 1 : 0) : 0;
          e.facing = e.home.facing;
          setState(e, 'patrol');
        }
        break;
      }
      default: // patrol
        if (!e.patrol || e.patrol.length < 2) { stop(e); break; }
        if (walkTo(world, e, T.center(e.patrol[e.wp][0]), T.center(e.patrol[e.wp][1]), PATROL_SPEED, dt, false)) {
          e.wp = (e.wp + 1) % e.patrol.length;
          e.path = null;
        }
    }
  }

  HW.ai = { canSee, update };
})(globalThis.HW);
