(function (HW) {
  'use strict';

  const T = HW.tilemap;

  // Hinge on the left edge midpoint (horizontal door, walls left+right) or the top
  // edge midpoint (vertical door, walls top+bottom).
  function create(tx, ty, map) {
    const solid = (x, y) => T.isSolid(T.get(map, x, y));
    const horizontal = !(solid(tx, ty - 1) && solid(tx, ty + 1) && !(solid(tx - 1, ty) && solid(tx + 1, ty)));
    const closedAngle = horizontal ? 0 : Math.PI / 2;
    return {
      hx: horizontal ? tx * T.TILE : tx * T.TILE + T.TILE / 2,
      hy: horizontal ? ty * T.TILE + T.TILE / 2 : ty * T.TILE,
      angle: closedAngle, closedAngle, av: 0, len: T.TILE,
    };
  }

  function segment(d) {
    return { x0: d.hx, y0: d.hy, x1: d.hx + d.len * Math.cos(d.angle), y1: d.hy + d.len * Math.sin(d.angle) };
  }

  HW.door = { create, segment };
})(globalThis.HW);
