# Hotline Warsaw

Hotline Miami-style top-down shooter set in PRL-era Warsaw. Plain HTML5 canvas + Web Audio,
no build step, no dependencies. Play by opening `index.html` or at
https://maciejsulewski.github.io/hotline-warsaw/ (once Pages is enabled).

## Key documents
- Spec (binding): `docs/superpowers/specs/2026-10-20-hotline-warsaw-design.md`
- Plan: `docs/superpowers/plans/2026-10-20-hotline-warsaw.md`
- Progress ledger (which plan tasks are done, rulings made): `docs/superpowers/progress.md`

## Commands
- Tests: `node --test "test/**/*.test.js"` (Node ≥ 22 for glob support; uses only built-ins)
- Run: open `index.html` in Chrome/Firefox (works from `file://`)

## Conventions
- No ES modules. Every file: `(function (HW) { 'use strict'; ... })(globalThis.HW);`, assigning into a sub-namespace (`HW.math`, `HW.ai`, …).
- Every script must load in Node without a DOM: touch `window`/`document`/`AudioContext`/`localStorage` only inside functions.
- New `js/` files must be added to `index.html` in dependency order (`test/scaffold.test.js` enforces it).
- Logic (`core/math`, `core/rng`, `world/`, `entities/`, `systems/`, `levels/`, `save.js`) stays pure and tested; presentation (`gfx/`, `audio/`, `ui/`, `core/input.js`, `core/loop.js`, `main.js`) reads world state and drains `world.events`.
- Simulation randomness only via `world.rng`.
- In-game text is Polish.

## Workflow
Developed with the superpowers plugin (brainstorming → writing-plans → subagent-driven-development).
To resume on any machine:
1. Install the superpowers plugin in Claude Code.
2. Read `docs/superpowers/progress.md`; tasks with `Task N: complete` are done — do not redo them.
3. Continue with `superpowers:subagent-driven-development` on the plan from the first incomplete task,
   copying `docs/superpowers/progress.md` into the skill's workspace ledger first.
4. After each task: update `docs/superpowers/progress.md`, commit, push.

## GitHub
- Repo: `MaciejSulewski/hotline-warsaw` (public). Push to `main` after each completed task.
- Always publish as **MaciejSulewski** — never as a training/course account (e.g. `MaciejSulewskiSzkolenie`).
  Verify with `gh api user --jq .login` before pushing. On the original VM the ambient `GH_TOKEN`
  is the training account, so commands there are run as `GH_TOKEN=$(cat ~/.gh_token_personal) git push`.
- Commit identity: `Maciej Sulewski <233638465+MaciejSulewski@users.noreply.github.com>`.
