(function (HW) {
  'use strict';

  const KNOWN = '#.~wDPS';
  const GROUND_TILES = ['asphalt', 'pavement'];
  HW.levels = HW.levels || {};

  // Optional per-floor outdoor surfaces: [{ tile: 'asphalt' | 'pavement', rect: [x0, y0, x1, y1] }],
  // corners inclusive and inside the map.
  function validateGround(ground, map, err) {
    if (ground === undefined) return;
    if (!Array.isArray(ground)) { err('ground must be a list of (tile, rect) entries'); return; }
    ground.forEach((g, gi) => {
      const where = 'ground ' + gi;
      if (!g || typeof g !== 'object') { err(where + ' must be an object with tile and rect'); return; }
      if (!GROUND_TILES.includes(g.tile)) err(where + ' has unknown tile "' + g.tile + '" (expected ' + GROUND_TILES.join(' or ') + ')');
      const r = g.rect;
      if (!Array.isArray(r) || r.length !== 4 || !r.every(Number.isInteger)) {
        err(where + ' rect must be 4 integers (x0, y0, x1, y1)');
      } else if (r[0] < 0 || r[1] < 0 || r[0] > r[2] || r[1] > r[3] || r[2] >= map.w || r[3] >= map.h) {
        err(where + ' rect (' + r + ') is out of bounds or inverted, map is ' + map.w + '×' + map.h);
      }
    });
  }

  function validate(level) {
    const errors = [];
    const T = HW.tilemap;
    const title = level.title;
    const err = (msg) => errors.push(title + ': ' + msg);
    const floors = level.floors || [];
    const maps = [];
    let pCount = 0;

    if (!(level.targetScore > 0)) err('targetScore must be > 0');
    if (floors.length === 0) err('level has no floors');

    floors.forEach((f, fi) => {
      const rows = f.map || [];
      const ok = rows.length > 0 && rows[0].length > 0 && rows.every((r) => r.length === rows[0].length);
      if (!ok) err('floor ' + fi + ' map is empty or not rectangular');
      const map = T.parse(rows);
      maps.push(map);
      for (let y = 0; y < map.h; y++) {
        for (let x = 0; x < map.rows[y].length; x++) {
          const ch = map.rows[y][x];
          if (KNOWN.indexOf(ch) === -1) err('floor ' + fi + ' unknown tile "' + ch + '" at (' + x + ',' + y + ')');
          if (ch === 'P') {
            pCount++;
            if (fi !== 0) err('floor ' + fi + ' has P at (' + x + ',' + y + '); P must be on floor 0');
          }
          if (ch === 'D') {
            const wall = (dx, dy) => T.isSolid(T.get(map, x + dx, y + dy));
            if ((wall(-1, 0) && wall(1, 0)) === (wall(0, -1) && wall(0, 1))) {
              err('floor ' + fi + ' door at (' + x + ',' + y + ') needs walls on exactly one opposing pair of neighbours');
            }
          }
        }
      }
    });
    if (pCount !== 1) err('expected exactly one P, found ' + pCount);

    const walkable = (fi, at) => {
      const m = maps[fi];
      return !!m && Array.isArray(at) && T.isWalkable(T.get(m, at[0], at[1]));
    };

    floors.forEach((f, fi) => {
      validateGround(f.ground, maps[fi], (msg) => err('floor ' + fi + ' ' + msg));
      (f.enemies || []).forEach((e, ei) => {
        const where = 'floor ' + fi + ' enemy ' + ei + ' at (' + e.at + ')';
        if (!HW.enemyTypes[e.type]) err(where + ' has unknown type "' + e.type + '"');
        if (e.weapon !== undefined && !HW.weapons[e.weapon]) err(where + ' has unknown weapon "' + e.weapon + '"');
        if (!walkable(fi, e.at)) err(where + ' is not on a walkable tile');
        (e.patrol || []).forEach((p, pi) => {
          if (!walkable(fi, p)) err(where + ' patrol point ' + pi + ' at (' + p + ') is not on a walkable tile');
        });
      });
      (f.items || []).forEach((it, ii) => {
        const where = 'floor ' + fi + ' item ' + ii + ' at (' + it.at + ')';
        if (!HW.weapons[it.weapon]) err(where + ' has unknown weapon "' + it.weapon + '"');
        if (!walkable(fi, it.at)) err(where + ' is not on a walkable tile');
      });
      (f.stairs || []).forEach((s, si) => {
        const where = 'floor ' + fi + ' stair ' + si + ' at (' + s.at + ')';
        if (!maps[fi] || !Array.isArray(s.at) || T.get(maps[fi], s.at[0], s.at[1]) !== 'S') err(where + ' is not on an S tile');
        const to = s.to || {};
        if (!maps[to.floor]) err(where + ' targets missing floor ' + to.floor);
        else if (!walkable(to.floor, to.at)) err(where + ' target (' + to.at + ') on floor ' + to.floor + ' is not walkable');
      });
    });

    return errors;
  }

  HW.levels.validate = validate;
})(globalThis.HW);
