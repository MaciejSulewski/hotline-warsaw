'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadHW } = require('./helpers/load');

const HW = loadHW();
const T = HW.tilemap;

// Expected enemy count per level (spec §7 "Content": ~9, ~11, ~14).
const ENEMY_RANGE = { blok: [8, 10], pewex: [10, 12], komenda: [13, 15] };

const enemiesOf = (lvl) => lvl.floors.reduce((a, f) => a.concat(f.enemies || []), []);
const mapsOf = (lvl) => lvl.floors.map((f) => T.parse(f.map));

// Floors reachable from P, each with the tiles the player enters it on (P, or stair targets).
// Stairs count as links: an S reachable from an entry leads to its target floor's `to.at`.
function entries(lvl) {
  const maps = mapsOf(lvl);
  const out = maps.map(() => []);
  out[0].push(T.find(maps[0], 'P')[0]);
  const reach = (fi, at) => out[fi].some((e) => HW.pathfind.find(maps[fi], e, at) !== null);
  let changed = true;
  while (changed) {
    changed = false;
    lvl.floors.forEach((f, fi) => {
      for (const s of f.stairs || []) {
        const to = s.to;
        if (out[to.floor].some((e) => e[0] === to.at[0] && e[1] === to.at[1])) continue;
        if (out[fi].length && reach(fi, s.at)) { out[to.floor].push(to.at); changed = true; }
      }
    });
  }
  return { maps, reach };
}

for (const id of HW.masks.levelOrder) {
  const lvl = HW.levels[id];
  const skip = lvl ? false : 'level ' + id + ' not authored yet';

  test(id + ': validates cleanly', { skip }, () => {
    assert.deepEqual(Array.from(HW.levels.validate(lvl)), []);
  });

  test(id + ': enemy count in range', { skip }, () => {
    const [lo, hi] = ENEMY_RANGE[id];
    const n = enemiesOf(lvl).length;
    assert.ok(n >= lo && n <= hi, id + ' has ' + n + ' enemies, expected ' + lo + '–' + hi);
  });

  test(id + ': every enemy and floor item is reachable from P', { skip }, () => {
    const { reach } = entries(lvl);
    lvl.floors.forEach((f, fi) => {
      for (const e of f.enemies || []) assert.ok(reach(fi, e.at), 'floor ' + fi + ' enemy at ' + e.at);
      for (const it of f.items || []) assert.ok(reach(fi, it.at), 'floor ' + fi + ' item at ' + it.at);
    });
  });

  test(id + ': stairs land next to an S on the target floor, never on it', { skip }, () => {
    const maps = mapsOf(lvl);
    lvl.floors.forEach((f, fi) => {
      for (const s of f.stairs || []) {
        const m = maps[s.to.floor];
        const [x, y] = s.to.at;
        assert.notEqual(T.get(m, x, y), 'S', 'floor ' + fi + ' stair lands on an S');
        const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => T.get(m, x + dx, y + dy) === 'S');
        assert.ok(near, 'floor ' + fi + ' stair target ' + s.to.at + ' is not next to an S');
      }
    });
  });

  test(id + ': targetScore > 0 and at least 3 doors', { skip }, () => {
    assert.ok(lvl.targetScore > 0);
    const doors = mapsOf(lvl).reduce((n, m) => n + T.find(m, 'D').length, 0);
    assert.ok(doors >= 3, 'only ' + doors + ' doors');
  });

  test(id + ': clearing every enemy in the sim, then driving to the car, wins', { skip }, () => {
    const w = HW.world.load(lvl, 'lajkonik', 7);
    const p = w.player;
    // Kill each enemy with a real melee swing from an adjacent walkable tile.
    for (const e of w.floors.reduce((a, f) => a.concat(f.enemies), [])) {
      w.floorIndex = e.floor;
      const map = w.floors[e.floor].map;
      const tx = T.toTile(e.x), ty = T.toTile(e.y);
      const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => '.~'.includes(T.get(map, tx + dx, ty + dy)));
      assert.ok(spot, 'no free tile next to enemy at ' + [tx, ty]);
      p.x = e.x + spot[0] * 10; p.y = e.y + spot[1] * 10; p.vx = 0; p.vy = 0;
      p.weapon = { id: 'pipe', ammo: null }; p.cooldown = 0;
      const input = Object.assign(HW.sim.emptyInput(), { aim: { x: e.x, y: e.y }, firePressed: true, fire: true });
      HW.sim.step(w, input, 1 / 60);
      assert.equal(e.alive, false, 'enemy at ' + [tx, ty] + ' floor ' + e.floor + ' survived');
      assert.ok(p.alive);
    }
    assert.equal(w.status, 'cleared');
    // Walk back with real movement from the top floor's stair landing, taking the stairs down, to the car.
    const top = lvl.floors.length - 1;
    const landing = top ? lvl.floors[top - 1].stairs.find((s) => s.to.floor === top).to.at : T.find(w.floors[0].map, 'P')[0];
    w.floorIndex = top;
    p.x = T.center(landing[0]); p.y = T.center(landing[1]); p.stairLock = true;
    // Head for a stair that leads down, or for the car on floor 0.
    const target = () => {
      const fi = w.floorIndex;
      if (fi === 0) return T.find(w.floors[0].map, 'P')[0];
      return lvl.floors[fi].stairs.find((s) => s.to.floor < fi).at;
    };
    // Follow the A* path tile by tile; when a swung-open door pins us, sidestep for a moment.
    let last = { x: p.x, y: p.y }, still = 0, detour = 0, side = 1;
    for (let i = 0; i < 60 * 60 && w.status !== 'won'; i++) {
      const map = w.floors[w.floorIndex].map, dest = target();
      const path = HW.pathfind.find(map, [T.toTile(p.x), T.toTile(p.y)], dest) || [];
      const goal = path.length ? path[0] : dest;
      const gx = T.center(goal[0]), gy = T.center(goal[1]);
      let mx = Math.sign(Math.round(gx - p.x)), my = Math.sign(Math.round(gy - p.y));
      if (detour > 0) { detour--; [mx, my] = [-my * side || side, mx * side || side]; }
      HW.sim.step(w, Object.assign(HW.sim.emptyInput(), { move: { x: mx, y: my }, aim: { x: gx, y: gy } }), 1 / 60);
      still = Math.hypot(p.x - last.x, p.y - last.y) < 0.2 ? still + 1 : 0;
      last = { x: p.x, y: p.y };
      if (still > 10) { detour = 12; side = -side; still = 0; }
    }
    assert.equal(w.status, 'won');
  });
}

