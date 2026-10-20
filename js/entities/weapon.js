(function (HW) {
  'use strict';

  const deg = HW.math.deg;

  function melee(id, name, lethal, arcDeg, range, cooldown, extra) {
    return Object.assign({
      id, name, kind: 'melee', lethal, arc: deg(arcDeg), range, cooldown,
      ammo: null, pellets: 1, spread: 0, noise: 0, auto: false, throwLethal: false,
    }, extra);
  }
  function gun(id, name, cooldown, ammo, noise, extra) {
    return Object.assign({
      id, name, kind: 'gun', lethal: true, arc: 0, range: null, cooldown,
      ammo, pellets: 1, spread: 0, noise, auto: false, throwLethal: false,
    }, extra);
  }

  HW.weapons = {
    fists: melee('fists', 'Pięści', false, 90, 14, 0.3),
    pipe: melee('pipe', 'Rura', true, 120, 18, 0.35),
    bat: melee('bat', 'Kij', true, 120, 20, 0.4),
    knife: melee('knife', 'Nóż', true, 60, 14, 0.2, { throwLethal: true }),
    pistol: gun('pistol', 'Pistolet P-64', 0.25, 8, 250),
    shotgun: gun('shotgun', 'Dubeltówka', 0.6, 2, 300, { pellets: 6, spread: deg(12) }),
    ak: gun('ak', 'Kałach', 0.1, 30, 300, { auto: true, spread: deg(3) }),
  };
})(globalThis.HW);
