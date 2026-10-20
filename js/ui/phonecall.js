(function (HW) {
  'use strict';

  const CPS = 40; // typewriter speed, characters per second

  const total = (pc) => pc.lines.reduce((n, l) => n + l.length, 0);

  // Pure typewriter over a list of lines; `shown` counts characters across all lines.
  function create(lines) {
    return { lines: lines.slice(), shown: 0, done: total({ lines }) === 0 };
  }

  function update(pc, dt) {
    const n = total(pc);
    pc.shown = Math.min(n, pc.shown + CPS * dt);
    pc.done = pc.shown >= n;
  }

  function skip(pc) {
    pc.shown = total(pc);
    pc.done = true;
  }

  // The visible prefix of each line.
  function visible(pc) {
    let left = Math.floor(pc.shown);
    return pc.lines.map((l) => {
      const s = l.slice(0, Math.max(0, left));
      left -= l.length;
      return s;
    });
  }

  HW.phonecall = { CPS, create, update, skip, visible };
})(globalThis.HW);
