# Hotline Warsaw Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser-playable, Hotline Miami-style top-down shooter set in PRL-era Warsaw — three levels, procedural pixel art and synth audio, no build step.

**Architecture:** Plain `<script>` files attach to one global `HW` namespace, loaded in order by `index.html`. A pure-logic simulation (`HW.sim.step(world, input, dt)` at fixed 60 Hz) mutates a `World` built from immutable level data and emits `world.events`; presentation (renderer, fx, audio, UI) reads the world and drains events. Every script is loadable in Node so `node --test` covers the logic.

**Tech Stack:** HTML5 Canvas 2D, Web Audio API, vanilla ES2020 JavaScript, Node 24 built-in test runner (`node:test`, `node:assert/strict`, `node:vm`). No npm dependencies.

**Spec:** `docs/superpowers/specs/2026-10-20-hotline-warsaw-design.md`

## Global Constraints

- No build step, no npm dependencies, no external assets or CDN; must run from `file://` and GitHub Pages in current Chrome and Firefox.
- No ES modules. Every file is `(function (HW) { 'use strict'; ... })(globalThis.HW);` and assigns into a sub-namespace. `js/core/ns.js` does `globalThis.HW = globalThis.HW || {};`.
- **Every script must be safe to evaluate in Node:** no `window`/`document`/`AudioContext`/`localStorage` access at load time — only inside functions. `main.js` boots only when `typeof document !== 'undefined'`.
- Units: pixels and seconds; angles in radians (0 = +x, clockwise-positive since y points down). Tiles are 16 px (`HW.tilemap.TILE`). Tile coords `[tx, ty]`; pixel centre of a tile = `tx*16+8`.
- Fixed timestep `dt = 1/60`; max 5 sim steps per rendered frame.
- Internal resolution 480×270, integer scale ≥ 1, `imageSmoothingEnabled = false`.
- Deterministic: all randomness in the simulation goes through `world.rng` (`HW.rng.create(seed)`); `HW.world.load` with the same inputs yields the same world.
- In-game text Polish (with diacritics), drawn with the bitmap font.
- localStorage key: `hotline-warsaw-save-v1`.
- Every GitHub command uses the personal token: `GH_TOKEN=$(cat ~/.gh_token_personal) <command>`. Never the ambient `GH_TOKEN`.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; push after each task: `GH_TOKEN=$(cat ~/.gh_token_personal) git push`.
- Test command for the whole suite: `node --test "test/**/*.test.js"` → all pass, 0 fail.

**Deviation from spec file list (intentional):** corpses are plain records in `world.corpses` created by `combat.kill`, so there is no `entities/corpse.js`. Added: `world/world.js` (`HW.world.load`) and `systems/sim.js` (`HW.sim.step`), which the spec names but does not place.

## Review Focus

1. **Bullets/thrown weapons tunnelling at speed** — a bullet travels 10 px/step; a door is a thin segment. Expect a bullet fired at a closed door to stop at it, never pass. → Task 7 test `bullet stops at closed door`.
2. **Restart after a messy death** — R pressed mid-execution, mid-door-swing, with bullets in flight. Expect a fresh world identical to the first load. → Task 5 test `load is deterministic and independent of previous worlds`.
3. **Corrupt or unavailable localStorage** (private mode, garbage JSON, quota/throwing accessor). Expect defaults, no crash. → Task 11 tests.
4. **Long frame / backgrounded tab** (frameDt = 3 s). Expect at most 5 steps and the accumulator capped, not a catch-up spiral. → Task 12 test `stepsFor clamps`.
5. **Weapon thrown point-blank into a wall** — expect it to land on a walkable tile so it can be picked up again. → Task 7 test `thrown weapon never rests inside a wall`.

---

## File Map

| File | Responsibility |
|---|---|
| `index.html`, `css/style.css` | page shell, ordered script tags |
| `js/core/ns.js`, `math.js`, `rng.js` | namespace, geometry helpers, seeded RNG |
| `js/core/input.js`, `loop.js` | DOM input → `InputState`; rAF fixed-step loop |
| `js/world/tilemap.js`, `collision.js`, `raycast.js`, `pathfind.js`, `noise.js`, `world.js` | map parsing, movement collision, line tests, A*, noise events, world construction |
| `js/entities/weapon.js`, `player.js`, `enemy.js`, `door.js`, `projectile.js` | entity data + per-entity update |
| `js/systems/combat.js`, `ai.js`, `scoring.js`, `masks.js`, `sim.js` | rules across entities; sim step order |
| `js/levels/validate.js`, `blok.js`, `pewex.js`, `komenda.js` | level checker and data |
| `js/save.js` | persistent progress |
| `js/gfx/palette.js`, `font.js`, `sprites.js`, `camera.js`, `fx.js`, `renderer.js` | drawing |
| `js/audio/synth.js`, `sfx.js`, `music.js` | Web Audio |
| `js/ui/screens.js`, `hud.js`, `phonecall.js`, `js/main.js` | game flow |
| `test/helpers/load.js`, `test/helpers/fixtures.js`, `test/*.test.js` | Node test harness |

## Shared Data Shapes (referenced by many tasks)

