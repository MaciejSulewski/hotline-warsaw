'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadHW } = require('./helpers/load');
const { makeLevel } = require('./helpers/fixtures');

const HW = loadHW();
const room = ['####################', '#P.................#', '#..................#', '#..................#', '#..................#', '####################'];

function load(rows, enemies, mask) {
  const w = HW.world.load(makeLevel(rows || room, { enemies: enemies || [] }), mask || 'lajkonik');
  w.player.x = 40; w.player.y = 40;
  return w;
}
const enemyAt = (x, y, weapon) => {
  const def = { type: 'dresiarz', at: [0, 0], facing: 0 };
  if (weapon !== undefined) def.weapon = weapon;
  return { def, x, y };
};
function withEnemies(rows, list, mask) {
  const w = load(rows, list.map((l) => l.def), mask);
  list.forEach((l, i) => { const e = w.floors[0].enemies[i]; e.x = l.x; e.y = l.y; });
  return w;
}
function give(c, id) { c.weapon = { id, ammo: HW.weapons[id].ammo }; }
function step(w, input, n = 1) {
  for (let i = 0; i < n; i++) HW.sim.step(w, { ...HW.sim.emptyInput(), aim: { x: w.player.x + 100, y: w.player.y }, ...input }, 1 / 60);
}
const evs = (w, t) => w.events.filter((e) => e.type === t);

test('pipe kills enemy in front, not behind', () => {
  const w = withEnemies(null, [enemyAt(54, 40), enemyAt(26, 40)]);
  give(w.player, 'pipe');
  HW.combat.attack(w, w.player, 0);
  const [front, back] = w.floors[0].enemies;
  assert.equal(front.alive, false);
  assert.equal(back.alive, true);
  assert.equal(evs(w, 'swing').length, 1);
  assert.equal(evs(w, 'melee').length, 1);
});

test('fists knock down, do not kill', () => {
  const w = withEnemies(null, [enemyAt(50, 40)]);
  HW.combat.attack(w, w.player, 0);
  const e = w.floors[0].enemies[0];
  assert.equal(e.alive, true);
  assert.equal(e.state, 'downed');
  assert.equal(e.downedT, 2.5);
  assert.equal(e.downedBy, 'fists');
});

test('fists on an already downed enemy do nothing', () => {
  const w = withEnemies(null, [enemyAt(50, 40)]);
  const e = w.floors[0].enemies[0];
  HW.combat.knockdown(w, e, 1, 'door');
  w.events.length = 0;
  HW.combat.attack(w, w.player, 0);
  assert.equal(e.downedT, 1);
  assert.equal(evs(w, 'melee').length, 0);
});

test('melee blocked by closed door between', () => {
  const rows = ['#########', '#P..#...#', '#...D...#', '#...#...#', '#########'];
  const w = withEnemies(rows, [enemyAt(80, 40)]);
  w.player.x = 64; w.player.y = 40;
  give(w.player, 'pipe');
  HW.combat.attack(w, w.player, 0);
  assert.equal(w.floors[0].enemies[0].alive, true);
  // same geometry, no door in between: hit
  const w2 = withEnemies(rows, [enemyAt(80, 40)]);
  w2.player.x = 68; w2.player.y = 40; w2.floors[0].doors[0].angle += Math.PI / 2;
  give(w2.player, 'pipe');
  HW.combat.attack(w2, w2.player, 0);
  assert.equal(w2.floors[0].enemies[0].alive, false);
});

test('melee blocked by wall between', () => {
  const rows = ['######', '#P.#.#', '#..###', '######'];
  const w = withEnemies(rows, [enemyAt(52, 24)]); // enemy sits in wall tile 3 (x 48..64)
  w.player.x = 40; w.player.y = 24;
  give(w.player, 'pipe');
  HW.combat.attack(w, w.player, 0);
  assert.equal(w.floors[0].enemies[0].alive, true);
});

