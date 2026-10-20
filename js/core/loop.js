(function (HW) {
  'use strict';

  const DT = 1 / 60;

  // Pure accumulator: how many fixed steps to run for this frame.
  function stepsFor(acc, frameDt, dt = DT, max = 5) {
    acc += frameDt;
    const steps = Math.floor(acc / dt + 1e-9);
    if (steps > max) return { steps: max, acc: 0 };
    return { steps, acc: Math.max(0, acc - steps * dt) };
  }

  // requestAnimationFrame driver. update(dt) runs per fixed step, render(alpha) once per frame;
  // both are wrapped so an exception reaches onError instead of killing the loop.
  function start(update, render, onError) {
    const report = onError || ((err) => console.error(err));
    let acc = 0, last = null, running = true;
    function frame(now) {
      if (!running) return;
      const frameDt = last === null ? 0 : Math.max(0, (now - last) / 1000);
      last = now;
      const r = stepsFor(acc, frameDt);
      acc = r.acc;
      try { for (let i = 0; i < r.steps; i++) update(DT); } catch (err) { report(err); }
      try { render(acc / DT); } catch (err) { report(err); }
      globalThis.requestAnimationFrame(frame);
    }
    globalThis.requestAnimationFrame(frame);
    return { stop() { running = false; } };
  }

  HW.loop = { DT, stepsFor, start };
})(globalThis.HW);