```js
// InputState — produced by HW.input (Task 12) or by tests directly
{ move: {x, y},            // each -1..1, not yet normalized
  aim: {x, y},             // world pixel coords of cursor
  fire: bool,              // left button held
  firePressed: bool,       // left button went down this step
  throwPressed: bool,      // right button went down this step
  executePressed: bool,    // Space went down this step
  look: bool }             // Shift held
// HW.sim.emptyInput() returns all-false/zero InputState.

// World — built by HW.world.load (Task 5)
{ level,                   // the level data object
  floorIndex,              // floor the player is on
  floors: [{ map, doors: [Door], items: [Item], enemies: [Enemy] }],
  player: Player,
  projectiles: [],         // bullets (current floor only)
  thrown: [],              // thrown Items in flight (current floor only)
  corpses: [],             // {x, y, angle, floor, kind}
  noises: [],              // {x, y, radius} emitted this step, cleared at end of step
  events: [],              // {type, x, y, ...} appended by sim, drained by presentation
  time,                    // seconds since level start
  status,                  // 'alive' | 'dead' | 'cleared' | 'won'
  score: ScoreState,
  mask,                    // mask id
  rng }
// Event types: 'shot','melee','swing','kill','death','door','knockdown','pickup','throw','execute','floor','cleared','won','shieldbreak','click'
```

---

### Task 1: Scaffold, namespace, math, RNG, test harness

**Files:**
- Create: `index.html`, `css/style.css`, `js/core/ns.js`, `js/core/math.js`, `js/core/rng.js`, `test/helpers/load.js`, `test/scaffold.test.js`, `test/math.test.js`, `.gitignore` (`node_modules/`, `.DS_Store`), `LICENSE` (MIT, 2026, Maciej Sulewski)

**Interfaces:**
- Produces:
  - `HW.math`: `clamp(v,a,b)`, `lerp(a,b,t)`, `len(x,y)`, `norm(x,y)->{x,y}` (zero vector → `{x:0,y:0}`), `angleTo(ax,ay,bx,by)`, `angleDiff(a,b)` (result in [-π, π]), `inArc(ox,oy,facing,arc,range,tx,ty)->bool` (`arc` is full width in radians), `approach(cur,target,maxDelta)`, `deg(d)` (degrees → radians).
  - `HW.rng.create(seed:uint32) -> { next(): [0,1), range(a,b): number, pick(arr) }` — mulberry32.
  - `test/helpers/load.js`: `scriptList() -> string[]` (ordered `src` values from `index.html`), `loadHW() -> HW` (fresh `vm` context with `console`, runs every script in order, returns `context.HW`).

- [ ] **Step 1: Write failing tests**

`test/scaffold.test.js`:
```js
test('index.html references every js file', () => {
  const listed = new Set(scriptList());
  for (const f of allJsFilesUnder('js')) assert.ok(listed.has(f), `${f} not in index.html`);
});
test('all scripts load in node without DOM', () => { const HW = loadHW(); assert.equal(typeof HW, 'object'); });
```
`test/math.test.js`:
```js
assert.equal(M.angleDiff(M.deg(170), M.deg(-170)).toFixed(4), (-M.deg(20)).toFixed(4));
assert.ok(M.inArc(0,0, 0, M.deg(90), 20, 10, 5));       // 26.6° off-axis, inside 45° half-arc
assert.ok(!M.inArc(0,0, 0, M.deg(90), 20, 0, 15));      // 90° off-axis
assert.ok(!M.inArc(0,0, 0, M.deg(90), 20, 25, 0));      // beyond range
assert.deepEqual(M.norm(0,0), {x:0,y:0});
const a = HW.rng.create(42), b = HW.rng.create(42);
assert.deepEqual([a.next(),a.next()], [b.next(),b.next()]);
```

- [ ] **Step 2: Run** `node --test "test/**/*.test.js"` — Expected: FAIL (missing files).
- [ ] **Step 3: Implement** the files. `index.html`: `<canvas id="game">`, `<link rel="stylesheet" href="css/style.css">`, script tags in the order of the File Map (each later task appends its own tags in that order). `style.css`: black body, no margin, canvas centred, `cursor: none`, `image-rendering: pixelated`.
- [ ] **Step 4: Run** `node --test "test/**/*.test.js"` — Expected: PASS.
- [ ] **Step 5: Commit and push** — `git add -A && git commit -m "feat: scaffold, math, rng, test harness"` then push.

---

### Task 2: Tilemap, collision, raycast

**Files:**
- Create: `js/world/tilemap.js`, `js/world/collision.js`, `js/world/raycast.js`, `test/world.test.js`

**Interfaces:**
- Consumes: `HW.math`.
- Produces:
  - `HW.tilemap`: `TILE = 16`; `parse(rows:string[]) -> Map {w, h, rows}`; `get(map,tx,ty) -> char` (`'#'` out of bounds); `isSolid(ch)` (`#`, `w`); `blocksBullets(ch)` (`#`); `blocksSight(ch)` (`#`); `isWalkable(ch)` (`. ~ P S D`); `find(map, ch) -> [[tx,ty]]`; `toTile(px) -> int`; `center(t) -> px`.
  - `HW.collision.moveCircle(map, segments, x, y, r, dx, dy) -> {x, y}` — axis-separated movement against solid tiles and line segments `{x0,y0,x1,y1}` (doors); never ends overlapping.
  - `HW.collision.circleSegment(cx,cy,r,seg) -> bool`.
  - `HW.raycast.cast(map, segments, x0,y0,x1,y1, mode:'bullet'|'sight') -> {hit:bool, x, y, t, segIndex:number|-1}` — DDA tile traversal + segment intersection; returns the nearest blocker. `HW.raycast.clear(...) -> bool` = `!cast(...).hit`.

