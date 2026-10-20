(function (HW) {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function len(x, y) { return Math.sqrt(x * x + y * y); }
  function norm(x, y) {
    const l = len(x, y);
    return l === 0 ? { x: 0, y: 0 } : { x: x / l, y: y / l };
  }
  function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
  function angleDiff(a, b) {
    const TAU = Math.PI * 2;
    let d = (a - b) % TAU;
    if (d > Math.PI) d -= TAU;
    else if (d < -Math.PI) d += TAU;
    return d;
  }
  function inArc(ox, oy, facing, arc, range, tx, ty) {
    const dx = tx - ox, dy = ty - oy;
    if (dx * dx + dy * dy > range * range) return false;
    if (dx === 0 && dy === 0) return true;
    return Math.abs(angleDiff(facing, Math.atan2(dy, dx))) <= arc / 2;
  }
  function approach(cur, target, maxDelta) {
    if (cur < target) return Math.min(cur + maxDelta, target);
    return Math.max(cur - maxDelta, target);
  }
  function deg(d) { return d * Math.PI / 180; }

  HW.math = { clamp, lerp, len, norm, angleTo, angleDiff, inArc, approach, deg };
})(globalThis.HW);
