(function (HW) {
  'use strict';

  function emptyInput() {
    return {
      move: { x: 0, y: 0 }, aim: { x: 0, y: 0 },
      fire: false, firePressed: false, throwPressed: false, executePressed: false, look: false,
    };
  }

  function step(world, input, dt) {
    world.noises.length = 0;
    world.time += dt;
    HW.player.update(world, input, dt);
  }

  HW.sim = { step, emptyInput };
})(globalThis.HW);