- [ ] **Step 1: Write failing tests** in `test/world.test.js`, using map `['#####','#...#','#.#.#','#.w.#','#####']`:
```js
test('circle cannot pass into wall', () => { const p = C.moveCircle(map, [], 24, 24, 5, -20, 0); assert.ok(p.x >= 16 + 5); });
test('circle slides along wall', () => { const p = C.moveCircle(map, [], 24, 24, 5, -20, 6); assert.equal(p.y, 30); });
test('window blocks movement but not bullets or sight', () => {
  assert.ok(R.clear(map, [], 24, 56, 56, 56, 'bullet'));   // row 3 crosses 'w' at (2,3)
  assert.ok(R.clear(map, [], 24, 56, 56, 56, 'sight'));
});
test('wall blocks sight', () => assert.ok(!R.clear(map, [], 24, 40, 56, 40, 'sight')));
test('segment blocks ray and reports index', () => {
  const r = R.cast(map, [{x0:40,y0:16,x1:40,y1:32}], 24, 24, 56, 24, 'bullet');
  assert.equal(r.segIndex, 0); assert.equal(Math.round(r.x), 40);
});
```
- [ ] **Step 2: Run** `node --test test/world.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** the three files.
- [ ] **Step 4: Run** `node --test "test/**/*.test.js"` — Expected: PASS.
- [ ] **Step 5: Commit and push** — `feat: tilemap, collision, raycast`.

---

### Task 3: A* pathfinding

**Files:**
- Create: `js/world/pathfind.js`, `test/pathfind.test.js`

**Interfaces:**
- Consumes: `HW.tilemap`.
- Produces: `HW.pathfind.find(map, [sx,sy], [gx,gy]) -> [[tx,ty], ...] | null` — includes goal, excludes start; 8-neighbour, diagonal cost √2, no corner cutting (diagonal allowed only if both orthogonal neighbours walkable); walkable = `HW.tilemap.isWalkable`; doors are passable.

- [ ] **Step 1: Write failing tests:**
```js
test('finds route around wall', () => { const p = PF.find(map, [1,1], [3,1]); assert.deepEqual(p.at(-1), [3,1]); });
test('no corner cutting', () => { /* map with walls at [2,1] and [1,2]: path from [1,1] to [2,2] is null */ });
test('unreachable returns null', ...);
test('start equals goal returns []', ...);
```
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** (binary-heap open set, octile heuristic). **Step 4: Run** `node --test "test/**/*.test.js"` — PASS.
- [ ] **Step 5: Commit and push** — `feat: A* pathfinding`.

---

### Task 4: Level format and validator

**Files:**
- Create: `js/levels/validate.js`, `js/entities/weapon.js` (weapon table only), `js/entities/enemy.js` (type table only), `test/validate.test.js`, `test/helpers/fixtures.js`

**Interfaces:**
- Consumes: `HW.tilemap`.
- Produces:
  - `HW.weapons` — table keyed by id with `{id, name, kind:'melee'|'gun', lethal, arc, range, cooldown, ammo, pellets, spread, noise, auto}` using spec §3 values (`arc`/`spread` stored in radians; fists `lethal:false`; knife thrown kills: `throwLethal:true` only on knife).
  - `HW.enemyTypes` — `{dresiarz:{reaction:0.25}, bandzior:{reaction:0.25}, milicjant:{reaction:0.15}}`.
  - `HW.levels` namespace object; `HW.levels.validate(level) -> string[]` implementing every check in spec §7 "Validation". Messages name the level title and coordinates, e.g. `POZIOM 2: PEWEX: floor 0 enemy 3 at (14,3) is not on a walkable tile`.
  - `test/helpers/fixtures.js`: `makeLevel(rows, {enemies=[], items=[], floors}) -> level` (wraps a single floor with `id:'test'`, `targetScore:1000`, empty neon/stairs/phoneCall, `music:{root:'A',progression:[0,5,3,4]}`).

- [ ] **Step 1: Write failing tests** — one test per check: a valid fixture returns `[]`; each of these returns exactly one error containing the stated fragment: non-rectangular map (`rectangular`), unknown char `x` (`unknown tile`), zero or two `P` (`exactly one P`), door with walls on no opposing pair (`door`), enemy in wall (`walkable`), patrol point in wall (`patrol`), unknown weapon `bazooka` (`weapon`), unknown enemy type (`type`), stair target on missing floor (`stair`), `targetScore: 0` (`targetScore`).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `node --test "test/**/*.test.js"` — PASS.
- [ ] **Step 5: Commit and push** — `feat: level format validator, weapon and enemy tables`.

---

### Task 5: World construction and player movement

**Files:**
- Create: `js/world/world.js`, `js/entities/player.js`, `js/entities/door.js` (create + segment only), `js/systems/sim.js`, `js/systems/masks.js` (table only), `test/player.test.js`
- Modify: `js/entities/enemy.js` (add `HW.enemy.create`)

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  - `HW.masks` table: `{lajkonik:{perk:null}, bolek:{perk:'knife'}, lolek:{perk:'doorStun'}, czapka:{perk:'shield'}, kleks:{perk:'speed'}}` each with `name` from spec §6.
  - `HW.door.create(tx, ty, map) -> Door {hx, hy, angle, closedAngle, av, len:16}` — hinge on the left wall neighbour (horizontal door, `closedAngle 0`) or top wall neighbour (vertical door, `closedAngle π/2`). `HW.door.segment(door) -> {x0,y0,x1,y1}`.
  - `HW.player.create(x, y, maskId) -> Player {x, y, r:5, vx, vy, facing, weapon:{id,ammo}|null, cooldown, executing:null, alive:true, shield:bool, speed}` — `speed` 120, or 144 with `kleks`; `bolek` starts with `{id:'knife'}`; `czapka` sets `shield:true`.
  - `HW.player.update(world, input, dt)` — movement only in this task: target velocity = normalized `input.move` × speed; velocity approaches target at `speed/0.08` px/s²; `collision.moveCircle` against floor map and door segments; `facing = angleTo(player, input.aim)`.
  - `HW.world.load(level, maskId, seed = 1) -> World` (shape above). Enemies are built from defs via `HW.enemy.create(def, floorIndex)` (Task 8 fills behaviour; here it returns `{type, x, y, r:5, facing, weapon:{id,ammo}, state:'patrol', patrol, floor, downedT:0, alive:true}`), items via `{id, x, y, ammo, vx:0, vy:0, spin:0}`.
  - `HW.sim.step(world, input, dt)` — clears `world.noises`, increments `world.time`, calls `player.update`; later tasks add calls in this order: player → doors → enemies (ai) → projectiles → thrown → combat timers → scoring tick → status check. `HW.sim.emptyInput()`.

- [ ] **Step 1: Write failing tests:**
```js
test('player moves right at 120 px/s after acceleration', () => {
  const w = HW.world.load(makeLevel(openRoom), 'lajkonik');
  const x0 = w.player.x; for (let i = 0; i < 60; i++) HW.sim.step(w, {...empty, move:{x:1,y:0}}, 1/60);
  assert.ok(Math.abs((w.player.x - x0) - 120) < 8);
});
test('diagonal speed is normalized', ...);              // |v| ≈ 120 after 1 s
test('kleks mask moves at 144 px/s', ...);
test('bolek starts with knife; czapka has shield', ...);
test('player cannot walk through a closed door', ...);  // door segment blocks
test('load is deterministic and independent of previous worlds', () => {
  const a = HW.world.load(lvl, 'lajkonik'); for (let i=0;i<120;i++) HW.sim.step(a, movingInput, 1/60);
  const b = HW.world.load(lvl, 'lajkonik'), c = HW.world.load(lvl, 'lajkonik');
  assert.deepEqual(strip(b), strip(c));                  // strip() drops rng closures
  assert.notStrictEqual(b.floors[0].enemies[0], a.floors[0].enemies[0]);
});
```
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `node --test "test/**/*.test.js"` — PASS.
- [ ] **Step 5: Commit and push** — `feat: world load, player movement, sim step`.

---

### Task 6: Doors swing and knock down

**Files:**
- Modify: `js/entities/door.js`, `js/systems/sim.js`
- Create: `js/systems/combat.js` (only `knockdown` in this task), `test/door.test.js`

**Interfaces:**
- Produces:
  - `HW.door.push(door, x, y, r, vx, vy)` — if the circle overlaps the door segment, add angular velocity proportional to the velocity component normal to the door (`av += sign * |vn| / 16 * 1.2` rad/s), away from the pusher.
  - `HW.door.update(world, door, dt)` — integrate angle, clamp to `closedAngle ± π/2` (zero `av` on clamp), damp `av *= 0.9^ (dt*60)`; if `|av| > 4` and the segment overlaps a living, non-downed enemy circle → `HW.combat.knockdown(world, enemy, world.mask === 'lolek' ? 5 : 2.5, 'door')`, emit `{type:'door'}` once per swing.
  - `HW.combat.knockdown(world, enemy, seconds, source)` — sets `enemy.state='downed'`, `enemy.downedT=seconds`, `enemy.downedBy=source`; emits `knockdown`.
  - Player and enemies push doors each step (sim calls `door.push` for every character, then `door.update`).

- [ ] **Step 1: Write failing tests:** player running into a door opens it (angle changes > 0.5 rad within 0.5 s); enemy standing just behind a door is downed for 2.5 s when the player sprints through; with `lolek` it's 5 s; a door nudged slowly (player walking at 20 px/s) does not knock down; door angle never exceeds `closedAngle ± π/2`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `node --test "test/**/*.test.js"` — PASS.
- [ ] **Step 5: Commit and push** — `feat: swinging doors with knockdown`.

---

### Task 7: Combat — melee, guns, throwing, pickup, executions, death

**Files:**
- Modify: `js/systems/combat.js`, `js/entities/player.js`, `js/systems/sim.js`
- Create: `js/entities/projectile.js`, `js/world/noise.js`, `test/combat.test.js`

**Interfaces:**
- Produces:
  - `HW.noise.emit(world, x, y, radius)` — pushes to `world.noises` (no-op for radius 0).
  - `HW.combat.attack(world, attacker, angle)` — respects `cooldown`; melee: every living character (other than attacker) within `inArc(weapon.arc, weapon.range)` and with a clear `'bullet'` raycast is hit — fists → `knockdown(2.5,'fists')`, lethal → `kill(...,'melee')`; emits `swing`/`melee`. Gun: if `ammo > 0`, decrement, spawn `pellets` bullets with spread from `world.rng`, `noise.emit(weapon.noise)`, emit `shot`; empty gun does nothing (emit `click`).
  - `HW.projectile.spawn(world, x, y, angle, owner)`; `HW.projectile.update(world, dt)` — each bullet moves 600 px/s; per step cast the segment from old to new position with `raycast.cast(...,'bullet')` against door segments; also test circle hits for characters along that segment (nearest first, skip owner); hit → `kill(victim, 'gun', owner)`.
  - `HW.combat.throwWeapon(world, char, angle)` — removes held weapon, adds Item to `world.thrown` with speed 300 px/s, decel 600 px/s², spin; on character hit → knockdown 2.5 s (`'thrown'`) or kill (`'thrown'`) if `throwLethal`; on wall → stops, position pushed back to the last walkable point; when speed < 20 it lands into `floors[floorIndex].items`.
  - `HW.combat.pickUp(world, player)` — nearest item within 14 px when hands empty; emits `pickup`.
  - `HW.combat.startExecution(world, player)` — downed enemy within 12 px → `player.executing = {target, t:0.6}`; player cannot move/act; at 0 → `kill(target, 'execution', player, {door: target.downedBy === 'door'})`. Interrupted only if the player dies.
  - `HW.combat.kill(world, victim, cause, killer, extra={})` — victim `alive=false`, drops held weapon as Item, pushes corpse, emits `kill` `{cause, victimHadGun, door}`; if victim is player: shield absorbs once (`shield=false`, emit `shieldbreak`) else `world.status='dead'`, emit `death`. Calls `HW.scoring.onKill` when the killer is the player (Task 9 wires; guard if absent).
  - Player input handling: `fire`/`firePressed` (auto only for `weapon.auto`), `throwPressed` → throw or pickUp, `executePressed` → startExecution. With `weapon === null` attack uses `HW.weapons.fists`.

- [ ] **Step 1: Write failing tests** (each on a small fixture map):
```js
test('pipe kills enemy in front, not behind', ...);
test('fists knock down, do not kill', ...);
test('melee blocked by wall between', ...);
test('pistol: 8 rounds, 9th click does nothing', ...);
test('shotgun fires 6 pellets', ...);                 // world.projectiles.length === 6 after one shot
test('gunshot emits noise radius 250 (pistol)', ...);
test('bullet stops at closed door', ...);             // enemy behind closed door survives
test('bullet passes window and kills', ...);
test('friendly fire: enemy bullet kills enemy', ...);
test('thrown bat knocks down, thrown knife kills', ...);
test('thrown weapon never rests inside a wall', () => {
  // player hugging wall throws into it at point blank; after 2 s the item is in floor items on a walkable tile
});
test('pickup only when empty-handed and within 14 px', ...);
test('execution takes 0.6 s and locks movement', ...);
test('execution of door-downed enemy carries door flag', ...);
test('czapka absorbs first hit, second kills', ...);
test('killed enemy drops its weapon', ...);
```
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `node --test "test/**/*.test.js"` — PASS.
- [ ] **Step 5: Commit and push** — `feat: combat, projectiles, throwing, executions`.

---

### Task 8: Enemy AI

**Files:**
- Modify: `js/entities/enemy.js`, `js/systems/sim.js`
- Create: `js/systems/ai.js`, `test/ai.test.js`

**Interfaces:**
- Consumes: `raycast`, `pathfind`, `combat.attack`, `world.noises`.
- Produces:
  - `HW.ai.canSee(world, enemy, x, y) -> bool` — within 220 px, within 110° cone of `enemy.facing`, clear `'sight'` ray against walls and door segments.
  - `HW.ai.update(world, enemy, dt)` — states `patrol | alert | chase | investigate | search | downed | dead` per spec §4: patrol 90 px/s (stationary enemies keep `facing`; waypoint loop otherwise), on sight → `alert` with `reactT = type.reaction`, then `chase`; chase 115 px/s along A* path recomputed ≤ every 0.5 s, `lastSeen` updated while visible; armed (gun) enemies call `combat.attack` with aim error `±deg(4)` from `world.rng` while visible; melee enemies attack when within weapon range; lose sight → `search` (go to `lastSeen`, wait 3 s) → `patrol` (walk back to route start); hearing: noise within radius while not seeing player → `investigate` toward source then `search`; `downed` counts down `downedT`, then → `chase` if `canSee` player else `search`.
  - Enemies on floors other than `world.floorIndex` are not updated.

- [ ] **Step 1: Write failing tests:**
```js
test('sees player in cone, not behind', ...);
test('does not see through wall or closed door', ...);
test('reaction delay: no shot before 0.25 s, shot by 0.5 s', ...);
test('milicjant reacts in 0.15 s', ...);
test('gunshot within radius sends unaware enemy to investigate', ...);
test('enemy beyond noise radius stays on patrol', ...);
test('lost sight → search → patrol after 3 s wait', ...);
test('chasing enemy pathfinds around wall to reach player', ...);
test('downed enemy gets up after 2.5 s', ...);
test('patrol follows waypoints in a loop', ...);
```
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `node --test "test/**/*.test.js"` — PASS.
- [ ] **Step 5: Commit and push** — `feat: enemy AI state machine`.

---

### Task 9: Scoring, level completion, floors

**Files:**
- Create: `js/systems/scoring.js`, `test/scoring.test.js`
- Modify: `js/systems/combat.js`, `js/systems/sim.js`

**Interfaces:**
- Produces:
  - `HW.scoring.create() -> ScoreState {points, chain:[], multiplier, lastKillT, kinds:Set, bold}`.
  - `HW.scoring.onKill(state, time, cause, {victimHadGun, door})` — base points per spec §5 (`melee` 400, `gun` 300, `execution` 600, `thrown` 500, `+500` and kind `door` when `door`); a kill within 2.5 s of the previous raises `multiplier` (max 8); boldness +300 for melee/execution kills on gun holders.
  - `HW.scoring.tick(state, time)` — when the window has expired, bank chain bonus `sum(chain) × (multiplier − 1)`, reset.
  - `HW.scoring.finish(state, seconds, targetScore) -> {lines:[{label, points}], total, grade}` — banks open chain; lines: `ZABÓJSTWA`, `COMBO`, `ELASTYCZNOŚĆ` (200 × kinds), `CZAS` (`max(0, 3000 − 20·s)`), `ODWAGA`.
  - `HW.scoring.grade(ratio) -> 'A+'|'A'|'B'|'C'|'D'|'F'` with thresholds 1.0, 0.85, 0.7, 0.55, 0.4.
  - Sim status: when every enemy on every floor is dead → `status='cleared'`, emit `cleared`; while `cleared`, player on the `P` tile of floor 0 → `status='won'`, emit `won`. Stairs: player centre entering an `S` tile with a `stairs` entry moves player to `to.floor`/`to.at`, sets `floorIndex`, clears projectiles/thrown, emits `floor`; entering the arrival tile does not bounce back until the player leaves it.

- [ ] **Step 1: Write failing tests:** combo ×3 for three kills 1 s apart and bonus banked after 2.5 s idle equals `sum × 2`; fourth kill 3 s later starts a new chain; door execution scores 1100 and adds kind `door`; flexibility with melee+gun = 400; time bonus at 60 s = 1800, at 200 s = 0; grade boundaries `grade(0.85) === 'A'`, `grade(0.8499) === 'B'`, `grade(1) === 'A+'`, `grade(0.39) === 'F'`; level clears only when enemies on both floors are dead; won only after returning to `P`; stairs move player between floors and back.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `node --test "test/**/*.test.js"` — PASS.
- [ ] **Step 5: Commit and push** — `feat: scoring, combos, level completion, stairs`.

---

### Task 10: Mask unlocks

**Files:**
- Modify: `js/systems/masks.js`
- Create: `test/masks.test.js`

**Interfaces:**
- Produces: `HW.masks.unlocksAfter(levelId, grade, unlocked:string[]) -> string[]` (newly unlocked only), `HW.masks.levelOrder = ['blok','pewex','komenda']`, `HW.masks.nextLevel(levelId) -> id|null`. Rules from spec §6: finish blok → bolek; grade ≥ B on blok → lolek; finish pewex → czapka; grade ≥ A on any → kleks. "Finish" = any grade including F.

- [ ] **Step 1: Write failing tests:** blok with C → `['bolek']`; blok with B → `['bolek','lolek']`; pewex with A → `['czapka','kleks']`; already unlocked ids are not repeated; komenda with F → `[]`.
- [ ] **Step 2–4:** Run (FAIL) → implement → run `node --test "test/**/*.test.js"` (PASS).
- [ ] **Step 5: Commit and push** — `feat: mask unlock rules`.

---

### Task 11: Save

**Files:**
- Create: `js/save.js`, `test/save.test.js`

**Interfaces:**
- Produces: `HW.save.KEY = 'hotline-warsaw-save-v1'`; `HW.save.defaults() -> {unlockedLevels:['blok'], unlockedMasks:['lajkonik'], bestScores:{}}`; `HW.save.load(storage) -> data`; `HW.save.store(storage, data) -> bool`; `HW.save.recordResult(data, levelId, total, grade) -> {data, newMasks, newLevel}` (pure; uses `HW.masks`). `storage` is a `localStorage`-like object or `null`; `main.js` passes a getter-wrapped `localStorage`.

- [ ] **Step 1: Write failing tests:** null storage → defaults; `getItem` throws → defaults; garbage JSON → defaults; valid partial JSON missing `bestScores` → merged with defaults; arrays of wrong type → defaults for that field; `setItem` throws → `store` returns false without throwing; `recordResult` keeps the higher best score and unlocks the next level.
- [ ] **Step 2–4:** Run (FAIL) → implement → run `node --test "test/**/*.test.js"` (PASS).
- [ ] **Step 5: Commit and push** — `feat: save with safe storage`.

---

### Task 12: Playable slice — input, loop, camera, palette, font, sprites, renderer, fx, minimal main

**Files:**
- Create: `js/core/input.js`, `js/core/loop.js`, `js/gfx/palette.js`, `js/gfx/font.js`, `js/gfx/sprites.js`, `js/gfx/camera.js`, `js/gfx/fx.js`, `js/gfx/renderer.js`, `js/main.js`, `js/levels/blok.js` (temporary one-room draft, replaced in Task 15), `test/presentation.test.js`

**Interfaces:**
- Produces:
  - `HW.loop.stepsFor(acc, frameDt, dt = 1/60, max = 5) -> {steps, acc}` — pure; when steps would exceed `max`, return `max` and `acc = 0`. `HW.loop.start(update(dt), render(alpha))` — rAF driver, wraps both in try/catch and calls `onError(err)`.
  - `HW.input.attach(canvas) -> { sample(cam) -> InputState, keyPressed(code) -> bool }` — key/mouse listeners; "pressed" flags latch until sampled; aim converted from screen to world via `HW.camera.screenToWorld`.
  - `HW.camera`: `create()`, `scaleFor(winW, winH) -> int ≥ 1` (largest integer with 480·s ≤ w and 270·s ≤ h, min 1), `update(cam, world, input, dt)` (follow player, Shift look-ahead 40% toward cursor, shake decay), `screenToWorld(cam, sx, sy)`, `shake(cam, amount)`.
  - `HW.palette` — named colours from spec §8 plus per-level floor colours (`floor.blok`, `floor.pewex`, `floor.komenda`).
  - `HW.font` — `GLYPHS` (5×7 bitmaps as 7 strings of 5 chars), `measure(text, scale) -> px`, `draw(ctx, text, x, y, color, scale=1, align='left')`. Must cover `A–Z`, `ĄĆĘŁŃÓŚŹŻ`, `0–9`, ` .,:!?-+%×/()'"`. Lowercase input is upper-cased.
  - `HW.sprites.build() -> sprites` — offscreen canvases: characters per type (player body, dresiarz tracksuit, bandzior leather jacket, milicjant blue-grey uniform) with 2 walk frames + attack frame, mask head overlays per mask id, weapon icons per weapon id, corpse per type, tiles (floor variants, wall, window, carpet, stairs, car). Drawn top-down at 12×12, rotated at draw time.
  - `HW.fx`: `create()`, `consume(fx, events, cam)` (muzzle flash, blood splats onto a persistent decal canvas, shake, 40 ms hit-stop on `kill`), `update(fx, dt)`, `hitStop(fx) -> bool`, `clearDecals(fx)`.
  - `HW.renderer.draw(ctx, world, cam, fx, sprites, t)` — order: floor tiles → decals → items → corpses → doors → characters → projectiles → walls/windows → neon (additive, flicker) → magenta/cyan pulse tint → crosshair.
  - `main.js` (this task): boot → load `HW.levels.blok` with `lajkonik` → PLAYING loop; R restarts (`world.load` + `fx.clearDecals`); "ERROR — PRESS R" overlay on caught error; validation errors drawn on screen.