// ---- level 1 specifics (spec §7, Task 15 brief) ----------------------------------
const blok = HW.levels.blok;

test('blok: header, music and phone call', () => {
  assert.equal(blok.title, 'POZIOM 1: BLOK');
  assert.equal(blok.subtitle, 'Praga, 1986');
  assert.equal(blok.targetScore, 9000);
  assert.deepEqual(JSON.parse(JSON.stringify(blok.music)), { root: 'A', progression: [0, 5, 3, 4] });
  assert.ok(blok.phoneCall.length >= 3 && blok.phoneCall.length <= 5, 'phone call has ' + blok.phoneCall.length + ' lines');
  for (const line of blok.phoneCall) for (const ch of line.toUpperCase()) assert.ok(HW.font.GLYPHS[ch], 'glyph ' + ch);
});

test('blok: two floors joined by stairs both ways', () => {
  assert.equal(blok.floors.length, 2);
  assert.ok(blok.floors[0].stairs.some((s) => s.to.floor === 1));
  assert.ok(blok.floors[1].stairs.some((s) => s.to.floor === 0));
});

test('blok: mostly dresiarz, at most 2 bandzior, mixed guards and patrols', () => {
  const all = enemiesOf(blok);
  const by = (t) => all.filter((e) => e.type === t).length;
  assert.ok(by('bandzior') <= 2);
  assert.ok(by('dresiarz') > all.length / 2);
  assert.ok(all.some((e) => e.patrol) && all.some((e) => !e.patrol));
});

