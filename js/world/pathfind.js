(function (HW) {
  'use strict';

  const SQRT2 = Math.SQRT2;
  const DIRS = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];

  // Binary min-heap of immutable {n, f, g} entries (stale entries are skipped
  // by the caller via the closed set). Ties broken by larger g.
  function makeHeap() {
    const a = [];
    const less = (x, y) => x.f < y.f || (x.f === y.f && x.g > y.g);
    return {
      size() { return a.length; },
      push(e) {
        let i = a.push(e) - 1;
        while (i > 0) {
          const p = (i - 1) >> 1;
          if (!less(a[i], a[p])) break;
          [a[i], a[p]] = [a[p], a[i]];
          i = p;
        }
      },
      pop() {
        const top = a[0];
        const last = a.pop();
        if (a.length) {
          a[0] = last;
          let i = 0;
          for (;;) {
            const l = 2 * i + 1, r = l + 1;
            let m = i;
            if (l < a.length && less(a[l], a[m])) m = l;
            if (r < a.length && less(a[r], a[m])) m = r;
            if (m === i) break;
            [a[i], a[m]] = [a[m], a[i]];
            i = m;
          }
        }
        return top;
      },
    };
  }

  function octile(dx, dy) {
    dx = Math.abs(dx); dy = Math.abs(dy);
    return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
  }

  // Returns [[tx,ty],...] from start (excluded) to goal (included), [] if
  // start === goal, or null if the goal is unreachable.
  function find(map, start, goal) {
    const T = HW.tilemap;
    const [sx, sy] = start;
    const [gx, gy] = goal;
    if (sx === gx && sy === gy) return [];
    const walk = (x, y) => T.isWalkable(T.get(map, x, y));
    const W = map.w, H = map.h;
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) return null;
    if (gx < 0 || gy < 0 || gx >= W || gy >= H) return null;
    if (!walk(gx, gy)) return null;
    const idx = (x, y) => y * W + x;
    const n = W * H;
    const g = new Float64Array(n).fill(Infinity);
    const f = new Float64Array(n).fill(Infinity);
    const parent = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const heap = makeHeap();

    const s = idx(sx, sy);
    const goalIdx = idx(gx, gy);
    g[s] = 0;
    f[s] = octile(gx - sx, gy - sy);
    heap.push({ n: s, f: f[s], g: 0 });

    while (heap.size()) {
      const cur = heap.pop().n;
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (cur === goalIdx) {
        const path = [];
        for (let c = cur; c !== s; c = parent[c]) path.push([c % W, (c / W) | 0]);
        return path.reverse();
      }
      const cx = cur % W, cy = (cur / W) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || !walk(nx, ny)) continue;
        const diag = dx !== 0 && dy !== 0;
        if (diag && !(walk(cx + dx, cy) && walk(cx, cy + dy))) continue;
        const ni = idx(nx, ny);
        if (closed[ni]) continue;
        const ng = g[cur] + (diag ? SQRT2 : 1);
        if (ng < g[ni]) {
          g[ni] = ng;
          f[ni] = ng + octile(gx - nx, gy - ny);
          parent[ni] = cur;
          heap.push({ n: ni, f: f[ni], g: ng });
        }
      }
    }
    return null;
  }

  HW.pathfind = { find };
})(globalThis.HW);