- [ ] **Step 1: Write failing tests** in `test/presentation.test.js`:
```js
test('stepsFor normal frame', () => assert.deepEqual(L.stepsFor(0, 1/60), {steps:1, acc:0}));   // approx: compare with epsilon
test('stepsFor clamps', () => { const r = L.stepsFor(0, 3); assert.equal(r.steps, 5); assert.equal(r.acc, 0); });
test('scaleFor', () => { assert.equal(Cam.scaleFor(1920,1080), 4); assert.equal(Cam.scaleFor(300,200), 1); assert.equal(Cam.scaleFor(1000,600), 2); });
test('font covers required glyphs', () => { for (const ch of 'AĄBCĆDEĘFGHIJKLŁMNŃOÓPQRSŚTUVWXYZŹŻ0123456789 .,:!?-+%×/()\'"') assert.ok(HW.font.GLYPHS[ch], ch); });
test('every glyph is 7 rows of 5', ...);
```
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `node --test "test/**/*.test.js"` — PASS.
- [ ] **Step 5: Manual check** — no browser on the VM; ask the user to open `index.html` locally (or wait for Pages in Task 15). Checklist: moves, aims, kills, door knockdown, restart is instant.
- [ ] **Step 6: Commit and push** — `feat: playable slice with renderer and input`.

