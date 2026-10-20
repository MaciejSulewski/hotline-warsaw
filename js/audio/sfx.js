(function (HW) {
  'use strict';

  const EVENT_SOUND = {
    shot: 'shot', swing: 'swing', melee: 'melee', knockdown: 'melee', door: 'door',
    death: 'death', kill: 'kill', pickup: 'pickup', click: 'click',
  };

  // Each sound: (S, t) schedules its nodes starting at time t.
  const SOUNDS = {
    shot(S, t) { S.burst('bandpass', 4000, 600, t, 0.18, 0.9); S.tone('square', 180, 50, t, 0.1, 0.3); },
    shotgun(S, t) { S.burst('lowpass', 5000, 300, t, 0.35, 1); S.tone('sawtooth', 120, 35, t, 0.2, 0.4); },
    melee(S, t) { S.tone('sine', 140, 40, t, 0.15, 0.9); S.burst('lowpass', 1200, 200, t, 0.08, 0.5); },
    swing(S, t) { S.burst('bandpass', 600, 2500, t, 0.12, 0.3); },
    door(S, t) { S.tone('sine', 90, 35, t, 0.25, 0.9); S.burst('lowpass', 900, 150, t, 0.2, 0.7); },
    death(S, t) { S.tone('sawtooth', 400, 40, t, 0.5, 0.45); },
    kill(S, t) { S.tone('triangle', 520, 780, t, 0.08, 0.3); },
    pickup(S, t) { S.tone('square', 660, 660, t, 0.07, 0.2); S.tone('square', 990, 990, t + 0.07, 0.1, 0.2); },
    click(S, t) { S.burst('highpass', 3000, 3000, t, 0.03, 0.4); },
    ring(S, t) { // two-burst phone ring
      for (const dt of [0, 0.2]) {
        S.tone('square', 1400, 1400, t + dt, 0.15, 0.15);
        S.tone('square', 1100, 1100, t + dt, 0.15, 0.15);
      }
    },
  };

  function play(name) {
    const S = HW.synth, ac = S.ctx(), fn = SOUNDS[name];
    if (!ac || !fn) return;
    try { fn(S, ac.currentTime); } catch (e) { /* audio must never break the game */ }
  }

  function onEvents(events) {
    for (const e of events) {
      const name = e.type === 'shot' && e.weapon === 'shotgun' ? 'shotgun' : EVENT_SOUND[e.type];
      if (name) HW.sfx.play(name);
    }
  }

  HW.sfx = { play, onEvents };
})(globalThis.HW);
