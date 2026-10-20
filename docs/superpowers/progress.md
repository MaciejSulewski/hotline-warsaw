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
- Ruling R9 (Task 6 dispatch): door push is non-cumulative (av set to max(|av|, |vn|/16*1.2) with swing-away sign), contact at r+1, doors not blocked by characters, 'door' event on crossing |av|>4 — plan's additive formula would make slow walking slam doors after a few frames, contradicting its own 'slow nudge no knockdown' test — cost if wrong: door feel tuning.
Task 6: minor (deferred): no test pins door swing DIRECTION (sign inversion undetected); no tests for dead/already-downed/other-floor enemies in slam; moving-away guard and vn=0/cross=0 branches unpinned; sim.js player-alive check could fold into filter
Task 6: complete (commits 790524e..215a8fd, review clean; implementer deviations accepted: push ignores retreating characters; player door test shortened)
- Ruling R10 (Task 7 dispatch): combat details the plan left open — cooldowns decremented in sim; melee/non-auto on firePressed, auto on held fire; friendly-fire melee; downed characters can be shot; bullet life 1.5 s; thrown item hit radius r+3 and wall hit resets to pre-step position; execution pins target.downedT ≥ 0.7; kill() payload/corpse/drop shapes; victimHadGun = held gun at death — cost if wrong: localized tweaks in combat/projectile.
- Ruling R11: Task 7 choices accepted — thrown update lives in combat.updateThrown; non-lethal hits on player do nothing (no player stun); execution cancelled if target dies first; downedT countdown deferred to Task 8 (must be carried into Task 8 dispatch) — cost if wrong: small.
- Ruling R12: czapka shield break grants 0.5 s invulnerability (player.invulnT) so a single shotgun blast can't break-and-kill in one step — spec says 'survive the first hit'; a blast is one hit — cost if wrong: tuning.
Task 7: fix round 1/5 (3 addressed, 0 open — shield vs shotgun multi-hit; thrown re-knock of downed enemy; kill alive guard; commits 03e137d..97c0fe2)
Task 7: minor (deferred): player.js computes facing twice; most projectile/thrown tests bypass sim.step (no end-to-end shot via sim); no test that enemy cooldown ticks in sim; 554a598 committed with 2 failing tests (fixed in 97c0fe2)
Task 7: complete (commits df7684a..97c0fe2, review clean; controller confirmed suite green)
- Ruling R13 (Task 8 dispatch): AI details — sim order player → AI → doors → projectiles → thrown; downedT countdown in AI; alert = stand + face player until reactT; attacks only in chase; straight-line chase when visible, A* otherwise; return-to-home state after search; investigate → search at the noise spot; empty-gun enemies just click — cost if wrong: AI tuning.
- Ruling R14: an enemy whose gun is empty drops it (ammo 0) and fights with fists — spec silent; endless clicking at 90 px is a dead end for gameplay — cost if wrong: small AI tweak.
- Ruling R15: unarmed (fists) enemies cannot hurt the player — consistent with fists being non-lethal and no player stun; disarmed enemies become a harmless chaser, which is fine for gameplay — cost if wrong: one rule in combat.attack.
Task 8: fix round 1/5 (6 addressed, 0 open — unreachable goal stuck; stale path; arrived init; door segs once; ambiguous tests + melee range test; empty gun → fists; commits e418593..30998a0)
- Ruling R16: visible-but-unreachable player (e.g. behind window bars in level 3) keeps the enemy in chase, holding position and attacking — re-review flagged an alert/chase/search flicker; level 3 depends on it — cost if wrong: small AI tweak.
Task 8: fix round 2/5 (1 addressed, 0 open — visible-but-unreachable chase loop; wideClear now treats solid tiles incl. windows as blocking; commits 30998a0..966f0fa)
Task 8: minor (deferred): re-sighting in search/return/investigate pays full reaction delay; no tests for gun standoff at 90 px, aim spread, hearing ignored while seeing; return-to-patrol test doesn't exercise stationary return; sealed-pocket test's chase half is trivial
Task 8: complete (commits c816bd3..966f0fa, review clean; controller confirmed suite green)
- Ruling R17 (Task 9 dispatch): door-execution counts as kind 'door' only; boldness on melee/execution/door kills of gun holders; score buckets kills/combo/bold; kinds stored JSON-serialisable; sim frozen on 'won', continues on 'dead'; stairs via stairLock until player leaves S tile — cost if wrong: scoring tweaks.
Task 9: minor (deferred): zero-enemy level never clears (fixture convenience, undocumented); lastKillT -Infinity → null after JSON; redundant door line in onKill and non-execution kills with door:true become kind door; no tests for dead blocking cleared/won, thrown 500; stairs data read from world.level each step
- Ruling R18: accepted Task 9 deviations — zero-enemy levels never clear; combat scoring-hook test stubs onKill — cost if wrong: trivial.
Task 9: complete (commits 603d95c..9beb566, review clean)