---

### Task 13: Audio

**Files:**
- Create: `js/audio/synth.js`, `js/audio/sfx.js`, `js/audio/music.js`, `test/audio.test.js`
- Modify: `js/main.js` (drain `world.events` into `HW.sfx.onEvents`; M toggles mute)

**Interfaces:**
- Produces:
  - `HW.synth.init() -> bool` (creates `AudioContext` on first user gesture; false and no-op mode if unavailable), `HW.synth.ctx()`, `HW.synth.master()`, `HW.synth.setMuted(bool)`, `HW.synth.isMuted()`.
  - `HW.sfx.play(name)` for `shot`, `shotgun`, `melee`, `swing`, `door`, `death`, `kill`, `pickup`, `click`, `ring`; `HW.sfx.onEvents(events)` maps event types to sounds (`shot` uses `shotgun` when `weapon === 'shotgun'`).
  - `HW.music.start({root, progression})`, `HW.music.stop()`, `HW.music.muffle(bool)` — 110 BPM look-ahead scheduler (25 ms timer, 0.1 s horizon): saw bass arpeggio, pad chords, noise snare on 2/4, sine kick on 1/3; low-pass filter at ~600 Hz when muffled.

- [ ] **Step 1: Write failing tests:** in Node (no `AudioContext`) `synth.init()` returns false and `sfx.play('shot')`, `sfx.onEvents([{type:'shot'}])`, `music.start(...)`, `music.muffle(true)`, `music.stop()` do not throw; `setMuted(true)` → `isMuted()` true.
- [ ] **Step 2–4:** Run (FAIL) → implement → run `node --test "test/**/*.test.js"` (PASS).
- [ ] **Step 5: Commit and push** — `feat: procedural synthwave music and sfx`.

