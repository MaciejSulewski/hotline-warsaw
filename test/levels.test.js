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

test('blok: cyan BAR MLECZNY neon on the facade above the street', () => {
  const n = blok.floors[0].neon.find((s) => s.text === 'BAR MLECZNY' && s.color === 'cyan');
  assert.ok(n);
  const map = T.parse(blok.floors[0].map);
  const tiles = Math.ceil((HW.font.measure(n.text, 1) + 6) / 16);
  for (let x = n.at[0]; x < n.at[0] + tiles; x++) assert.equal(T.get(map, x, n.at[1]), '#', 'sign hangs on a solid wall at x=' + x);
});

test('blok: the street around the car is drawn as pavement and asphalt', () => {
  const ground = blok.floors[0].ground;
  const map = T.parse(blok.floors[0].map);
  const [px, py] = T.find(map, 'P')[0];
  const inside = (g, x, y) => x >= g.rect[0] && y >= g.rect[1] && x <= g.rect[2] && y <= g.rect[3];
  assert.ok(ground.some((g) => g.tile === 'asphalt' && inside(g, px, py)), 'car stands on asphalt');
  assert.ok(ground.some((g) => g.tile === 'pavement'));
  for (const g of ground) {
    for (let y = g.rect[1]; y <= g.rect[3]; y++) for (let x = g.rect[0]; x <= g.rect[2]; x++) {
      assert.ok('.P'.includes(T.get(map, x, y)), g.tile + ' over a non-floor tile at ' + [x, y]);
    }
  }
});

test('blok: at least 3 doors have a guard right behind them (kick-open knockdowns)', () => {
  let n = 0;
  blok.floors.forEach((f) => {
    const map = T.parse(f.map);
    for (const [dx, dy] of T.find(map, 'D')) {
      const d = HW.door.create(dx, dy, map);
      const guarded = (f.enemies || []).some((e) => !e.patrol &&
        Math.hypot(T.center(e.at[0]) - d.hx, T.center(e.at[1]) - d.hy) <= d.len + 5);
      if (guarded) n++;
    }
  });
  assert.ok(n >= 3, 'only ' + n + ' guarded doors');
});

test('blok: no enemy can see the car at spawn, nor from its patrol route', () => {
  const w = HW.world.load(blok, 'lajkonik', 1);
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
});
