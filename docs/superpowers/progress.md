# SDD ledger — plan: docs/superpowers/plans/2026-10-20-hotline-warsaw.md

Spec: docs/superpowers/specs/2026-10-20-hotline-warsaw-design.md (binding authority)
Mirror: this ledger is copied to docs/superpowers/progress.md and committed after every task so work can resume on another machine.

## Setup rulings
- Ruling: work directly on `main` (no worktree/feature branch) — user approved the plan, which pushes to the repo after each task and serves GitHub Pages from `main`; solo repo with only docs so far — cost if wrong: history on main contains WIP commits; trivially reorganizable later.
- Ruling: ledger mirrored to committed `docs/superpowers/progress.md` and resume instructions put in committed `CLAUDE.md` — user asked that everything needed to continue with Claude on another machine live in the repo; the skill's workspace is git-ignored — cost if wrong: a little doc noise in git.

## Pre-flight scan
| Tasks | Shared file / interface | Finding |
|---|---|---|
| T1 ↔ all | `index.html` script order; `test/scaffold.test.js` requires every js file listed | consistent — every task must add its own tags (T16/T17 say so explicitly; others implied by the scaffold test) |
| T4 ↔ T5,T7,T8 | `HW.weapons` (arc/range/cooldown/throwLethal), `HW.enemyTypes.reaction`, `enemy.js` | T5 modifies enemy.js to add `HW.enemy.create` — consistent after plan fix |
| T5 ↔ T6 | `door.js` create/segment → push/update | consistent |
| T5 ↔ T6–T9 | `sim.js` step order | consistent (order fixed in T5) |
| T5 ↔ T9 | `world.score: ScoreState` but `HW.scoring.create` only exists in T9 | conflict → Ruling R1 |
| T5/T7 ↔ T8 | enemies call `combat.attack`, which needs `cooldown` on the attacker; T5 enemy shape lacks it | gap → Ruling R2 |
| T6 ↔ T7 ↔ T8 ↔ T9 | `combat.knockdown/attack/kill` → `scoring.onKill` | T7 guards for absent scoring; consistent with R1 |
| T5 ↔ T10 ↔ T11 ↔ T14 | `HW.masks` table → `unlocksAfter` → `save.recordResult` → flow | consistent |
| T9 ↔ T14 | `scoring.finish` lines → results screen | consistent |
| T12 ↔ T13,T14 | `main.js` | consistent (each modifies) |
| T12 ↔ T15 | `levels/blok.js` draft replaced | consistent |
| T15 ↔ T16,T17 | `test/levels.test.js` skips undefined levels | consistent |
| Spec ↔ plan | wrapper `globalThis.HW` vs spec's `typeof HW` form; no `corpse.js` | equivalent / explicitly ruled in plan |

| Task | Self-consistency |
|---|---|
| T1 | tests vs files consistent |
| T2 | consistent |
| T3 | consistent |
| T4 | consistent (fixtures helper defined here, used from T5) |
| T5 | determinism test uses `strip()` helper not defined — implementer defines it in the test; `score` → R1; enemy cooldown → R2 |
| T6 | consistent |
| T7 | consistent; `click` event now in event list |
| T8 | consistent with R2 |
| T9 | consistent with R1 |
| T10–T11 | consistent |
| T12 | consistent; manual check needs user (no browser on VM) |
| T13–T17 | consistent |

- Ruling R1: T5 sets `world.score = HW.scoring ? HW.scoring.create() : null`; T9 makes it always present — spec says the world holds score state; T5 precedes scoring — cost if wrong: one-line change.
- Ruling R2: characters (player and enemies) carry `cooldown: 0` from creation (T5), and `combat.attack` decrements/uses it — needed by T7/T8 — cost if wrong: trivial.

## Tasks
- Ruling: implementers commit only; controller pushes after each task review — keeps the token-sensitive push in one place and only reviewed work reaches GitHub — cost if wrong: none.
- Ruling R3: canonical test command is `node --test "test/**/*.test.js"` (Node 24 rejects `node --test test/`); `test/index.js` aggregator removed — a shim that double-runs under bare `node --test` is worse than a glob — cost if wrong: none (docs updated: plan, CLAUDE.md).
- Ruling R4: subagent commits use the Co-Authored-By trailer their own harness specifies — honest attribution — cost if wrong: cosmetic.
Task 1: minor (deferred): angleDiff large-angle test only bounds result; inArc edge/norm nonzero untested; scaffold test doesn't check duplicate/missing script tags; rng.pick([]) unguarded
Task 1: complete (commits 01d19cc..b5c021a, review clean)
Task 2: minor (deferred): world.test 'window blocks movement' first assertion is a no-op; coverage gaps (negative/diagonal cast, start-in-wall, seg-vs-tile nearest, door-escape path, y-axis stop); stale comment collision.js:35; per-substep closure in moveCircle; overlapping circle can't slide tangentially; collinear ray along segment not blocked (comment); RED run after implementation
Task 2: complete (commits bd07f77..d4ed09f, review clean)
Task 3: fix round 1/5 (3 addressed, 0 open — heap key mutation → suboptimal paths; OOB start; goal bounds order; commits 2eed9d1..500e2b5)
Task 3: minor (deferred): out-of-bounds start equal to goal returns [] not null; optimality fuzz takes ~1.3 s of suite time
Task 3: complete (commits 18e8769..500e2b5, review clean)
- Ruling R5 (Task 4 dispatch): weapon table field conventions (radians, guns range=null, melee ammo=null, throwLethal only knife), door rule = walls left+right XOR top+bottom, enemy weapon optional (type default later), stair `at` must be `S` — plan said "spec §7 checks" without these specifics — cost if wrong: small edits to validate.js/weapon.js.
- Ruling R6: fists cooldown 0.3 s (spec silent) — cost if wrong: tuning.
Task 4: minor (deferred): stair test asserts only error count; horizontal (left+right walled) door never asserted valid, edge door untested; weapon table test covers subset of fields; weapon:null reported as unknown; empty-map case untested; validate(null) throws (controller confirmed suite 41/41)
Task 4: complete (commits b562010..0006afa, review clean)
- Ruling R7 (Task 5 dispatch): door hinge at tile's left-edge midpoint (horizontal, closedAngle 0) or top-edge midpoint (vertical, π/2); enemy default weapons dresiarz→pipe, bandzior→pistol, milicjant→ak; world.load must not mutate level data — plan left these open — cost if wrong: small geometry/data tweak.
Task 5: minor (deferred): ambiguous door orientation untested (validator rejects); unknown maskId silently no perk; explicit weapon:null throws in enemy.create (validator rejects); diagonal test asserts velocity only; report's rows.slice claim doesn't match diff
- Ruling R8: world.noises cleared at START of sim.step (not end as shared-shapes says) — lets the player's shot in step N reach AI in step N; consequence: enemy gunshots emitted after the AI pass are not heard by other enemies — acceptable since shooters are already engaged — cost if wrong: move the clear and adjust one test.
Task 5: complete (commits 75da4bb..1019e65, review clean)