---

### Task 14: Game flow screens and HUD

**Files:**
- Create: `js/ui/screens.js`, `js/ui/hud.js`, `js/ui/phonecall.js`, `test/flow.test.js`
- Modify: `js/main.js`

**Interfaces:**
- Produces:
  - `HW.flow.create(save) -> Flow {state:'title', levelId, maskId, world, results}`; `HW.flow.handle(flow, action) -> flow` — pure transitions, actions: `{type:'click'}`, `{type:'select', id}`, `{type:'confirm'}`, `{type:'back'}`, `{type:'won', results}`. Order: `title → levelSelect → phoneCall → maskSelect → playing → results → levelSelect`; `back` from `playing` → `levelSelect`; only unlocked levels/masks selectable.
  - `HW.phonecall.create(lines) -> {lines, shown, done}`, `update(pc, dt)` typewriter at 40 chars/s, `skip(pc)`.
  - `HW.screens.draw(ctx, flow, t)` (title with VHS scanlines and "KLIKNIJ ABY ZACZĄĆ"; level select; phone call with ringing then typed text; mask select with perk text; results listing `finish().lines`, total, grade, new unlocks) and `HW.screens.hitTest(flow, x, y) -> action|null`.
  - `HW.hud.draw(ctx, world)` — weapon name + ammo, score, combo `×N` with draining timer bar, "WRACAJ DO AUTA" with arrow toward car when `cleared`, "NIE ŻYJESZ — R" when `dead`.
  - `main.js`: drives the flow; on `won` computes `scoring.finish`, `save.recordResult`, `save.store`, music muffle on results, ring sfx during phone call.

