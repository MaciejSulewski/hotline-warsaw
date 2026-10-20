(function (HW) {
  'use strict';

  // PRL concrete, linoleum and tile tones; neon accents per spec §8.
  HW.palette = {
    black: '#0b0a10', white: '#f4efe6', ink: '#16141c',
    concrete: '#76767c', concreteLight: '#9a9aa0', concreteDark: '#4b4b53', wallEdge: '#2a2a31',
    linoleum: '#c2a878', linoleumBrown: '#8c6a46', mustard: '#c9a227', carpet: '#7a2a34', carpetLight: '#a8484c',
    glass: '#24485a', glassLight: '#5fa3b8', frame: '#8a8a90',
    door: '#7a4a22', doorLight: '#a8683a',
    blood: '#a3121e', bloodDark: '#5c0810',
    skin: '#e3b48e', skinDark: '#b5876a', shoe: '#1d1a18',
    bullet: '#ffe45c', flash: '#fff3b0',
    magenta: '#ff2e88', cyan: '#22e6ff', orange: '#ff8a1e',
    chars: {
      player: { body: '#7a1e2c', trim: '#efe3c8', head: '#e3b48e' },
      dresiarz: { body: '#2546c4', trim: '#f4efe6', head: '#d9ab86' },
      bandzior: { body: '#2b221c', trim: '#57463a', head: '#3a2a20' },
      milicjant: { body: '#5d6b78', trim: '#3a434c', head: '#4a5866' },
    },
    floor: {
      blok: { base: '#b89e70', alt: '#b09566', line: '#937a55' },
      pewex: { base: '#d8d2c4', alt: '#9e9a92', line: '#7c786f' },
      komenda: { base: '#c9a227', alt: '#b48f1f', line: '#7e6618' },
    },
  };
})(globalThis.HW);