test('blok: a pistol and an extra melee weapon lie on the floor', () => {
  const items = blok.floors.reduce((a, f) => a.concat(f.items || []), []);
  assert.ok(items.some((i) => i.weapon === 'pistol'));
  assert.ok(items.some((i) => HW.weapons[i.weapon].kind === 'melee'));
});

// ---- shared level checks, applied per level below ----------------------------------
function neonOnFacade(lvl, text, color) {
  const n = lvl.floors[0].neon.find((s) => s.text === text && s.color === color);
  assert.ok(n, color + ' ' + text + ' neon');
  const map = T.parse(lvl.floors[0].map);
  const tiles = Math.ceil((HW.font.measure(n.text, 1) + 6) / 16);
  for (let x = n.at[0]; x < n.at[0] + tiles; x++) assert.equal(T.get(map, x, n.at[1]), '#', 'sign hangs on a solid wall at x=' + x);
}

function streetAroundCar(lvl) {
  const ground = lvl.floors[0].ground;
  const map = T.parse(lvl.floors[0].map);
  const [px, py] = T.find(map, 'P')[0];
  const inside = (g, x, y) => x >= g.rect[0] && y >= g.rect[1] && x <= g.rect[2] && y <= g.rect[3];
  assert.ok(ground.some((g) => g.tile === 'asphalt' && inside(g, px, py)), 'car stands on asphalt');
  assert.ok(ground.some((g) => g.tile === 'pavement'));
  for (const g of ground) {
    for (let y = g.rect[1]; y <= g.rect[3]; y++) for (let x = g.rect[0]; x <= g.rect[2]; x++) {
      assert.ok('.P'.includes(T.get(map, x, y)), g.tile + ' over a non-floor tile at ' + [x, y]);
    }
  }
}

function guardedDoors(lvl) {
  let n = 0;
  lvl.floors.forEach((f) => {
    const map = T.parse(f.map);
    for (const [dx, dy] of T.find(map, 'D')) {
      const d = HW.door.create(dx, dy, map);
      const guarded = (f.enemies || []).some((e) => !e.patrol &&
        Math.hypot(T.center(e.at[0]) - d.hx, T.center(e.at[1]) - d.hy) <= d.len + 5);
      if (guarded) n++;
    }
  });
  return n;
}

function nobodySeesTheCar(lvl) {
  const w = HW.world.load(lvl, 'lajkonik', 1);
  const p = w.player;
  const segs = w.floors[0].doors.map(HW.door.segment);
  const sees = (x, y, facing) => {
    const inCone = Math.abs(HW.math.angleDiff(facing, Math.atan2(p.y - y, p.x - x))) <= HW.math.deg(55);
    return Math.hypot(p.x - x, p.y - y) <= 220 && inCone && HW.raycast.clear(w.floors[0].map, segs, x, y, p.x, p.y, 'sight');
  };
  for (const e of w.floors[0].enemies) {
    assert.equal(sees(e.x, e.y, e.facing), false, 'enemy at ' + [T.toTile(e.x), T.toTile(e.y)] + ' sees the car');
    // walking each leg of the patrol, facing along it
    const pts = e.patrol ? [[T.toTile(e.x), T.toTile(e.y)]].concat(e.patrol) : [];
    for (let i = 0; i + 1 < pts.length; i++) {
      for (const [a, b] of [[pts[i], pts[i + 1]], [pts[i + 1], pts[i]]]) {
        const ax = T.center(a[0]), ay = T.center(a[1]), bx = T.center(b[0]), by = T.center(b[1]);
        const facing = Math.atan2(by - ay, bx - ax);
        for (let k = 0; k <= 16; k++) {
          const x = ax + (bx - ax) * k / 16, y = ay + (by - ay) * k / 16;
          assert.equal(sees(x, y, facing), false, 'patroller sees the car from ' + [Math.round(x), Math.round(y)]);
        }
      }
    }
  }
}

test('blok: cyan BAR MLECZNY neon on the facade above the street', () => neonOnFacade(blok, 'BAR MLECZNY', 'cyan'));
test('blok: the street around the car is drawn as pavement and asphalt', () => streetAroundCar(blok));
test('blok: at least 3 doors have a guard right behind them (kick-open knockdowns)', () => {
  const n = guardedDoors(blok);
  assert.ok(n >= 3, 'only ' + n + ' guarded doors');
});
test('blok: no enemy can see the car at spawn, nor from its patrol route', () => nobodySeesTheCar(blok));