- [ ] **Step 1: Write failing tests:** full happy path transitions; locked level select is ignored; locked mask select is ignored; `back` from playing; typewriter shows 40 chars after 1 s and `skip` completes.
- [ ] **Step 2–4:** Run (FAIL) → implement → run `node --test "test/**/*.test.js"` (PASS).
- [ ] **Step 5: Commit and push** — `feat: title, level select, phone call, masks, results, HUD`.

---

### Task 15: Level 1 "Blok", README, GitHub Pages

**Files:**
- Modify: `js/levels/blok.js` (full level)
- Create: `test/levels.test.js`, `README.md`

**Interfaces:**
- Produces: `HW.levels.blok` per spec §7 — title `POZIOM 1: BLOK`, subtitle `Praga, 1986`, 2 floors joined by stairs, 8–10 enemies mostly `dresiarz` (at most 2 `bandzior`), ≥ 3 doors placed so door-knockdowns are natural, ≥ 1 pistol on the floor, `BAR MLECZNY` cyan neon, phone call of 3–5 Polish lines, `targetScore` 9000, music `{root:'A', progression:[0,5,3,4]}`.

- [ ] **Step 1: Write failing tests** in `test/levels.test.js` (parameterized over `HW.masks.levelOrder`, skipping levels not yet defined): `validate(level)` is `[]`; enemy count within the level's range; every enemy tile reachable from `P` via `pathfind.find` (stairs counted as links between floors); every floor item reachable; `targetScore > 0`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Author the level.** **Step 4: Run** `node --test "test/**/*.test.js"` — PASS.
- [ ] **Step 5: Write README** — title, one-paragraph pitch, play link `https://maciejsulewski.github.io/hotline-warsaw/`, controls table (Global Constraints/spec §3), masks table, how to run tests (`node --test "test/**/*.test.js"`), MIT licence.
- [ ] **Step 6: Commit, push, enable Pages:**
```bash
git add -A && git commit -m "feat: level 1 Blok, README" && GH_TOKEN=$(cat ~/.gh_token_personal) git push
GH_TOKEN=$(cat ~/.gh_token_personal) gh api -X POST repos/MaciejSulewski/hotline-warsaw/pages -f 'source[branch]=main' -f 'source[path]=/'
```
Expected: JSON with `"html_url": "https://maciejsulewski.github.io/hotline-warsaw/"`. Then poll `gh api repos/MaciejSulewski/hotline-warsaw/pages --jq .status` until `built`, and `curl -sI` the URL → `200`.
- [ ] **Step 7: Manual check by user** on the Pages link: level 1 beatable, restart instant, audio after click, results screen.

