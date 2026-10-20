(function (HW) {
  'use strict';

  const TILE = 16;

  function parse(rows) {
    let w = 0;
    for (const r of rows) if (r.length > w) w = r.length;
    return { w, h: rows.length, rows: rows.slice() };
  }
  function get(map, tx, ty) {
    if (tx < 0 || ty < 0 || ty >= map.h || tx >= map.rows[ty].length) return '#';
    return map.rows[ty][tx];
  }
  function isSolid(ch) { return ch === '#' || ch === 'w'; }
  function blocksBullets(ch) { return ch === '#'; }
  function blocksSight(ch) { return ch === '#'; }
  function isWalkable(ch) { return '.~PSD'.indexOf(ch) !== -1 && ch.length === 1; }
  function find(map, ch) {
    const out = [];
    for (let ty = 0; ty < map.h; ty++) {
      for (let tx = 0; tx < map.rows[ty].length; tx++) {
        if (map.rows[ty][tx] === ch) out.push([tx, ty]);
      }
    }
    return out;
  }
  function toTile(px) { return Math.floor(px / TILE); }
  function center(t) { return t * TILE + TILE / 2; }

  HW.tilemap = { TILE, parse, get, isSolid, blocksBullets, blocksSight, isWalkable, find, toTile, center };
})(globalThis.HW);
