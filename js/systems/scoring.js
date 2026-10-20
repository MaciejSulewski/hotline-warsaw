(function (HW) {
  'use strict';

  const WINDOW = 2.5;
  const MAX_MULT = 8;
  const BASE = { melee: 400, gun: 300, execution: 600, thrown: 500 };
  const DOOR_BONUS = 500;
  const BOLD_BONUS = 300;
  const GRADES = [[1.0, 'A+'], [0.85, 'A'], [0.7, 'B'], [0.55, 'C'], [0.4, 'D']];

  function create() {
    return { kills: 0, combo: 0, bold: 0, chain: [], multiplier: 1, lastKillT: -Infinity, kinds: [] };
  }

  function bank(state) {
    if (state.chain.length === 0) return;
    const sum = state.chain.reduce((a, b) => a + b, 0);
    state.combo += sum * (state.multiplier - 1);
    state.chain = [];
    state.multiplier = 1;
  }

  function onKill(state, time, cause, info) {
    const door = !!(info && info.door);
    const hadGun = !!(info && info.victimHadGun);
    if (state.chain.length > 0 && time - state.lastKillT > WINDOW) bank(state);
    const kind = door ? 'door' : cause;
    let pts = BASE[cause] || 0;
    if (door) pts += DOOR_BONUS;
    if (cause === 'execution' && door) pts = BASE.execution + DOOR_BONUS;
    state.kills += pts;
    if (state.kinds.indexOf(kind) === -1) state.kinds.push(kind);
    if (hadGun && (cause === 'melee' || cause === 'execution' || door)) state.bold += BOLD_BONUS;
    if (state.chain.length > 0) state.multiplier = Math.min(MAX_MULT, state.multiplier + 1);
    state.chain.push(pts);
    state.lastKillT = time;
  }

  function tick(state, time) {
    if (state.chain.length > 0 && time - state.lastKillT > WINDOW) bank(state);
  }

  function grade(ratio) {
    for (const [min, g] of GRADES) if (ratio >= min) return g;
    return 'F';
  }

  function finish(state, seconds, targetScore) {
    bank(state);
    const lines = [
      { label: 'ZABÓJSTWA', points: state.kills },
      { label: 'COMBO', points: state.combo },
      { label: 'ELASTYCZNOŚĆ', points: 200 * state.kinds.length },
      { label: 'CZAS', points: Math.max(0, 3000 - 20 * seconds) },
      { label: 'ODWAGA', points: state.bold },
    ];
    const total = lines.reduce((a, l) => a + l.points, 0);
    return { lines, total, grade: grade(total / targetScore) };
  }

  HW.scoring = { WINDOW, create, onKill, tick, finish, grade };
})(globalThis.HW);
