(function (HW) {
  'use strict';

  // In-game HUD drawn in screen space over the renderer's frame.
  const W = 480, H = 270, WINDOW = 2.5; // combo window (scoring.js)
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
    return Math.max(0, 1 - (time - score.lastKillT) / WINDOW);
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

  function drawArrow(ctx, x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = P().ink;
    ctx.beginPath(); ctx.moveTo(10, 1); ctx.lineTo(-5, -6); ctx.lineTo(-2, 1); ctx.lineTo(-5, 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = P().cyan;
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, -7); ctx.lineTo(-3, 0); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
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

  function draw(ctx, world) {
    drawWeapon(ctx, world.player);
    drawScore(ctx, world);
    if (world.status === 'cleared') {
      if (world.time % 0.8 < 0.6) shadowed(ctx, 'WRACAJ DO AUTA', W / 2, 10, P().cyan, 2, 'center');
      const car = world.floorIndex === 0 ? carOf(world) : null;
      if (car) drawArrow(ctx, W / 2, 40, Math.atan2(car.y - world.player.y, car.x - world.player.x));
    } else if (world.status === 'dead') {
      banner(ctx, [['NIE ŻYJESZ — R', P().magenta, 2], ['ESC — MENU', P().concreteLight, 1]]);
    }
  }

  HW.hud = { draw, comboLeft };
})(globalThis.HW);
