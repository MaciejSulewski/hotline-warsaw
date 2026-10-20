(function (HW) {
  'use strict';

  // Menu screens: draw(ctx, flow, t, opts) and hitTest(flow, x, y) at canvas-pixel coords.
  // opts: { sprites, cursor: {x, y} } — both optional.
  const W = 480, H = 270;

  const PERKS = {
    lajkonik: 'BEZ ATUTÓW — CZYSTA KLASYKA',
    bolek: 'ZACZYNASZ Z NOŻEM',
    lolek: 'DRZWI OGŁUSZAJĄ NA 5 S',
    czapka: 'PRZEŻYJESZ PIERWSZE TRAFIENIE',
    kleks: '+20% SZYBKOŚCI RUCHU',
  };
  const UNLOCK_HINTS = {
    bolek: 'UKOŃCZ POZIOM 1',
    lolek: 'OCENA B NA POZIOMIE 1',
    czapka: 'UKOŃCZ POZIOM 2',
    kleks: 'OCENA A GDZIEKOLWIEK',
  };

  const P = () => HW.palette;
  const text = (ctx, s, x, y, color, scale, align) => HW.font.draw(ctx, s, x, y, color, scale || 1, align || 'left');

  // Text with a 1-px dark drop shadow (readable over anything).
  function shadowed(ctx, s, x, y, color, scale, align) {
    const k = scale || 1;
    text(ctx, s, x + 1, y + 1, P().ink, k, align);
    text(ctx, s, x, y, color, k, align);
  }

  // Neon tube: soft halo at low alpha around a bright core.
  function neon(ctx, s, x, y, color, scale, align) {
    const k = scale || 1, d = Math.max(1, Math.round(k / 2));
    ctx.save();
    ctx.globalAlpha = 0.22;
    for (const [dx, dy] of [[-d, 0], [d, 0], [0, -d], [0, d]]) text(ctx, s, x + dx, y + dy, color, k, align);
    ctx.restore();
    text(ctx, s, x, y, color, k, align);
  }

  const mix = (a, b, k) => {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const c = (s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
    return 'rgb(' + c(16) + ',' + c(8) + ',' + c(0) + ')';
  };
  const blink = (t, hz) => Math.floor(t * (hz || 2)) % 2 === 0;

  // ---- shared backdrop ---------------------------------------------------------------
  function scanlines(ctx, t, strength) {
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.globalAlpha = strength;
    for (let y = 0; y < H; y += 2) ctx.fillRect(0, y, W, 1);
    // VHS tracking band rolling down the screen
    const by = ((t * 37) % (H + 40)) - 20;
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, Math.round(by), W, 6);
    ctx.globalAlpha = 0.04;
    ctx.fillRect(0, Math.round(by) + 8, W, 2);
    ctx.restore();
  }

  function menuBackdrop(ctx, t) {
    ctx.fillStyle = P().black;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#16101f';
    for (let x = (Math.floor(t * 6) % 24) - 24; x < W; x += 24) ctx.fillRect(x, 0, 1, H);
    for (let y = 0; y < H; y += 24) ctx.fillRect(0, y, W, 1);
  }

  function header(ctx, s) {
    neon(ctx, s, W / 2, 14, P().magenta, 2, 'center');
    ctx.fillStyle = P().magenta;
    ctx.fillRect(W / 2 - 90, 34, 180, 1);
  }

  function footer(ctx, s) { text(ctx, s, W / 2, H - 14, P().concrete, 1, 'center'); }

  // ---- title ---------------------------------------------------------------------------
  // Deterministic speckle hash (no Math.random so frames are reproducible).
  function hash(a, b) {
    let h = Math.imul(a * 374761393 + b * 668265263, 1274126177);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  }

  function drawSun(ctx, cx, horizon, r) {
    for (let y = horizon - r; y < horizon; y++) {
      const dy = horizon - 8 - y; // centre slightly above the horizon
      const k = (y - (horizon - r)) / r;
      const gap = k > 0.45 && (y % 6) < Math.floor((k - 0.35) * 8); // widening stripes toward the bottom
      if (gap) continue;
      const hw = Math.sqrt(Math.max(0, r * r - dy * dy));
      ctx.fillStyle = mix('#ffd23a', P().magenta, k);
      ctx.fillRect(Math.round(cx - hw), y, Math.round(hw * 2), 1);
    }
  }

  function drawBlocks(ctx, horizon) {
    // Silhouettes of PRL blocks on the horizon with a few lit windows.
    const blocks = [[18, 70, 46], [96, 40, 30], [150, 34, 20], [300, 40, 26], [352, 64, 50], [430, 40, 34]];
    for (const [x, w, h] of blocks) {
      ctx.fillStyle = '#120c1c';
      ctx.fillRect(x, horizon - h, w, h);
      for (let wy = horizon - h + 4; wy < horizon - 3; wy += 5) {
        for (let wx = x + 3; wx < x + w - 3; wx += 5) {
          if (hash(wx, wy) < 0.18) { ctx.fillStyle = hash(wy, wx) < 0.5 ? '#c9a227' : '#e8d9a0'; ctx.fillRect(wx, wy, 2, 2); }
        }
      }
    }
  }

  function drawGrid(ctx, t, horizon) {
    ctx.fillStyle = '#0d0716';
    ctx.fillRect(0, horizon, W, H - horizon);
    ctx.save();
    ctx.strokeStyle = P().magenta;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    for (let i = -12; i <= 12; i++) {
      ctx.moveTo(W / 2 + i * 6, horizon);
      ctx.lineTo(W / 2 + i * 60, H);
    }
    const phase = (t * 0.6) % 1;
    for (let i = 0; i < 9; i++) {
      const z = i + 1 - phase;
      const y = Math.round(horizon + (H - horizon) * (1 / z) * 0.9) + 0.5;
      if (y > horizon && y < H) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    }
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = P().magenta;
    ctx.fillRect(0, horizon, W, 1);
  }

  function drawVhsOsd(ctx, t) {
    const c = '#e8f0e8';
    text(ctx, 'PLAY', 14, 12, c, 1);
    for (let i = 0; i < 7; i++) ctx.fillRect(42, 12 + i, i < 4 ? i + 1 : 7 - i, 1); // ▶
    const s = Math.floor(t);
    const mm = String(Math.floor(s / 60) % 60).padStart(2, '0'), ss = String(s % 60).padStart(2, '0');
    text(ctx, '0:' + mm + ':' + ss, W - 14, 12, c, 1, 'right');
  }

  function drawTitle(ctx, flow, t) {
    const horizon = 196;
    ctx.fillStyle = P().black;
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < horizon; y += 4) { // dusk sky bands
      ctx.fillStyle = mix('#07060c', '#3a0d3a', y / horizon);
      ctx.fillRect(0, y, W, 4);
    }
    drawSun(ctx, W / 2, horizon, 62);
    drawBlocks(ctx, horizon);
    drawGrid(ctx, t, horizon);

    // Title: chromatic offset copies behind a bright core.
    const jit = blink(t, 0.4) && (t % 2.5) < 0.08 ? 2 : 0; // occasional VHS jitter
    text(ctx, 'HOTLINE', W / 2 + 2 + jit, 30 + 2, P().cyan, 6, 'center');
    neon(ctx, 'HOTLINE', W / 2 + jit, 30, P().magenta, 6, 'center');
    text(ctx, 'WARSZAWA', W / 2 - 2, 84 + 2, P().magenta, 5, 'center');
    neon(ctx, 'WARSZAWA', W / 2, 84, P().cyan, 5, 'center');
    shadowed(ctx, 'PRAGA, 1986', W / 2, 128, P().orange, 2, 'center');

    if (t % 1.2 < 0.85) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = P().black;
      ctx.fillRect(W / 2 - 116, 222, 232, 22);
      ctx.restore();
      shadowed(ctx, 'KLIKNIJ ABY ZACZĄĆ', W / 2, 226, P().white, 2, 'center');
    }
    drawVhsOsd(ctx, t);
    // tape noise speckles
    const frame = Math.floor(t * 30);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 24; i++) {
      if (hash(frame, i) < 0.5) ctx.fillRect(Math.floor(hash(i, frame) * W), Math.floor(hash(frame + i, 7) * H), 1, 1);
    }
    scanlines(ctx, t, 0.22);
  }

  // ---- layout (shared by draw and hitTest) -----------------------------------------------
  function layout(flow) {
    let list, x, w, y0, h, gap;
    if (flow.state === 'levelSelect') { list = HW.flow.levelList(flow); x = 80; w = 320; y0 = 56; h = 34; gap = 8; }
    else if (flow.state === 'maskSelect') { list = HW.flow.maskList(flow); x = 64; w = 352; y0 = 44; h = 33; gap = 4; }
    else return [];
    return list.map((e, i) => ({ id: e.id, unlocked: e.unlocked, entry: e, x, y: y0 + i * (h + gap), w, h }));
  }

  function hitTest(flow, x, y) {
    const s = flow.state;
    if (s === 'title' || s === 'phoneCall' || s === 'results') return { type: 'click' };
    for (const r of layout(flow)) {
      if (r.unlocked && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return { type: 'select', id: r.id };
    }
    return null;
  }

  function rowBox(ctx, r, selected, t) {
    ctx.save();
    ctx.globalAlpha = selected ? 0.85 : 0.6;
    ctx.fillStyle = selected ? '#2a0f24' : P().ink;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
    const c = !r.unlocked ? P().concreteDark : selected ? P().magenta : '#3b2f4a';
    ctx.fillStyle = c;
    ctx.fillRect(r.x, r.y, r.w, 1); ctx.fillRect(r.x, r.y + r.h - 1, r.w, 1);
    ctx.fillRect(r.x, r.y, 1, r.h); ctx.fillRect(r.x + r.w - 1, r.y, 1, r.h);
    if (selected && blink(t, 3)) {
      ctx.fillStyle = P().magenta;
      for (let i = 0; i < 7; i++) ctx.fillRect(r.x - 9, r.y + r.h / 2 - 3 + i, i < 4 ? i + 1 : 7 - i, 1);
    }
  }

  // ---- level select --------------------------------------------------------------------
  function drawLevelSelect(ctx, flow, t) {
    menuBackdrop(ctx, t);
    header(ctx, 'WYBIERZ POZIOM');
    layout(flow).forEach((r, i) => {
      const sel = r.unlocked && i === flow.sel;
      rowBox(ctx, r, sel, t);
      const lv = r.entry.level;
      const main = r.unlocked ? (sel ? P().white : P().concreteLight) : P().concreteDark;
      text(ctx, lv.title || r.id, r.x + 10, r.y + 6, main, 2);
      text(ctx, lv.subtitle || '', r.x + 10, r.y + 23, r.unlocked ? P().cyan : P().concreteDark, 1);
      const best = flow.save.bestScores[r.id];
      if (!r.unlocked) text(ctx, 'ZABLOKOWANY', r.x + r.w - 10, r.y + 23, P().concreteDark, 1, 'right');
      else if (best && typeof best.score === 'number') {
        text(ctx, 'REKORD ' + Math.round(best.score), r.x + r.w - 10, r.y + 23, P().concrete, 1, 'right');
        text(ctx, String(best.grade || ''), r.x + r.w - 10, r.y + 6, P().orange, 2, 'right');
      }
    });
    footer(ctx, 'STRZAŁKI / MYSZ — WYBÓR    ENTER — DALEJ');
    scanlines(ctx, t, 0.15);
  }

  // ---- phone call ----------------------------------------------------------------------
  function wrap(line, max) {
    const out = [];
    let cur = '';
    for (const word of line.split(' ')) {
      if (cur && (cur + ' ' + word).length > max) { out.push(cur); cur = word; }
      else cur = cur ? cur + ' ' + word : word;
    }
    out.push(cur);
    return out;
  }

  function drawPhone(ctx, x, y, shake) {
    const red = '#b0202c', dark = '#5c0810', hi = '#e0505a';
    const ox = Math.round(x), oy = Math.round(y);
    ctx.fillStyle = dark; ctx.fillRect(ox + 4, oy + 26, 64, 34); // base shadow
    ctx.fillStyle = red; ctx.fillRect(ox + 2, oy + 22, 64, 34);
    ctx.fillStyle = hi; ctx.fillRect(ox + 2, oy + 22, 64, 2);
    ctx.fillStyle = P().ink; ctx.fillRect(ox + 20, oy + 28, 28, 24); // dial
    ctx.fillStyle = P().white;
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI * 0.9 + i * 0.17 * Math.PI;
      ctx.fillRect(Math.round(ox + 34 + Math.cos(a) * 9), Math.round(oy + 40 + Math.sin(a) * 9), 2, 2);
    }
    ctx.fillStyle = red; ctx.fillRect(ox + 31, oy + 37, 6, 6);
    const hx = ox + shake, hy = oy - Math.abs(shake); // handset bounces while ringing
    ctx.fillStyle = dark; ctx.fillRect(hx, hy + 14, 70, 8);
    ctx.fillStyle = red; ctx.fillRect(hx, hy + 12, 70, 8); ctx.fillRect(hx - 2, hy + 8, 14, 14); ctx.fillRect(hx + 58, hy + 8, 14, 14);
    ctx.fillStyle = hi; ctx.fillRect(hx, hy + 12, 70, 1);
  }

  function drawPhoneCall(ctx, flow, t) {
    menuBackdrop(ctx, t);
    const lv = HW.levels[flow.levelId] || {};
    neon(ctx, lv.title || '', W / 2, 14, P().cyan, 2, 'center');
    text(ctx, lv.subtitle || '', W / 2, 34, P().concreteLight, 1, 'center');
    const ringing = HW.flow.ringing(flow);
    const shake = ringing && (flow.stateT % 0.5) < 0.3 ? (Math.floor(t * 30) % 2 ? 2 : -2) : 0;
    if (ringing) {
      drawPhone(ctx, W / 2 - 35, 112, shake);
      if ((flow.stateT % 0.5) < 0.35) neon(ctx, 'DRRRYŃ!', W / 2, 74, P().orange, 3, 'center');
      text(ctx, 'DZWONI TELEFON...', W / 2, 190, P().concreteLight, 1, 'center');
    } else {
      drawPhone(ctx, 32, 112, 0);
      const bx = 128, by = 62, bw = 336, bh = 150, max = Math.floor((bw - 20) / 6);
      ctx.save();
      ctx.globalAlpha = 0.8; ctx.fillStyle = P().ink; ctx.fillRect(bx, by, bw, bh);
      ctx.restore();
      ctx.fillStyle = P().cyan;
      ctx.fillRect(bx, by, bw, 1); ctx.fillRect(bx, by + bh - 1, bw, 1);
      text(ctx, 'SŁUCHAWKA', bx + 10, by - 10, P().cyan, 1);
      const vis = HW.phonecall.visible(flow.phone);
      let y = by + 12, lastX = bx + 10, lastY = y;
      flow.phone.lines.forEach((line, i) => {
        let left = vis[i].length;
        for (const seg of wrap(line, max)) {
          const s = seg.slice(0, Math.max(0, left));
          if (s.length) { text(ctx, s, bx + 10, y, P().white, 1); lastX = bx + 10 + s.length * 6; lastY = y; }
          left -= seg.length + 1;
          y += 11;
        }
        y += 6;
      });
      if (!flow.phone.done || blink(t, 3)) { ctx.fillStyle = P().magenta; ctx.fillRect(lastX + 1, lastY, 5, 7); }
    }
    const done = !ringing && flow.phone.done;
    if (!done) footer(ctx, 'SPACJA / KLIK — POMIŃ    ESC — WRÓĆ');
    else if (blink(t, 1.6)) text(ctx, 'KLIKNIJ / ENTER — DALEJ', W / 2, H - 14, P().white, 1, 'center');
    scanlines(ctx, t, 0.15);
  }

  // ---- mask select ---------------------------------------------------------------------
  function drawMaskSprite(ctx, sprites, id, x, y, unlocked) {
    if (!sprites) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(2, 2);
    ctx.rotate(-Math.PI / 2); // face up
    if (!unlocked) ctx.globalAlpha = 0.25;
    ctx.drawImage(sprites.chars.player[0], -6, -6);
    if (sprites.masks[id]) ctx.drawImage(sprites.masks[id], -6, -6);
    ctx.restore();
  }

  function drawMaskSelect(ctx, flow, t, opts) {
    menuBackdrop(ctx, t);
    header(ctx, 'WYBIERZ MASKĘ');
    layout(flow).forEach((r, i) => {
      const sel = r.unlocked && i === flow.sel;
      rowBox(ctx, r, sel, t);
      drawMaskSprite(ctx, opts.sprites, r.id, r.x + 22, r.y + r.h / 2, r.unlocked);
      const name = (r.entry.mask && r.entry.mask.name) || r.id;
      text(ctx, name, r.x + 44, r.y + 5, r.unlocked ? (sel ? P().white : P().concreteLight) : P().concreteDark, 2);
      text(ctx, PERKS[r.id] || '', r.x + 44, r.y + 22, r.unlocked ? P().cyan : P().concreteDark, 1);
      if (!r.unlocked) text(ctx, UNLOCK_HINTS[r.id] || '', r.x + r.w - 8, r.y + 22, '#8a5a2a', 1, 'right');
    });
    footer(ctx, 'STRZAŁKI / MYSZ — WYBÓR    ENTER — GRAJ    ESC — WRÓĆ');
    scanlines(ctx, t, 0.15);
  }

  // ---- results -------------------------------------------------------------------------
  const GRADE_COLORS = { 'A+': '#22e6ff', A: '#22e6ff', B: '#7cf29a', C: '#ff8a1e', D: '#ff8a1e', F: '#ff2e88' };

  function levelName(id) {
    const lv = HW.levels && HW.levels[id];
    return lv && lv.title ? lv.title.split(': ').pop() : String(id).toUpperCase();
  }

  function drawResults(ctx, flow, t) {
    menuBackdrop(ctx, t);
    const r = flow.results || { lines: [], total: 0, grade: 'F', newMasks: [], newLevel: null };
    header(ctx, 'POZIOM UKOŃCZONY');
    const lv = HW.levels[flow.levelId];
    if (lv) text(ctx, lv.title, W / 2, 40, P().concreteLight, 1, 'center');
    const lx = 40, rx = 268;
    let y = 60;
    for (const l of r.lines) {
      const pts = String(Math.round(l.points));
      text(ctx, l.label, lx, y, P().concreteLight, 1);
      ctx.fillStyle = P().concreteDark;
      for (let x = lx + HW.font.measure(l.label) + 4; x < rx - HW.font.measure(pts) - 4; x += 4) ctx.fillRect(x, y + 6, 1, 1);
      text(ctx, pts, rx, y, P().white, 1, 'right');
      y += 14;
    }
    ctx.fillStyle = P().magenta;
    ctx.fillRect(lx, y, rx - lx, 1);
    y += 6;
    text(ctx, 'RAZEM', lx, y + 2, P().white, 2);
    neon(ctx, String(Math.round(r.total)), rx, y + 2, P().orange, 2, 'right');

    text(ctx, 'OCENA', 384, 52, P().concreteLight, 1, 'center');
    const gc = GRADE_COLORS[r.grade] || P().magenta;
    const pulse = 0.85 + 0.15 * Math.sin(t * 4);
    ctx.save();
    ctx.globalAlpha = pulse;
    neon(ctx, r.grade, 384, 68, gc, r.grade.length > 1 ? 8 : 10, 'center');
    ctx.restore();

    const unlocks = (r.newMasks || []).map((id) => 'NOWA MASKA: ' + ((HW.masks[id] && HW.masks[id].name) || id).toUpperCase());
    if (r.newLevel) unlocks.push('NOWY POZIOM: ' + levelName(r.newLevel));
    unlocks.slice(0, 5).forEach((u, i) => neon(ctx, u, W / 2, 168 + i * 12, i % 2 ? P().cyan : P().magenta, 1, 'center'));
    if (blink(t, 1.6)) text(ctx, 'KLIKNIJ / ENTER — DALEJ', W / 2, H - 14, P().white, 1, 'center');
    scanlines(ctx, t, 0.15);
  }

  // ---- cursor ----------------------------------------------------------------------------
  function drawCursor(ctx, c) {
    if (!c) return;
    const x = Math.round(c.x), y = Math.round(c.y);
    for (let i = 0; i < 9; i++) { // arrow: dark outline, white fill
      const w = Math.min(i, 9 - i * 0.5);
      ctx.fillStyle = P().ink; ctx.fillRect(x - 1, y + i - 1, Math.max(1, w) + 2, 3);
    }
    ctx.fillStyle = P().white;
    for (let i = 0; i < 8; i++) ctx.fillRect(x, y + i, Math.max(1, Math.min(i, 8 - i * 0.5)), 1);
  }

  function draw(ctx, flow, t, opts) {
    const o = opts || {};
    ctx.imageSmoothingEnabled = false;
    if (flow.state === 'title') drawTitle(ctx, flow, t);
    else if (flow.state === 'levelSelect') drawLevelSelect(ctx, flow, t);
    else if (flow.state === 'phoneCall') drawPhoneCall(ctx, flow, t);
    else if (flow.state === 'maskSelect') drawMaskSelect(ctx, flow, t, o);
    else if (flow.state === 'results') drawResults(ctx, flow, t);
    drawCursor(ctx, o.cursor);
  }

  HW.screens = { draw, hitTest, layout, PERKS };
})(globalThis.HW);