test('attack respects cooldown', () => {
  const w = withEnemies(null, [enemyAt(50, 40)]);
  HW.combat.attack(w, w.player, 0);
  assert.equal(w.player.cooldown, HW.weapons.fists.cooldown);
  const n = w.events.length;
  HW.combat.attack(w, w.player, 0);
  assert.equal(w.events.length, n);
  step(w, {}, 30);
  assert.equal(w.player.cooldown, 0);
});

test('pistol: 8 rounds, 9th click does nothing', () => {
  const w = load();
  give(w.player, 'pistol');
  for (let i = 0; i < 8; i++) { HW.combat.attack(w, w.player, 0); w.player.cooldown = 0; }
  assert.equal(w.player.weapon.ammo, 0);
  assert.equal(w.projectiles.length, 8);
  assert.equal(evs(w, 'shot').length, 8);
  HW.combat.attack(w, w.player, 0);
  assert.equal(w.projectiles.length, 8);
  assert.equal(evs(w, 'click').length, 1);
  assert.ok(w.player.cooldown > 0);
});

test('shotgun fires 6 pellets', () => {
  const w = load();
  give(w.player, 'shotgun');
  HW.combat.attack(w, w.player, 0);
  assert.equal(w.projectiles.length, 6);
  const angles = new Set(w.projectiles.map((b) => Math.atan2(b.vy, b.vx).toFixed(4)));
  assert.ok(angles.size > 1);
  for (const b of w.projectiles) assert.ok(Math.abs(Math.atan2(b.vy, b.vx)) <= HW.weapons.shotgun.spread + 1e-9);
});

test('gunshot emits noise radius 250 (pistol)', () => {
  const w = load();
  give(w.player, 'pistol');
  HW.combat.attack(w, w.player, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(w.noises)), [{ x: 40, y: 40, radius: 250 }]);
  HW.noise.emit(w, 1, 1, 0);
  assert.equal(w.noises.length, 1);
});

test('bullet stops at closed door', () => {
  const rows = ['#########', '#P..#...#', '#...D...#', '#...#...#', '#########'];
  const w = withEnemies(rows, [enemyAt(100, 40)]);
  w.player.x = 40; w.player.y = 40;
  w.floors[0].doors[0].angle = w.floors[0].doors[0].closedAngle;
  give(w.player, 'pistol');
  // door spans (72,32)-(72,48); fire along y=40
  HW.combat.attack(w, w.player, 0);
  for (let i = 0; i < 60; i++) HW.projectile.update(w, 1 / 60);
  assert.equal(w.floors[0].enemies[0].alive, true);
  assert.equal(w.projectiles.length, 0);
});

test('bullet passes window and kills', () => {
  const rows = ['#########', '#P..w...#', '#...w...#', '#########'];
  const w = withEnemies(rows, [enemyAt(100, 24)]);
  w.player.x = 24; w.player.y = 24;
  give(w.player, 'pistol');
  HW.combat.attack(w, w.player, 0);
  for (let i = 0; i < 60; i++) HW.projectile.update(w, 1 / 60);
  const e = w.floors[0].enemies[0];
  assert.equal(e.alive, false);
  assert.equal(evs(w, 'kill')[0].cause, 'gun');
  assert.equal(evs(w, 'kill')[0].victimHadGun, false);
});

test('bullets stop through walls and expire', () => {
  const w = load();
  give(w.player, 'pistol');
  HW.combat.attack(w, w.player, Math.PI); // into west wall at x=16
  for (let i = 0; i < 30; i++) HW.projectile.update(w, 1 / 60);
  assert.equal(w.projectiles.length, 0);
});

test('bullet kills nearest character on its path, never the owner', () => {
  const w = withEnemies(null, [enemyAt(120, 40), enemyAt(80, 40)]);
  give(w.player, 'pistol');
  HW.combat.attack(w, w.player, 0);
  for (let i = 0; i < 60; i++) HW.projectile.update(w, 1 / 60);
  const [far, near] = w.floors[0].enemies;
  assert.equal(near.alive, false);
  assert.equal(far.alive, true);
  assert.equal(w.player.alive, true);
});

