(function (HW) {
  'use strict';

  const M = HW.math;
  const THROW_SPEED = 300;
  const THROW_DECEL = 600;
  const THROW_SPIN = 14;
  const LAND_SPEED = 20;
  const PICKUP_RANGE = 14;
  const EXECUTE_RANGE = 12;
  const EXECUTE_TIME = 0.6;

  function currentFloor(world) { return world.floors[world.floorIndex]; }

  // Living characters on the current floor (player first).
  function characters(world) {
    const out = world.player.alive ? [world.player] : [];
    for (const e of currentFloor(world).enemies) if (e.alive) out.push(e);
    return out;
  }

  function doorSegments(world) { return currentFloor(world).doors.map(HW.door.segment); }

  function weaponDef(c) { return c.weapon ? HW.weapons[c.weapon.id] : HW.weapons.fists; }

  function knockdown(world, enemy, seconds, source) {
    enemy.state = 'downed';
    enemy.downedT = seconds;
    enemy.downedBy = source;
    world.events.push({ type: 'knockdown', x: enemy.x, y: enemy.y, source });
  }

  function kill(world, victim, cause, killer, extra) {
    if (!victim.alive) return;
    const door = !!(extra && extra.door);
    const isPlayer = victim === world.player;
    if (isPlayer && victim.invulnT > 0) return;
    if (isPlayer && victim.shield) {
      victim.shield = false;
      victim.invulnT = 0.5;
      world.events.push({ type: 'shieldbreak', x: victim.x, y: victim.y });
      return;
    }
    victim.alive = false;
    const victimHadGun = !!(victim.weapon && HW.weapons[victim.weapon.id].kind === 'gun');
    const floorIndex = isPlayer ? world.floorIndex : victim.floor;
    if (victim.weapon) {
      world.floors[floorIndex].items.push({
        id: victim.weapon.id, x: victim.x, y: victim.y, ammo: victim.weapon.ammo, vx: 0, vy: 0, spin: 0,
      });
      victim.weapon = null;
    }
    world.corpses.push({ x: victim.x, y: victim.y, angle: victim.facing, floor: floorIndex, kind: victim.type || 'player' });
    world.events.push({ type: 'kill', cause, x: victim.x, y: victim.y, victimHadGun, door });
    if (isPlayer) {
      world.status = 'dead';
      world.events.push({ type: 'death', x: victim.x, y: victim.y });
    }
    if (killer === world.player && world.score && HW.scoring && HW.scoring.onKill) {
      HW.scoring.onKill(world.score, world.time, cause, { victimHadGun, door });
    }
  }

  function meleeAttack(world, attacker, angle, w) {
    const segs = doorSegments(world);
    const map = currentFloor(world).map;
    world.events.push({ type: 'swing', x: attacker.x, y: attacker.y, angle, weapon: w.id });
    for (const t of characters(world)) {
      if (t === attacker) continue;
      if (!w.lethal && t.state === 'downed') continue;
      if (!M.inArc(attacker.x, attacker.y, angle, w.arc, w.range, t.x, t.y)) continue;
      if (!HW.raycast.clear(map, segs, attacker.x, attacker.y, t.x, t.y, 'bullet')) continue;
      world.events.push({ type: 'melee', x: t.x, y: t.y });
      if (w.lethal) kill(world, t, 'melee', attacker);
      else if (t !== world.player) knockdown(world, t, 2.5, 'fists');
    }
  }

  function gunAttack(world, attacker, angle, w) {
    if (!(attacker.weapon.ammo > 0)) {
      world.events.push({ type: 'click', x: attacker.x, y: attacker.y });
      return;
    }
    attacker.weapon.ammo--;
    for (let i = 0; i < w.pellets; i++) {
      const off = w.spread ? (world.rng.next() * 2 - 1) * w.spread : 0;
      HW.projectile.spawn(world, attacker.x, attacker.y, angle + off, attacker);
    }
    HW.noise.emit(world, attacker.x, attacker.y, w.noise);
    world.events.push({ type: 'shot', weapon: w.id, x: attacker.x, y: attacker.y, angle });
  }

  function attack(world, attacker, angle) {
    if (attacker.cooldown > 0) return;
    const w = weaponDef(attacker);
    attacker.cooldown = w.cooldown;
    if (w.kind === 'gun') gunAttack(world, attacker, angle, w);
    else meleeAttack(world, attacker, angle, w);
  }

  function throwWeapon(world, char, angle) {
    if (!char.weapon) return;
    world.thrown.push({
      id: char.weapon.id, ammo: char.weapon.ammo, x: char.x, y: char.y,
      vx: Math.cos(angle) * THROW_SPEED, vy: Math.sin(angle) * THROW_SPEED,
      spin: THROW_SPIN, thrownBy: char,
    });
    char.weapon = null;
    world.events.push({ type: 'throw', x: char.x, y: char.y, angle });
  }

  function updateThrown(world, dt) {
    const floor = currentFloor(world);
    const segs = doorSegments(world);
    const chars = characters(world);
    const flying = [];
    for (const it of world.thrown) {
      const nx = it.x + it.vx * dt, ny = it.y + it.vy * dt;
      if (HW.raycast.cast(floor.map, segs, it.x, it.y, nx, ny, 'bullet').hit) {
        it.vx = 0; it.vy = 0; // stays at the pre-step (walkable) position
      } else {
        it.x = nx; it.y = ny;
        const speed = Math.max(0, Math.hypot(it.vx, it.vy) - THROW_DECEL * dt);
        const n = M.norm(it.vx, it.vy);
        it.vx = n.x * speed; it.vy = n.y * speed;
        for (const ch of chars) {
          if (ch === it.thrownBy || !ch.alive) continue;
          if (Math.hypot(ch.x - it.x, ch.y - it.y) >= ch.r + 3) continue;
          if (HW.weapons[it.id].throwLethal) kill(world, ch, 'thrown', it.thrownBy);
          else if (ch !== world.player && ch.state !== 'downed') knockdown(world, ch, 2.5, 'thrown');
          it.vx = 0; it.vy = 0;
          break;
        }
      }
      if (Math.hypot(it.vx, it.vy) < LAND_SPEED) {
        floor.items.push({ id: it.id, x: it.x, y: it.y, ammo: it.ammo, vx: 0, vy: 0, spin: 0 });
      } else {
        flying.push(it);
      }
    }
    world.thrown.length = 0;
    for (const it of flying) world.thrown.push(it);
  }

  function pickUp(world, player) {
    if (player.weapon || !player.alive) return;
    const items = currentFloor(world).items;
    let best = -1, bd = PICKUP_RANGE;
    for (let i = 0; i < items.length; i++) {
      const d = Math.hypot(items[i].x - player.x, items[i].y - player.y);
      if (d <= bd) { bd = d; best = i; }
    }
    if (best < 0) return;
    const it = items.splice(best, 1)[0];
    player.weapon = { id: it.id, ammo: it.ammo };
    world.events.push({ type: 'pickup', x: it.x, y: it.y, weapon: it.id });
  }

  function startExecution(world, player) {
    if (player.executing || !player.alive) return;
    let target = null, bd = EXECUTE_RANGE;
    for (const e of currentFloor(world).enemies) {
      if (!e.alive || e.state !== 'downed') continue;
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d <= bd) { bd = d; target = e; }
    }
    if (!target) return;
    target.downedT = Math.max(target.downedT, EXECUTE_TIME + 0.1);
    player.executing = { target, t: EXECUTE_TIME };
    world.events.push({ type: 'execute', x: target.x, y: target.y });
  }

  function updateExecution(world, player, dt) {
    const ex = player.executing;
    if (!ex) return;
    if (!ex.target.alive) { player.executing = null; return; }
    ex.t -= dt;
    if (ex.t > 0) return;
    player.executing = null;
    kill(world, ex.target, 'execution', player, { door: ex.target.downedBy === 'door' });
  }

  HW.combat = {
    characters, knockdown, kill, attack, throwWeapon, updateThrown, pickUp, startExecution, updateExecution,
  };
})(globalThis.HW);
