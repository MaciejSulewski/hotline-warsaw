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