test('fast bullet does not tunnel through a character', () => {
  const w = withEnemies(null, [enemyAt(46, 40)]);
  give(w.player, 'pistol');
  HW.combat.attack(w, w.player, 0);
  HW.projectile.update(w, 1 / 60);
  assert.equal(w.floors[0].enemies[0].alive, false);
});

test('friendly fire: enemy bullet kills enemy', () => {
  const w = withEnemies(null, [enemyAt(100, 60, 'pistol'), enemyAt(160, 60)]);
  const [shooter, victim] = w.floors[0].enemies;
  HW.combat.attack(w, shooter, 0);
  for (let i = 0; i < 60; i++) HW.projectile.update(w, 1 / 60);
  assert.equal(victim.alive, false);
  assert.equal(shooter.alive, true);
});

test('thrown bat knocks down, thrown knife kills', () => {
  for (const [id, alive] of [['bat', true], ['knife', false]]) {
    const w = withEnemies(null, [enemyAt(80, 40)]);
    give(w.player, id);
    HW.combat.throwWeapon(w, w.player, 0);
    assert.equal(w.player.weapon, null);
    assert.equal(w.thrown.length, 1);
    assert.equal(w.thrown[0].thrownBy, w.player);
    assert.equal(evs(w, 'throw').length, 1);
    for (let i = 0; i < 60; i++) HW.combat.updateThrown(w, 1 / 60);
    const e = w.floors[0].enemies[0];
    assert.equal(e.alive, alive, id);
    if (alive) { assert.equal(e.state, 'downed'); assert.equal(e.downedBy, 'thrown'); }
    assert.equal(w.thrown.length, 0);
    const landed = w.floors[0].items.filter((i) => i.id === id);
    assert.equal(landed.length, 1);
    assert.equal(landed[0].thrownBy, undefined);
    assert.equal(landed[0].vx, 0);
  }
});

test('thrown weapon never rests inside a wall', () => {
  const w = load();
  w.player.x = 21; w.player.y = 40; // hugging west wall (x<16 is wall)
  give(w.player, 'pipe');
  HW.combat.throwWeapon(w, w.player, Math.PI);
  for (let i = 0; i < 120; i++) HW.sim.step(w, { ...HW.sim.emptyInput(), aim: { x: 100, y: 40 } }, 1 / 60);
  assert.equal(w.thrown.length, 0);
  const it = w.floors[0].items[0];
  assert.ok(it);
  assert.ok(HW.tilemap.isWalkable(HW.tilemap.get(w.floors[0].map, HW.tilemap.toTile(it.x), HW.tilemap.toTile(it.y))));
  assert.ok(it.x > 16);
});

test('pickup only when empty-handed and within 14 px', () => {
  const w = load();
  w.floors[0].items.push({ id: 'bat', x: 60, y: 40, ammo: null, vx: 0, vy: 0, spin: 0 });
  step(w, { throwPressed: true });
  assert.equal(w.player.weapon, null); // 20 px away
  w.player.x = 50;
  give(w.player, 'pipe');
  HW.combat.pickUp(w, w.player);
  assert.equal(w.player.weapon.id, 'pipe');
  w.player.weapon = null;
  step(w, { throwPressed: true });
  assert.equal(w.player.weapon.id, 'bat');
  assert.equal(w.floors[0].items.length, 0);
  assert.equal(evs(w, 'pickup').length, 1);
});

test('throwPressed with a weapon throws it', () => {
  const w = load();
  give(w.player, 'bat');
  step(w, { throwPressed: true });
  assert.equal(w.player.weapon, null);
  assert.equal(w.thrown.length, 1);
});