// ---- level 2 specifics (spec §7, Task 16 brief) ----------------------------------
const pewex = HW.levels.pewex;
const ok = (fn) => () => { assert.ok(pewex, 'HW.levels.pewex is defined'); fn(); };

test('pewex: header, music and phone call', ok(() => {
  assert.equal(pewex.id, 'pewex');
  assert.equal(pewex.title, 'POZIOM 2: PEWEX');
  assert.equal(pewex.subtitle, 'Śródmieście, 1987');
  assert.equal(pewex.targetScore, 11000);
  assert.deepEqual(JSON.parse(JSON.stringify(pewex.music)), { root: 'D', progression: [0, 3, 5, 4] });
  assert.ok(pewex.phoneCall.length >= 3 && pewex.phoneCall.length <= 5, 'phone call has ' + pewex.phoneCall.length + ' lines');
  for (const line of pewex.phoneCall) for (const ch of line.toUpperCase()) assert.ok(HW.font.GLYPHS[ch], 'glyph ' + ch);
}));

test('pewex: one or two floors, stairs both ways if two', ok(() => {
  assert.ok(pewex.floors.length >= 1 && pewex.floors.length <= 2);
  if (pewex.floors.length === 2) {
    assert.ok(pewex.floors[0].stairs.some((s) => s.to.floor === 1));
    assert.ok(pewex.floors[1].stairs.some((s) => s.to.floor === 0));
  }
}));

test('pewex: mostly bandzior with pistols and shotguns, mixed guards and patrols', ok(() => {
  const all = enemiesOf(pewex);
  const bandzior = all.filter((e) => e.type === 'bandzior');
  assert.ok(bandzior.length > all.length / 2, bandzior.length + ' of ' + all.length + ' are bandzior');
  for (const e of bandzior) assert.ok(['pistol', 'shotgun'].includes(e.weapon), 'bandzior with ' + e.weapon);
  assert.ok(bandzior.some((e) => e.weapon === 'pistol') && bandzior.some((e) => e.weapon === 'shotgun'));
  assert.ok(all.some((e) => e.patrol) && all.some((e) => !e.patrol));
}));

test('pewex: a shotgun and a melee weapon lie on the floor', ok(() => {
  const items = pewex.floors.reduce((a, f) => a.concat(f.items || []), []);
  assert.ok(items.some((i) => i.weapon === 'shotgun'));
  assert.ok(items.some((i) => HW.weapons[i.weapon].kind === 'melee'));
}));

test('pewex: magenta PEWEX neon on the shop facade', ok(() => neonOnFacade(pewex, 'PEWEX', 'magenta')));
test('pewex: the street around the car is drawn as pavement and asphalt', ok(() => streetAroundCar(pewex)));

test('pewex: the shop floor has free-standing shelving (wall islands) for cover', ok(() => {
  // count 4-connected groups of '#' that do not touch the map border
  const map = T.parse(pewex.floors[0].map);
  const seen = new Set();
  let islands = 0;
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    if (T.get(map, x, y) !== '#' || seen.has(x + ',' + y)) continue;
    let border = false;
    const stack = [[x, y]];
    seen.add(x + ',' + y);
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx === 0 || cy === 0 || cx === map.w - 1 || cy === map.h - 1) border = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy, k = nx + ',' + ny;
        if (nx >= 0 && ny >= 0 && nx < map.w && ny < map.h && T.get(map, nx, ny) === '#' && !seen.has(k)) { seen.add(k); stack.push([nx, ny]); }
      }
    }
    if (!border) islands++;
  }
  assert.ok(islands >= 6, 'only ' + islands + ' free-standing shelves');
}));

test('pewex: at least 3 doors have a guard right behind them (kick-open knockdowns)', ok(() => {
  const n = guardedDoors(pewex);
  assert.ok(n >= 3, 'only ' + n + ' guarded doors');
}));
test('pewex: no enemy can see the car at spawn, nor from its patrol route', ok(() => nobodySeesTheCar(pewex)));

