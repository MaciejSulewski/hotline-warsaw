(function (HW) {
  'use strict';

  function knockdown(world, enemy, seconds, source) {
    enemy.state = 'downed';
    enemy.downedT = seconds;
    enemy.downedBy = source;
    world.events.push({ type: 'knockdown', x: enemy.x, y: enemy.y, source });
  }

  HW.combat = { knockdown };
})(globalThis.HW);