test('input: melee on firePressed, auto gun while held, non-auto not while held', () => {
  const w = load();
  give(w.player, 'ak');
  step(w, { fire: true }, 12);
  assert.ok(w.projectiles.length >= 2);
  const w2 = load();
  give(w2.player, 'pistol');
  step(w2, { fire: true }, 30);
  assert.equal(w2.projectiles.length, 0);
  step(w2, { fire: true, firePressed: true });
  assert.equal(w2.projectiles.length, 1);
});

function downedSetup(by) {
  const w = withEnemies(null, [enemyAt(48, 40, 'pistol')]);
  const e = w.floors[0].enemies[0];
  HW.combat.knockdown(w, e, 2.5, by);
  return { w, e };
}

test('execution takes 0.6 s and locks movement', () => {
  const { w, e } = downedSetup('fists');
  step(w, { executePressed: true });
  assert.ok(w.player.executing);
  assert.equal(evs(w, 'execute').length, 1);
  assert.ok(e.downedT >= 0.7);
  const x0 = w.player.x;
  step(w, { move: { x: -1, y: 0 } }, 30);
  assert.equal(w.player.x, x0);
  assert.equal(e.alive, true);
  step(w, { move: { x: -1, y: 0 } }, 10);
  assert.equal(e.alive, false);
  assert.equal(w.player.executing, null);
  const k = evs(w, 'kill')[0];
  assert.equal(k.cause, 'execution');
  assert.equal(k.door, false);
  assert.equal(k.victimHadGun, true);
});

test('execution of door-downed enemy carries door flag', () => {
  const { w } = downedSetup('door');
  step(w, { executePressed: true }, 1);
  step(w, {}, 40);
  assert.equal(evs(w, 'kill')[0].door, true);
});

test('execution needs a downed enemy within 12 px', () => {
  const w = withEnemies(null, [enemyAt(70, 40)]);
  HW.combat.knockdown(w, w.floors[0].enemies[0], 2.5, 'fists');
  step(w, { executePressed: true });
  assert.equal(w.player.executing, null);
});

test('scoring hook receives player kills', () => {
  const w = withEnemies(null, [enemyAt(50, 40, 'pistol')]);
  const calls = [];
  HW.scoring = { onKill: (...a) => calls.push(a) };
  try {
    w.score = {};
    give(w.player, 'pipe');
    HW.combat.attack(w, w.player, 0);
  } finally { delete HW.scoring; }
  assert.equal(calls.length, 1);
  assert.equal(calls[0][2], 'melee');
  assert.equal(calls[0][3].victimHadGun, true);
});

test('czapka absorbs first hit, second kills', () => {
  const w = withEnemies(null, [enemyAt(100, 40, 'pistol')], 'czapka');
  assert.equal(w.player.shield, true);
  const e = w.floors[0].enemies[0];
  HW.combat.kill(w, w.player, 'gun', e);
  assert.equal(w.player.alive, true);
  assert.equal(w.player.shield, false);
  assert.equal(evs(w, 'shieldbreak').length, 1);
  assert.equal(w.status, 'alive');
  HW.combat.kill(w, w.player, 'gun', e);
  assert.equal(w.player.alive, false);
  assert.equal(w.status, 'dead');
  assert.equal(evs(w, 'death').length, 1);
  assert.equal(w.corpses[0].kind, 'player');
  step(w, { move: { x: 1, y: 0 } }, 5); // dead player does nothing
});

test('killed enemy drops its weapon', () => {
  const w = withEnemies(null, [enemyAt(50, 40, 'pistol')]);
  const e = w.floors[0].enemies[0];
  e.weapon.ammo = 3;
  give(w.player, 'pipe');
  HW.combat.attack(w, w.player, 0);
  assert.equal(e.weapon, null);
  const it = w.floors[0].items[0];
  assert.equal(it.id, 'pistol');
  assert.equal(it.ammo, 3);
  assert.equal(it.x, 50);
  assert.equal(w.corpses.length, 1);
  assert.equal(w.corpses[0].kind, 'dresiarz');
});
