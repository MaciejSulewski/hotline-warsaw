(function (HW) {
  'use strict';

  const BPM = 110, STEP = 60 / BPM / 4; // 16th note
  const NOTES = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  const MINOR = [0, 3, 7, 12];
  const TICK_MS = 25, HORIZON = 0.1;

  let timer = null, bus = null, filter = null, level = null, step = 0, next = 0, muffled = false;

  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  function scheduleStep(S, i, t) {
    const bar = Math.floor(i / 16) % level.progression.length, s = i % 16;
    const root = 33 + (NOTES[level.root] || 0) + level.progression[bar]; // bass octave around A1..
    if (s % 2 === 0) {
      const f = hz(root + MINOR[(s / 2) % 4]);
      S.tone('sawtooth', f, f, t, STEP * 1.8, 0.16, bus);
    }
    if (s === 0) for (const iv of MINOR.slice(0, 3)) S.tone('triangle', hz(root + 24 + iv), hz(root + 24 + iv), t, STEP * 15, 0.05, bus);
    if (s === 0 || s === 8) S.tone('sine', 120, 40, t, 0.18, 0.7, bus);
    if (s === 4 || s === 12) S.burst('highpass', 1800, 1800, t, 0.14, 0.35, bus);
  }

  function tick() {
    const S = HW.synth, ac = S.ctx();
    if (!ac || !level) return;
    if (next < ac.currentTime) next = ac.currentTime + 0.05;
    while (next < ac.currentTime + HORIZON) {
      scheduleStep(S, step++, next);
      next += STEP;
    }
  }

  function start(lv) {
    const S = HW.synth, ac = S.ctx();
    if (!ac) return;
    level = lv;
    if (timer !== null) return; // already running: just swap the level
    filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = muffled ? 600 : 18000;
    bus = ac.createGain();
    bus.gain.value = 0.5;
    bus.connect(filter); filter.connect(S.master());
    step = 0; next = 0;
    timer = setInterval(tick, TICK_MS);
  }

  function stop() {
    if (timer !== null) clearInterval(timer);
    timer = null; level = null;
    // Cut the old bus (and the pads still ringing on it) off from the master.
    for (const n of [bus, filter]) { try { if (n) n.disconnect(); } catch (e) { /* already gone */ } }
    bus = null; filter = null;
  }

  function muffle(on) {
    muffled = !!on;
    if (filter) filter.frequency.value = muffled ? 600 : 18000;
  }

  HW.music = { start, stop, muffle };
})(globalThis.HW);
