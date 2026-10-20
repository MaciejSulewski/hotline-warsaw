(function (HW) {
  'use strict';

  const T = HW.tilemap;
  const EPS = 1e-6;

  function segDist(cx, cy, s) {
    const ex = s.x1 - s.x0, ey = s.y1 - s.y0;
    const l2 = ex * ex + ey * ey;
    let t = l2 === 0 ? 0 : ((cx - s.x0) * ex + (cy - s.y0) * ey) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = s.x0 + ex * t - cx, py = s.y0 + ey * t - cy;
    return Math.sqrt(px * px + py * py);
  }

  function circleSegment(cx, cy, r, seg) { return segDist(cx, cy, seg) < r - EPS; }

  // Deepest penetration (<= 0 means free) of a circle against solid tiles and segments.
  function penetration(map, segments, x, y, r) {
    let pen = -Infinity;
    const tx0 = T.toTile(x - r), tx1 = T.toTile(x + r);
    const ty0 = T.toTile(y - r), ty1 = T.toTile(y + r);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (!T.isSolid(T.get(map, tx, ty))) continue;
        const nx = Math.max(tx * T.TILE, Math.min(x, tx * T.TILE + T.TILE));
        const ny = Math.max(ty * T.TILE, Math.min(y, ty * T.TILE + T.TILE));
        const d = Math.sqrt((x - nx) * (x - nx) + (y - ny) * (y - ny));
        if (r - d > pen) pen = r - d;
      }
    }
    for (let i = 0; i < segments.length; i++) {
      const p = r - segDist(x, y, segments[i]);
      if (p > pen) pen = p;
    }
    return pen;
  }

  // Move along one axis (ax=1 for x, 0 for y), never tunnelling and stopping flush at obstacles.
  function moveAxis(map, segments, x, y, r, d, horizontal) {
    if (d === 0) return horizontal ? x : y;
    const n = Math.max(1, Math.ceil(Math.abs(d) / r));
    const step = d / n;
    let cur = horizontal ? x : y;
    for (let i = 0; i < n; i++) {
      const oldPen = horizontal ? penetration(map, segments, cur, y, r) : penetration(map, segments, x, cur, r);
      const test = (v) => (horizontal ? penetration(map, segments, v, y, r) : penetration(map, segments, x, v, r));
      const target = cur + step;
      const newPen = test(target);
      if (newPen <= EPS) { cur = target; continue; }
      if (oldPen > EPS) {
        // Already overlapping (e.g. closing door): allow only moves that do not go deeper.
        if (newPen < oldPen) cur = target;
        else return cur;
        continue;
      }
      // Bisect to the contact point.
      let lo = cur, hi = target;
      for (let k = 0; k < 20; k++) {
        const mid = (lo + hi) / 2;
        if (test(mid) <= EPS) lo = mid; else hi = mid;
      }
      return lo;
    }
    return cur;
  }

  function moveCircle(map, segments, x, y, r, dx, dy) {
    const nx = moveAxis(map, segments, x, y, r, dx, true);
    const ny = moveAxis(map, segments, nx, y, r, dy, false);
    return { x: nx, y: ny };
  }

  HW.collision = { moveCircle, circleSegment };
})(globalThis.HW);