// ---- level 3 specifics (spec §7, Task 17 brief) ----------------------------------
const komenda = HW.levels.komenda;
const ok3 = (fn) => () => { assert.ok(komenda, 'HW.levels.komenda is defined'); fn(); };

// Rooms: 4-connected groups of walkable tiles with doors treated as walls. Returns a tile → room id grid.
function roomsOf(map) {
  const id = map.rows.map((r) => Array.from(r, () => -1));
  let n = 0;
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    const ch = T.get(map, x, y);
    if (id[y][x] !== -1 || ch === 'D' || !T.isWalkable(ch)) continue;
    const stack = [[x, y]];
    id[y][x] = n;
    while (stack.length) {
      const [cx, cy] = stack.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy, c = T.get(map, nx, ny);
        if (c !== 'D' && T.isWalkable(c) && id[ny][nx] === -1) { id[ny][nx] = n; stack.push([nx, ny]); }
      }
    }
    n++;
  }
  const size = new Array(n).fill(0);
  for (const row of id) for (const r of row) if (r >= 0) size[r]++;
  return { id, size };
}

test('komenda: header, music and phone call', ok3(() => {
  assert.equal(komenda.id, 'komenda');
  assert.equal(komenda.title, 'POZIOM 3: KOMENDA');
  assert.equal(komenda.subtitle, 'Mokotów, 1988');
  assert.equal(komenda.targetScore, 14000);
  assert.deepEqual(JSON.parse(JSON.stringify(komenda.music)), { root: 'E', progression: [0, 5, 6, 4] });
  assert.ok(komenda.phoneCall.length >= 3 && komenda.phoneCall.length <= 5, 'phone call has ' + komenda.phoneCall.length + ' lines');
  for (const line of komenda.phoneCall) for (const ch of line.toUpperCase()) assert.ok(HW.font.GLYPHS[ch], 'glyph ' + ch);
}));

test('komenda: two floors joined by stairs both ways', ok3(() => {
  assert.equal(komenda.floors.length, 2);
  assert.ok(komenda.floors[0].stairs.some((s) => s.to.floor === 1));
  assert.ok(komenda.floors[1].stairs.some((s) => s.to.floor === 0));
}));

test('komenda: milicjant and bandzior only, at least 5 milicjant with AKs, mixed guards and patrols', ok3(() => {
  const all = enemiesOf(komenda);
  for (const e of all) assert.ok(['milicjant', 'bandzior'].includes(e.type), 'enemy type ' + e.type);
  const aks = all.filter((e) => e.type === 'milicjant' && e.weapon === 'ak').length;
  assert.ok(aks >= 5, 'only ' + aks + ' milicjant with ak');
  assert.ok(all.some((e) => e.type === 'bandzior'));
  assert.ok(all.some((e) => e.patrol) && all.some((e) => !e.patrol));
}));

test('komenda: at least two AKs lie on the armoury floor, in one room', ok3(() => {
  const found = komenda.floors.some((f) => {
    const { id } = roomsOf(T.parse(f.map));
    const perRoom = {};
    for (const it of f.items || []) if (it.weapon === 'ak') perRoom[id[it.at[1]][it.at[0]]] = (perRoom[id[it.at[1]][it.at[0]]] || 0) + 1;
    return Object.values(perRoom).some((n) => n >= 2);
  });
  assert.ok(found, 'no room holds two AKs');
}));

test('komenda: window bars stand between at least 3 cells and one corridor', ok3(() => {
  // Each bar tile 'w' with walkable tiles on both sides (above/below or left/right) joins two rooms.
  // Cells are small rooms; they must all face the same corridor through their bars.
  const map = T.parse(komenda.floors[0].map);
  const { id, size } = roomsOf(map);
  const facing = {}; // corridor room → set of cell rooms seen through bars
  for (const [x, y] of T.find(map, 'w')) {
    for (const [dx, dy] of [[0, 1], [1, 0]]) {
      const a = T.get(map, x - dx, y - dy), b = T.get(map, x + dx, y + dy);
      if (!T.isWalkable(a) || !T.isWalkable(b) || a === 'D' || b === 'D') continue;
      const ra = id[y - dy][x - dx], rb = id[y + dy][x + dx];
      if (ra === rb) continue;
      const [cell, corridor] = size[ra] < size[rb] ? [ra, rb] : [rb, ra];
      if (size[cell] > 20) continue;
      (facing[corridor] = facing[corridor] || new Set()).add(cell);
    }
  }
  const best = Math.max(0, ...Object.values(facing).map((s) => s.size));
  assert.ok(best >= 3, 'only ' + best + ' barred cells face one corridor');
}));