---

### Task 16: Level 2 "Pewex"

**Files:**
- Create: `js/levels/pewex.js`; Modify: `index.html`

**Interfaces:**
- Produces: `HW.levels.pewex` — title `POZIOM 2: PEWEX`, subtitle `Śródmieście, 1987`, shop floor with shelving (walls `#` used as shelves; cover from gunfire), back room, office; 1–2 floors; 10–12 enemies mostly `bandzior` with pistols/shotguns; magenta `PEWEX` neon; ≥ 1 shotgun and ≥ 1 melee weapon lying around; phone call 3–5 lines; `targetScore` 11000; music `{root:'D', progression:[0,3,5,4]}`.

- [ ] **Step 1:** `node --test test/levels.test.js` already covers it once defined — author the level.
- [ ] **Step 2: Run** `node --test "test/**/*.test.js"` — PASS.
- [ ] **Step 3: Commit and push** — `feat: level 2 Pewex`.

---

### Task 17: Level 3 "Komenda" and final check

**Files:**
- Create: `js/levels/komenda.js`; Modify: `index.html`, `README.md` (screenshot added by user if they wish)

**Interfaces:**
- Produces: `HW.levels.komenda` — title `POZIOM 3: KOMENDA`, subtitle `Mokotów, 1988`, cells (`w` window bars between cells and corridor), interrogation room, armoury with ≥ 2 AKs on the floor; 2 floors; 13–15 enemies including ≥ 5 `milicjant` with `ak`; flickering `MO` neon (cyan and magenta); phone call 3–5 lines; `targetScore` 14000; music `{root:'E', progression:[0,5,6,4]}`.

- [ ] **Step 1:** Author the level.
- [ ] **Step 2: Run** `node --test "test/**/*.test.js"` — PASS.
- [ ] **Step 3: Commit and push** — `feat: level 3 Komenda`.
- [ ] **Step 4: Final manual checklist with the user on the Pages link:** all three levels beatable; unlocks progress and persist after reload; restart < 100 ms; audio + mute; no console errors; `file://` play after `git clone`.
