(function (HW) {
  'use strict';

  const TILE = 16;
  const NEON = { cyan: '#22e6ff', magenta: '#ff2e88', orange: '#ff8a1e' };

  // Per-floor pre-rendered layers, keyed by the world's floor object (a new world → new cache).
  const layerCache = new WeakMap();
  // Per-sign glow canvases and flicker state, keyed by the level's neon record.
  const neonCache = new WeakMap();

  function floorLayers(world, sprites, fi) {
    const floor = world.floors[fi];
    let L = layerCache.get(floor);
    if (L) return L;
    const map = floor.map, T = HW.tilemap, tiles = sprites.tiles;
    const variants = tiles.floor[world.level.id] || tiles.floor.blok;
    const solid = (x, y) => T.isSolid(T.get(map, x, y));
    // Optional outdoor surfaces: [{ tile: 'asphalt' | 'pavement', rect: [x0, y0, x1, y1] }] (inclusive).
    const rects = (world.level.floors[fi] || {}).ground || [];
    const outdoor = (x, y) => {
      const r = rects.find((g) => x >= g.rect[0] && y >= g.rect[1] && x <= g.rect[2] && y <= g.rect[3]);
      return r && tiles[r.tile];
    };
    const cars = [];
    const ground = HW.sprites.canvas(map.w * TILE, map.h * TILE, (px, g) => {
      for (let ty = 0; ty < map.h; ty++) {
        for (let tx = 0; tx < map.w; tx++) {
          const ch = T.get(map, tx, ty);
          const img = ch === '~' ? tiles.carpet : ch === 'S' ? tiles.stairs
            : outdoor(tx, ty) || variants[(tx * 7 + ty * 3) % 5 === 0 ? 1 : 0];
          g.drawImage(img, tx * TILE, ty * TILE);
          if (ch === 'P') cars.push([tx, ty]);
        }
      }
      for (const [tx, ty] of cars) g.drawImage(tiles.car, tx * TILE + 8 - 15, ty * TILE);
    });
    const walls = HW.sprites.canvas(map.w * TILE, map.h * TILE, (px, g) => {
      const edge = HW.palette.wallEdge;
      for (let ty = 0; ty < map.h; ty++) {
        for (let tx = 0; tx < map.w; tx++) {
          const ch = T.get(map, tx, ty);
          if (!T.isSolid(ch)) continue;
          const x = tx * TILE, y = ty * TILE;
          g.drawImage(ch === 'w' ? tiles.window : tiles.wall, x, y);
          if (ch !== '#') continue;
          // dark outline where the wall meets open floor; light top lip
          if (!solid(tx, ty - 1)) { px(edge, x, y, TILE, 2); px(HW.palette.concreteLight, x, y + 2, TILE, 1); }
          if (!solid(tx, ty + 1)) px(edge, x, y + TILE - 2, TILE, 2);
          if (!solid(tx - 1, ty)) px(edge, x, y, 2, TILE);
          if (!solid(tx + 1, ty)) px(edge, x + TILE - 2, y, 2, TILE);
        }
      }
    });
    L = { ground, walls };
    layerCache.set(floor, L);
    return L;
  }

  function decalsFor(fx, fi, map) {
    if (!fx.decals[fi]) fx.decals[fi] = HW.sprites.canvas(map.w * TILE, map.h * TILE, () => {});
    return fx.decals[fi];
  }

  function paintSplats(fx, fi, map) {
    const c = decalsFor(fx, fi, map);
    if (!fx.splats.length) return c;
    const g = c.getContext('2d');
    for (const s of fx.splats) {
      for (const d of s.drops) {
        const r = Math.max(1, Math.round(d.r));
        g.fillStyle = d.r > 2.5 ? HW.palette.bloodDark : HW.palette.blood;
        g.fillRect(Math.round(s.x + d.dx - r / 2), Math.round(s.y + d.dy - r / 2), r, r);
      }
    }
    fx.splats.length = 0;
    return c;
  }

  function blit(ctx, img, x, y, angle) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (angle) ctx.rotate(angle);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  }

  // Attack frame shortly after attacking (cooldown just set), else walk frames while moving.
  function frameOf(c, t) {
    const def = HW.weapons[c.weapon ? c.weapon.id : 'fists'];
    if (c.executing) return Math.floor(t * 10) % 2 ? 2 : 0;
    if (c.cooldown > 0 && c.cooldown > def.cooldown - 0.12) return 2;
    if (Math.hypot(c.vx || 0, c.vy || 0) > 5) return Math.floor(t * 8) % 2;
    return 0;
  }

  function drawCharacter(ctx, sprites, c, type, t, maskId) {
    const frame = frameOf(c, t);
    ctx.save();
    ctx.translate(Math.round(c.x), Math.round(c.y));
    ctx.rotate(c.facing);
    if (c.weapon && sprites.weapons[c.weapon.id]) {
      const def = HW.weapons[c.weapon.id];
      const swing = def.kind === 'melee' && frame === 2 ? 0.9 : def.kind === 'melee' ? -0.6 : 0;
      ctx.save();
      ctx.translate(def.kind === 'gun' ? 6 : 4, def.kind === 'gun' ? 0 : 4);
      ctx.rotate(swing);
      ctx.drawImage(sprites.weapons[c.weapon.id], -3, -3);
      ctx.restore();
    }
    ctx.drawImage(sprites.chars[type][frame], -6, -6);
    if (maskId && sprites.masks[maskId]) ctx.drawImage(sprites.masks[maskId], -6, -6);
    ctx.restore();
  }

  function neonSign(n) {
    let s = neonCache.get(n);
    if (s) return s;
    const color = NEON[n.color] || NEON.magenta;
    const w = HW.font.measure(n.text, 1);
    const img = HW.sprites.canvas(w + 16, 7 + 16, (px, g) => {
      g.shadowColor = color;
      g.shadowBlur = 5;
      for (let i = 0; i < 2; i++) HW.font.draw(g, n.text, 8, 8, color);
      g.shadowBlur = 0;
      HW.font.draw(g, n.text, 8, 8, HW.sprites.lighten(color, 0.6));
    });
    s = { img, alpha: 1, offT: 0 };
    neonCache.set(n, s);
    return s;
  }

  function drawNeon(ctx, world, dt) {
    const defs = (world.level.floors[world.floorIndex] || {}).neon || [];
    if (!defs.length) return;
    ctx.save();
    ctx.fillStyle = HW.palette.ink; // dark sign boards behind the tubes
    for (const n of defs) ctx.fillRect(n.at[0] * TILE - 3, n.at[1] * TILE + 1, HW.font.measure(n.text, 1) + 6, 13);
    ctx.globalCompositeOperation = 'lighter';
    for (const n of defs) {
      const s = neonSign(n);
      // random flicker: brief dropouts plus a gentle hum
      if (s.offT > 0) s.offT -= dt;
      else if (Math.random() < 0.01) s.offT = 0.04 + Math.random() * 0.12;
      s.alpha = s.offT > 0 ? 0.2 : 0.85 + Math.random() * 0.15;
      ctx.globalAlpha = s.alpha;
      ctx.drawImage(s.img, n.at[0] * TILE - 8, n.at[1] * TILE + 4 - 8);
    }
    ctx.restore();
  }

  function drawDoors(ctx, floor) {
    ctx.save();
    ctx.lineCap = 'butt';
    for (const d of floor.doors) {
      const s = HW.door.segment(d);
      ctx.strokeStyle = HW.palette.door;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(s.x0, s.y0); ctx.lineTo(s.x1, s.y1); ctx.stroke();
      ctx.fillStyle = HW.palette.doorLight;
      ctx.fillRect(Math.round(s.x0) - 1, Math.round(s.y0) - 1, 2, 2);
    }
    ctx.restore();
  }

  function drawProjectiles(ctx, world, fx, sprites) {
    ctx.save();
    ctx.strokeStyle = HW.palette.bullet;
    ctx.lineWidth = 1.5;
    for (const b of world.projectiles) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
    for (const it of world.thrown) {
      if (sprites.weapons[it.id]) blit(ctx, sprites.weapons[it.id], it.x, it.y, world.time * (it.spin || 0));
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of fx.flashes) {
      ctx.globalAlpha = Math.min(1, f.life / 0.05);
      ctx.save();
      ctx.translate(f.x, f.y); ctx.rotate(f.angle || 0);
      ctx.fillStyle = HW.palette.orange; ctx.fillRect(7, -3, 7, 6);
      ctx.fillStyle = HW.palette.flash; ctx.fillRect(7, -1, 10, 2);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = HW.palette.blood;
    for (const p of fx.particles) {
      ctx.globalAlpha = Math.min(1, p.life * 4);
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }
    ctx.restore();
  }

  function drawTint(ctx, t) {
    const k = (Math.sin(t * 0.7) + 1) / 2; // slow magenta ↔ cyan pulse
    const r = Math.round(255 * (1 - k) + 34 * k), g = Math.round(46 * (1 - k) + 230 * k), b = Math.round(136 * (1 - k) + 255 * k);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.045 + 0.02 * Math.sin(t * 1.9);
    ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
    ctx.fillRect(0, 0, HW.camera.W, HW.camera.H);
    ctx.restore();
  }

  function drawCrosshair(ctx, cursor) {
    if (!cursor) return;
    const x = Math.round(cursor.x), y = Math.round(cursor.y);
    ctx.fillStyle = HW.palette.ink;
    ctx.fillRect(x - 5, y - 1, 11, 3); ctx.fillRect(x - 1, y - 5, 3, 11);
    ctx.fillStyle = HW.palette.magenta;
    ctx.fillRect(x - 4, y, 3, 1); ctx.fillRect(x + 2, y, 3, 1);
    ctx.fillRect(x, y - 4, 1, 3); ctx.fillRect(x, y + 2, 1, 3);
    ctx.fillStyle = HW.palette.white;
    ctx.fillRect(x, y, 1, 1);
  }

  let lastT = null;

  // Order: floor → decals → items → corpses → doors → characters → projectiles → walls →
  // neon → tint → crosshair.
  function draw(ctx, world, cam, fx, sprites, t) {
    const dt = lastT === null ? 0 : Math.max(0, Math.min(0.1, t - lastT));
    lastT = t;
    const fi = world.floorIndex, floor = world.floors[fi];
    const layers = floorLayers(world, sprites, fi);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = HW.palette.black;
    ctx.fillRect(0, 0, HW.camera.W, HW.camera.H);

    ctx.save();
    ctx.translate(Math.round(HW.camera.W / 2 - cam.x + cam.ox), Math.round(HW.camera.H / 2 - cam.y + cam.oy));
    ctx.drawImage(layers.ground, 0, 0);
    ctx.drawImage(paintSplats(fx, fi, floor.map), 0, 0);
    for (const it of floor.items) {
      if (sprites.weapons[it.id]) blit(ctx, sprites.weapons[it.id], it.x, it.y, it.spin || 0);
    }
    for (const c of world.corpses) {
      if (c.floor === fi && sprites.corpses[c.kind]) blit(ctx, sprites.corpses[c.kind], c.x, c.y, c.angle + Math.PI);
    }
    for (const e of floor.enemies) {
      if (e.alive && e.state === 'downed' && sprites.downed[e.type]) blit(ctx, sprites.downed[e.type], e.x, e.y, e.facing + Math.PI);
    }
    drawDoors(ctx, floor);
    for (const e of floor.enemies) {
      if (e.alive && e.state !== 'downed') drawCharacter(ctx, sprites, e, e.type, t, null);
    }
    if (world.player.alive) drawCharacter(ctx, sprites, world.player, 'player', t, world.mask);
    drawProjectiles(ctx, world, fx, sprites);
    ctx.drawImage(layers.walls, 0, 0);
    drawNeon(ctx, world, dt);
    ctx.restore();

    drawTint(ctx, t);
    drawCrosshair(ctx, cam.cursor);
  }

  HW.renderer = { draw };
})(globalThis.HW);
