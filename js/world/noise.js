(function (HW) {
  'use strict';

  function emit(world, x, y, radius) {
    if (!radius) return;
    world.noises.push({ x, y, radius });
  }

  HW.noise = { emit };
})(globalThis.HW);