test('komenda: flickering cyan and magenta MO neon on the station facade', ok3(() => {
  neonOnFacade(komenda, 'MO', 'cyan');
  neonOnFacade(komenda, 'MO', 'magenta');
  for (const n of komenda.floors[0].neon.filter((s) => s.text === 'MO')) assert.equal(n.flicker, true, n.color + ' MO flickers');
}));

test('komenda: the street around the car is drawn as pavement and asphalt', ok3(() => streetAroundCar(komenda)));
test('komenda: at least 3 doors have a guard right behind them (kick-open knockdowns)', ok3(() => {
  const n = guardedDoors(komenda);
  assert.ok(n >= 3, 'only ' + n + ' guarded doors');
}));
test('komenda: no enemy can see the car at spawn, nor from its patrol route', ok3(() => nobodySeesTheCar(komenda)));

test('komenda: each floor is one walkable region, so nobody behind bars is stranded as a turret', ok3(() => {
  // R16: an enemy who sees the player but cannot path to them holds position and shoots.
  // With every floor connected, an enemy seen through bars can always come out, and be reached.
  komenda.floors.forEach((f, fi) => {
    const map = T.parse(f.map);
    const tiles = [];
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (T.isWalkable(T.get(map, x, y))) tiles.push([x, y]);
    for (const t of tiles) assert.ok(HW.pathfind.find(map, tiles[0], t) !== null, 'floor ' + fi + ' tile ' + t + ' is cut off');
  });
}));

test('komenda: an armed inmate who spots the player through the bars shoots through them, then walks out', ok3(() => {
  const w = HW.world.load(komenda, 'lajkonik', 5);
  const map = w.floors[0].map;
  const { id, size } = roomsOf(map);
  // a gun-carrying enemy in a small room (a cell) who can see the corridor two tiles below its bars
  const bars = T.find(map, 'w');
  let inmate = null, spot = null;
  for (const e of w.floors[0].enemies) {
    const r = id[T.toTile(e.y)][T.toTile(e.x)];
    if (HW.weapons[e.weapon.id].kind !== 'gun' || size[r] > 20) continue;
    spot = bars.filter(([x, y]) => id[y - 1] && id[y - 1][x] === r)
      .map(([x, y]) => [T.center(x), T.center(y + 2)])
      .find(([x, y]) => HW.ai.canSee(w, e, x, y));
    if (spot) { inmate = e; break; }
  }
  assert.ok(inmate, 'an armed inmate watches the corridor through the bars of his cell');
  const cell = id[T.toTile(inmate.y)][T.toTile(inmate.x)];
  const p = w.player;
  p.x = spot[0]; p.y = spot[1]; p.invulnT = 1e9;
  for (const e of w.floors[0].enemies) if (e !== inmate) e.alive = false; // only the inmate acts
  const barRow = T.toTile(spot[1]) - 2;
  let shots = 0, through = false, left = false;
  for (let i = 0; i < 60 * 5 && !left; i++) {
    HW.sim.step(w, Object.assign(HW.sim.emptyInput(), { aim: { x: inmate.x, y: inmate.y } }), 1 / 60);
    shots += w.events.filter((ev) => ev.type === 'shot').length;
    through = through || w.projectiles.some((b) => T.toTile(b.y) > barRow);
    w.events.length = 0;
    left = id[T.toTile(inmate.y)][T.toTile(inmate.x)] !== cell;
  }
  assert.ok(shots > 0, 'the inmate opened fire');
  assert.ok(through, 'his bullets passed the bars into the corridor');
  assert.ok(left, 'the inmate walked out of the cell');
}));
