(function (HW) {
  'use strict';

  const T = HW.tilemap;

  // Parametric distance (0..1) along ray to segment, or Infinity.
  function raySeg(x0, y0, dx, dy, s) {
    const ex = s.x1 - s.x0, ey = s.y1 - s.y0;
    const den = dx * ey - dy * ex;
    if (den === 0) return Infinity;
    const qx = s.x0 - x0, qy = s.y0 - y0;
    const t = (qx * ey - qy * ex) / den;
    const u = (qx * dy - qy * dx) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : Infinity;
  }

  function tileHit(map, x0, y0, dx, dy, blocks) {
    let tx = T.toTile(x0), ty = T.toTile(y0);
    if (blocks(T.get(map, tx, ty))) return 0;
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
    const tdx = dx === 0 ? Infinity : Math.abs(T.TILE / dx);
    const tdy = dy === 0 ? Infinity : Math.abs(T.TILE / dy);
    let tmx = dx === 0 ? Infinity : ((dx > 0 ? tx + 1 : tx) * T.TILE - x0) / dx;
    let tmy = dy === 0 ? Infinity : ((dy > 0 ? ty + 1 : ty) * T.TILE - y0) / dy;
    for (;;) {
      let t;
      if (tmx < tmy) { t = tmx; tx += sx; tmx += tdx; }
      else { t = tmy; ty += sy; tmy += tdy; }
      if (t > 1) return Infinity;
      if (blocks(T.get(map, tx, ty))) return t;
    }
  }

  function cast(map, segments, x0, y0, x1, y1, mode) {
    const dx = x1 - x0, dy = y1 - y0;
    const blocks = mode === 'sight' ? T.blocksSight : T.blocksBullets;
    let best = (dx === 0 && dy === 0)
      ? (blocks(T.get(map, T.toTile(x0), T.toTile(y0))) ? 0 : Infinity)
      : tileHit(map, x0, y0, dx, dy, blocks);
    let segIndex = -1;
    for (let i = 0; i < segments.length; i++) {
      const t = raySeg(x0, y0, dx, dy, segments[i]);
      if (t < best) { best = t; segIndex = i; }
    }
    if (best === Infinity) return { hit: false, x: x1, y: y1, t: 1, segIndex: -1 };
    return { hit: true, x: x0 + dx * best, y: y0 + dy * best, t: best, segIndex };
  }

  function clear(map, segments, x0, y0, x1, y1, mode) {
    return !cast(map, segments, x0, y0, x1, y1, mode).hit;
  }

  HW.raycast = { cast, clear };
})(globalThis.HW);
