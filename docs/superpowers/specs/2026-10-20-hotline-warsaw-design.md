# Hotline Warsaw — Design Spec

Date: 2026-10-20
Status: Approved in brainstorming, pending written-spec review

## 1. Intent

**Goal:** a playable browser prototype that captures the feel of Hotline Miami — fast top-down
combat, one-hit kills, instant restart, a neon look — that is easy to share.

**Setting:** PRL-era Warsaw (1980s communist Poland) with a neon/synthwave tint: grey concrete
blocks, period neon signage, magenta/cyan accents.

**Success criteria**
- All three levels are beatable start to finish.
- Death → restart (R) takes under 100 ms and resets the level exactly.
- Runs by double-clicking `index.html` (file://) and from GitHub Pages, in current Chrome and Firefox.
- No build step, no external assets, no runtime dependencies.

**Assumptions (confirmed):** desktop keyboard + mouse only; Polish in-game text with occasional
English glosses; persistence limited to unlocks and best scores in localStorage.

**Out of scope:** mobile/touch, gamepad, level editor, cutscenes beyond the phone call,
multiplayer, mid-level checkpoints.

## 2. Architecture

Plain `<script>` files (no ES modules, so file:// works) that attach to one global namespace `HW`.
`index.html` loads them in dependency order.

```
index.html              loads scripts in order; one <canvas>
css/style.css           full-window canvas, hidden cursor
js/
  core/      ns.js math.js rng.js input.js loop.js
  world/     tilemap.js collision.js raycast.js pathfind.js noise.js
  entities/  player.js enemy.js weapon.js projectile.js door.js corpse.js
  systems/   ai.js combat.js scoring.js masks.js
  gfx/       palette.js font.js sprites.js renderer.js fx.js camera.js
  audio/     synth.js music.js sfx.js
  ui/        screens.js hud.js phonecall.js
  levels/    validate.js blok.js pewex.js komenda.js
  save.js    localStorage wrapper
  main.js    top-level state machine
test/        *.test.js (node --test)
```

**Layering rule:** `core/math`, `core/rng`, `world/*`, `entities/*`, `systems/*`, `levels/*` are
pure logic — no `window`, `document`, canvas or audio. They are loadable in Node for tests.
`gfx/*`, `audio/*`, `ui/*`, `core/input.js`, `core/loop.js`, `main.js` are presentation and read
game state.

**Each file** is wrapped as `(function (HW) { ... })(typeof HW !== 'undefined' ? HW : globalThis.HW);`
and assigns into a sub-namespace (`HW.math`, `HW.ai`, …). `ns.js` creates `globalThis.HW = {}`.

**Loop:** fixed-timestep simulation at 60 Hz (`dt = 1/60`), rendered on `requestAnimationFrame`.
At most 5 sim steps per frame (spiral-of-death clamp).

**World state:** `HW.world.load(levelData, maskId)` builds a fresh `World` object from immutable
level data (tilemap, entities, doors, items, score state). Restart = call `load` again and clear
the blood decal canvas. Nothing carries over between attempts.

**Rendering:** internal resolution 480×270, scaled by the largest integer factor that fits the
window, `imageSmoothingEnabled = false`. Letterboxed on black.

**Main state machine (`main.js`):**
`TITLE → LEVEL_SELECT → PHONE_CALL → MASK_SELECT → PLAYING → RESULTS → LEVEL_SELECT`.
`PLAYING` has sub-states `ALIVE`, `DEAD` (press R), `CLEARED` (return to car).

## 3. Core gameplay

### Player
- WASD, 120 px/s, quick acceleration (reaches full speed in ~0.08 s), diagonal normalized.
- Collision: circle r = 5 px vs. wall tiles and closed doors.
- Faces the mouse cursor (world coordinates).
- Shift: camera look-ahead toward the cursor, up to 40% of the cursor offset.
- Dies in one hit (unless mask perk prevents it).

### Controls
| Input | Action |
|---|---|
| WASD | move |
| Mouse | aim |
| Left click (hold for auto) | attack / fire |
| Right click | throw held weapon; if empty-handed, pick up nearest weapon within 14 px |
| Space | execute adjacent downed enemy |
| Shift | look-ahead |
| R | restart level |
| M | mute |
| Esc | back to level select |

### Weapons
| Id | Name | Kind | Behaviour | Ammo | Noise radius |
|---|---|---|---|---|---|
| fists | Pięści | melee | knockdown only, no kill; 90° arc, 14 px | — | 0 |
| pipe | Rura | melee | kill; 120° arc, 18 px; 0.35 s cooldown | — | 0 |
| bat | Kij | melee | kill; 120° arc, 20 px; 0.4 s cooldown | — | 0 |
| knife | Nóż | melee | kill; 60° arc, 14 px; 0.2 s cooldown | — | 0 |
| pistol | Pistolet P-64 | gun | 1 bullet, 0.25 s cooldown | 8 | 250 px |
| shotgun | Dubeltówka | gun | 6 pellets, ±12° spread, 0.6 s cooldown | 2 | 300 px |
| ak | Kałach | gun | auto, 0.1 s cooldown, ±3° spread | 30 | 300 px |

- Bullets: points moving at 600 px/s, stopped by walls and closed doors, pass through windows.
- Thrown weapons: 300 px/s, decelerating, spinning; knock down the first enemy hit (and kill if
  the thrown item is a knife). Stop at walls.
- Empty guns cannot fire, only be thrown.
- Killed enemies drop their weapon at their position.

### Doors
- Hinged swinging doors, one tile long, rotating ±90° around the hinge.
- Pushed open by the player's or an enemy's movement; angular velocity proportional to push speed.
- A door swinging at speed into an enemy knocks them down for 2.5 s (5 s with the Lolek mask).
- Closed or partly closed doors block bullets and sight.

### Downed enemies and executions
- Knockdown sources: door, fists, thrown weapon. Duration 2.5 s, then the enemy gets up.
- Space within 12 px of a downed enemy: 0.6 s execution animation; player cannot move or act;
  enemy dies at the end. Interrupted only by the player dying.

### Combat rules
- Enemies die in one hit from any lethal source. Friendly fire enabled.
- Melee: enemies whose centre lies within the arc and range are hit; walls between block it
  (raycast from attacker to target).

### Level completion
- When all enemies are dead: HUD shows "WRACAJ DO AUTA" with an arrow toward the car tile `P`.
- Entering the car tile ends the level → RESULTS.

## 4. Enemies

### State machine
`PATROL → (sees player) ALERT → CHASE/ATTACK → (loses sight) SEARCH → PATROL`.
`PATROL → (hears noise) INVESTIGATE → SEARCH → PATROL`.
Any state → `DOWNED` (knockdown) → previous state is replaced by `CHASE` if the player is visible,
else `SEARCH`. Any state → `DEAD`.

- **Sight:** 110° cone, 220 px, raycast against walls and closed doors. On first seeing the
  player, a reaction delay elapses before attacking (0.25 s; 0.15 s for Milicjant).
- **Hearing:** a gunshot emits a noise event `{x, y, radius}`; walls do not attenuate. Enemies in
  radius that do not currently see the player go to `INVESTIGATE` toward the source.
- **Chase:** A* over the tile grid (4-neighbour + diagonal without corner cutting), path
  recomputed at most every 0.5 s. Armed enemies fire when they have line of sight, with ±4° aim
  error. Melee enemies close in and swing at ≤ their weapon range.
- **Search:** walk to last known player position, wait 3 s, return to patrol route start.
- **Patrol:** either stationary (with a facing angle) or a looping list of waypoints.
- Enemy speed: 90 px/s patrol, 115 px/s chase.

### Types
| Type | Default weapon | Notes |
|---|---|---|
| Dresiarz | pipe or bat | melee |
| Bandzior | pistol or shotgun | ranged |
| Milicjant | ak | 0.15 s reaction; level 3 only |

## 5. Scoring

| Event | Points |
|---|---|
| Melee kill | 400 |
| Gun kill | 300 |
| Execution | 600 |
| Thrown-weapon kill (thrown knife) | 500 |
| Door bonus (added to an execution of an enemy downed by a door) | +500 |

Kill types for the flexibility bonus: `melee`, `gun`, `execution`, `door` (execution with door
bonus), `thrown`.

- **Combo:** a kill within 2.5 s of the previous kill increases the multiplier (×2 … ×8 max).
  When the window expires, the chain's bonus = sum of chain kill points × (multiplier − 1),
  added to the score.
- **End bonuses:**
  - Flexibility: 200 × number of distinct kill types used.
  - Time: `max(0, 3000 − 20 × seconds)`.
  - Boldness: 300 per melee/execution kill on an enemy holding a gun.
- **Grade:** total / level `targetScore`: ≥100% A+, ≥85% A, ≥70% B, ≥55% C, ≥40% D, else F.
- Results screen shows each component, total, grade, and newly unlocked items.

## 6. Masks

| Id | Name | Perk | Unlock |
|---|---|---|---|
| lajkonik | Lajkonik | none | start |
| bolek | Bolek | start with a knife | finish level 1 |
| lolek | Lolek | door knockdowns last 5 s | grade B or better on level 1 |
| czapka | Czapka milicjanta | survive the first hit, once per attempt | finish level 2 |
| kleks | Pan Kleks | +20% move speed | grade A or better on any level |

Mask is chosen per attempt on MASK_SELECT and persists across restarts of that level.

## 7. Levels

### Format (`js/levels/<id>.js`)
```js
HW.levels.blok = {
  id: 'blok', title: 'POZIOM 1: BLOK', subtitle: 'Praga, 1986',
  phoneCall: ['Dzień dobry...', '...'],
  targetScore: 9000,
  music: { root: 'A', progression: [0, 5, 3, 4] },
  floors: [{
    map: [ '########', '#P..D..#', ... ],   // ASCII, 16 px tiles
    enemies: [{ type: 'dresiarz', weapon: 'pipe', at: [5, 3],
                patrol: [[5,3],[9,3]] | null, facing: 0 }],
    items:   [{ weapon: 'pistol', at: [7, 8] }],
    neon:    [{ text: 'BAR MLECZNY', color: 'cyan', at: [2, 0] }],
    stairs:  [{ at: [12, 4], to: { floor: 1, at: [12, 4] } }]
  }]
};
```
Tiles: `#` wall, `.` floor, `~` carpet (floor), `w` window (blocks movement, not bullets or
sight), `D` door (hinge on the left/top wall neighbour), `P` player start + car, `S` stairs.
Enemy positions are given in the `enemies` list, not in the map.

Floors: enemies and items belong to their floor; changing floor is a camera cut with a short
fade. All enemies across all floors must be dead to clear the level.

### Validation (`levels/validate.js`)
Checks, returning a list of human-readable errors:
- every floor's map is rectangular and non-empty; only known tile characters;
- exactly one `P` across the level (on floor 0);
- each `D` has walls on exactly one opposing pair of neighbours;
- every enemy, item, patrol point and stair target is on a walkable tile of an existing floor;
- every enemy weapon and item weapon id exists; every enemy type exists;
- `targetScore > 0`.
On error the game shows the errors on screen instead of starting the level.

### Content
| Level | Setting | Enemies | Signature |
|---|---|---|---|
| 1 Blok | Wielka płyta block, Praga: corridors, small flats, stairwell; 2 floors | ~9, mostly Dresiarz | BAR MLECZNY neon outside |
| 2 Pewex | Shop floor with shelving, back room, office; 1–2 floors | ~11, mostly Bandzior | magenta PEWEX sign |
| 3 Komenda | Milicja station: cells, interrogation, armoury; 2 floors | ~14, Milicjant + Bandzior | flickering MO signs |

## 8. Presentation

### Graphics
- Palette (`gfx/palette.js`): concrete greys, beige/brown linoleum, mustard tile, blood red;
  neon magenta `#ff2e88`, cyan `#22e6ff`, orange `#ff8a1e`.
- Sprites generated at load into offscreen canvases: 12×12 characters, 8 facings (rendered by
  rotation of a top-down base), 2-frame walk, attack frame; mask head overlays; weapon floor
  sprites; corpses; furniture/shelving tiles.
- Effects: persistent blood decal canvas, muzzle flash, screen shake, 40 ms hit-stop on kills,
  slow magenta/cyan full-screen tint pulse, additive neon glow with random flicker.
- 5×7 bitmap font defined in code (`gfx/font.js`), covering A–Z, Polish diacritics
  (ĄĆĘŁŃÓŚŹŻ), digits and punctuation.
- Custom crosshair cursor; title screen with VHS scanlines.

### Audio (Web Audio API)
- Music: procedural synthwave ~110 BPM — saw bass arpeggio, pad chords, noise snare, sine kick;
  per-level root and progression; low-pass muffle on RESULTS.
- SFX: gunshot (filtered noise burst), melee thump, door slam, death pitch-drop, phone ring.
- Audio context created on the first click ("KLIKNIJ ABY ZACZĄĆ"). M toggles mute.
- If Web Audio is unavailable, all audio calls are no-ops.

### UI flow
TITLE → LEVEL_SELECT (unlocked only) → PHONE_CALL (typewriter text) → MASK_SELECT → PLAYING →
RESULTS → LEVEL_SELECT. HUD: weapon name + ammo, score, combo multiplier/timer.

## 9. Error handling
- Level validation errors are displayed on screen (see 7).
- `loop.js` wraps update/render in try/catch; on error it stops simulating, logs, and shows
  "ERROR — press R"; R reloads the level.
- `save.js` wraps every localStorage access in try/catch; corrupt or missing data → defaults
  `{ unlockedLevels: ['blok'], unlockedMasks: ['lajkonik'], bestScores: {} }`.
- Audio unavailable → silent no-ops.
- Simulation step clamp: max 5 steps per frame.

## 10. Testing
- `node --test test/` with Node's built-in runner; no npm dependencies.
- `test/helpers/load.js` reads `index.html`, extracts the ordered `<script src>` list, and
  evaluates the pure-logic files into a fresh `HW` in a `vm` context. A test asserts every
  `js/**/*.js` file is referenced by `index.html`.
- Unit coverage: math/geometry (arcs, circle-vs-tile collision, raycast), A*, AI transitions
  (sees player, hears shot, search timeout → patrol), combat (melee arc, knockdown, execution),
  doors (knockdown on swing), scoring (combo windows, bonuses, grade thresholds), masks, save
  defaults, level validation for all three shipped levels.
- Simulation tests: scripted input over N fixed steps on small test maps (e.g. door swung into
  enemy → enemy DOWNED; gunshot → distant enemy INVESTIGATE).
- Manual checklist before each gameplay push: feel, each level beatable, restart < 100 ms,
  audio, file:// and Pages both work.

## 11. Delivery
- Repo `MaciejSulewski/hotline-warsaw`, public, MIT licence, README with controls, screenshot,
  play link.
- GitHub Pages from `main` branch root (no Actions needed); enabled once level 1 is playable.
- Push after each completed plan task, using the personal token.
