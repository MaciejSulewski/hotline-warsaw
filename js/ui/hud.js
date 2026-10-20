(function (HW) {
  'use strict';

  // In-game HUD drawn in screen space over the renderer's frame.
  const W = 480, H = 270, ARROW_R = 22; // arrow orbit radius around the player, screen px
  const carCache = new WeakMap();

  const P = () => HW.palette;

  function shadowed(ctx, s, x, y, color, scale, align) {
    const k = scale || 1;
    HW.font.draw(ctx, s, x + 1, y + 1, P().ink, k, align || 'left');
    HW.font.draw(ctx, s, x, y, color, k, align || 'left');
  }

  // Fraction (1 → 0) of the combo window left since the last kill; 0 with no chain.
  function comboLeft(score, time) {
    if (!score || !score.chain || !score.chain.length) return 0;
    return Math.max(0, 1 - (time - score.lastKillT) / HW.scoring.WINDOW);
  }

  function carOf(world) {
    const map = world.floors[0].map;
    if (!carCache.has(map)) {
      const p = HW.tilemap.find(map, 'P')[0];
      carCache.set(map, p ? { x: HW.tilemap.center(p[0]), y: HW.tilemap.center(p[1]) } : null);
    }
    return carCache.get(map);
  }

  function drawWeapon(ctx, p) {
    const w = p.weapon, def = HW.weapons[w ? w.id : 'fists'];
    shadowed(ctx, def.name, 8, 8, P().white, 1);
    if (w && def.kind === 'gun') {
      const empty = !w.ammo;
      shadowed(ctx, empty ? 'PUSTY' : String(w.ammo), 8, 18, empty ? P().magenta : P().bullet, 2);
      if (!empty) { // one pip per round, up to the magazine size
        const n = Math.min(w.ammo, 30), x0 = 8 + HW.font.measure(String(w.ammo), 2) + 6;
        for (let i = 0; i < n; i++) {
          ctx.fillStyle = P().ink; ctx.fillRect(x0 + i * 3 + 1, 21, 2, 9);
          ctx.fillStyle = P().bullet; ctx.fillRect(x0 + i * 3, 20, 2, 8);
        }
      }
    }
  }

  function drawScore(ctx, world) {
    const s = world.score;
    if (!s) return;
    const total = Math.round(s.kills + s.combo + s.bold);
    shadowed(ctx, String(total), W - 8, 8, P().magenta, 2, 'right');
    const left = comboLeft(s, world.time);
    if (left > 0) {
      shadowed(ctx, '×' + s.multiplier, W - 8, 28, P().orange, 2, 'right');
      const bw = 44, x = W - 8 - bw;
      ctx.fillStyle = P().ink; ctx.fillRect(x, 46, bw, 4);
      ctx.fillStyle = P().orange; ctx.fillRect(x + 1, 47, Math.round((bw - 2) * left), 2);
    }
  }

  // Where the player should head once cleared: the car on floor 0, otherwise the stairs on this
  // floor that lead toward floor 0 (a link straight to 0, else to a lower floor, else any).
  function target(world) {
    const fi = world.floorIndex, T = HW.tilemap;
    if (fi === 0) return carOf(world);
    const links = (world.level.floors[fi] && world.level.floors[fi].stairs) || [];
    const link = links.find((l) => l.to.floor === 0) || links.find((l) => l.to.floor < fi) || links[0];
    return link ? { x: T.center(link.at[0]), y: T.center(link.at[1]) } : null;
  }

  // Arrow orbiting the player's on-screen position, pointing at the target.
  function arrow(world, cam) {
    const tg = target(world);
    if (!tg) return null;
    const p = world.player;
    const px = cam ? Math.round(W / 2 - cam.x + (cam.ox || 0)) + p.x : W / 2;
    const py = cam ? Math.round(H / 2 - cam.y + (cam.oy || 0)) + p.y : H / 2;
    const angle = Math.atan2(tg.y - p.y, tg.x - p.x);
    return { x: px + Math.cos(angle) * ARROW_R, y: py + Math.sin(angle) * ARROW_R, angle };
  }

  function drawArrow(ctx, a, color) {
    ctx.save();
    ctx.translate(Math.round(a.x), Math.round(a.y));
    ctx.rotate(a.angle);
    ctx.fillStyle = P().ink;
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-7, -8); ctx.lineTo(-3, 0); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -6); ctx.lineTo(-2, 0); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function banner(ctx, lines) {
    const h = lines.length * 18 + 12;
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = P().black;
    ctx.fillRect(0, (H - h) / 2, W, h);
    ctx.restore();
    lines.forEach(([s, color, k], i) => HW.font.draw(ctx, s, W / 2, (H - h) / 2 + 8 + i * 18, color, k, 'center'));
  }

  // cam is optional: without it the arrow orbits the screen centre.
  function draw(ctx, world, cam) {
    drawWeapon(ctx, world.player);
    drawScore(ctx, world);
    if (world.status === 'cleared') {
      const color = Math.floor(world.time * 3) % 2 ? P().cyan : P().magenta; // pulse, never off
      const msg = 'WRACAJ DO AUTA', tw = HW.font.measure(msg, 2);
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = P().black;
      ctx.fillRect(W / 2 - tw / 2 - 8, 6, tw + 16, 22);
      ctx.restore();
      shadowed(ctx, msg, W / 2, 10, color, 2, 'center');
      const a = arrow(world, cam);
      if (a) drawArrow(ctx, a, color);
    } else if (world.status === 'dead') {
      banner(ctx, [['NIE ŻYJESZ — R', P().magenta, 2], ['ESC — MENU', P().concreteLight, 1]]);
    }
  }

  HW.hud = { ARROW_R, draw, comboLeft, target, arrow };
})(globalThis.HW);
