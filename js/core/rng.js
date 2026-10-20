(function (HW) {
  'use strict';

  // mulberry32
  function create(seed) {
    let s = seed >>> 0;
    function next() {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    function range(a, b) { return a + (b - a) * next(); }
    function pick(arr) { return arr[Math.floor(next() * arr.length)]; }
    return { next, range, pick };
  }

  HW.rng = { create };
})(globalThis.HW);
