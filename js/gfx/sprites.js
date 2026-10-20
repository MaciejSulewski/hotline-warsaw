(function (HW) {
  'use strict';

  // Offscreen-canvas sprites generated at load. Characters are 12×12, top-down, facing +x;
  // the renderer rotates them to the entity's facing.
  const MASK_IDS = ['lajkonik', 'bolek', 'lolek', 'czapka', 'kleks'];
  const CHAR_TYPES = ['player', 'dresiarz', 'bandzior', 'milicjant'];
  const LEVEL_IDS = ['blok', 'pewex', 'komenda'];

  function canvas(w, h, paint) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    paint((color, x, y, rw = 1, rh = 1) => { ctx.fillStyle = color; ctx.fillRect(x, y, rw, rh); }, ctx);
    return c;
  }

  // 1 px dark outline around the opaque pixels (silhouette drawn at 4 offsets underneath).
  function outlined(src) {
    const w = src.width, h = src.height;
    const sil = canvas(w, h, (px, g) => {
      g.drawImage(src, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = HW.palette.ink;
      g.fillRect(0, 0, w, h);
    });
    return canvas(w, h, (px, g) => {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.drawImage(sil, dx, dy);
      g.drawImage(src, 0, 0);
    });
  }

  // Tiny deterministic hash for speckles (sprites look the same every load).
  function hash(a, b, seed) {
    let h = (a * 374761393 + b * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (s) => Math.min(255, Math.round(((n >> s) & 255) + (255 - ((n >> s) & 255)) * amt));
    return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('');
  }

  // frame: 0/1 walk, 2 attack. Shoulders span y, the head sits in the middle, hands in front.
  function character(type, frame) {
    const P = HW.palette, c = P.chars[type];
    const shade = lighten(c.body, 0.25);
    return canvas(12, 12, (px) => {
      // feet peek out in front of / behind the torso
      if (frame === 0) { px(P.shoe, 8, 3, 2, 2); px(P.shoe, 1, 7, 2, 2); }
      else { px(P.shoe, 1, 3, 2, 2); px(P.shoe, 8, 7, 2, 2); }
      // shoulders / torso, lit on the front edge
      px(c.body, 3, 1, 4, 10); px(c.body, 2, 2, 6, 8);
      px(shade, 6, 2, 1, 8);
      // arms + hands
      if (frame === 2) {
        px(c.body, 6, 1, 3, 2); px(c.body, 6, 9, 3, 2);
        px(c.body, 8, 3, 2, 2); px(c.body, 8, 7, 2, 2);
        px(P.skin, 10, 4, 1, 4);
      } else {
        const f = frame === 0 ? 1 : -1;
        px(c.body, 5 + f, 1, 3, 2); px(c.body, 5 - f, 9, 3, 2);
        px(P.skin, 8 + f, 1, 1, 2); px(P.skin, 8 - f, 9, 1, 2);
      }
      // type details
      if (type === 'dresiarz') { px(c.trim, 3, 1, 4, 1); px(c.trim, 3, 10, 4, 1); } // Adidas stripes
      if (type === 'player') { px(c.trim, 2, 2, 1, 8); px(c.trim, 3, 1, 2, 1); px(c.trim, 3, 10, 2, 1); }
      if (type === 'bandzior') { px(c.trim, 4, 2, 2, 1); px(c.trim, 4, 9, 2, 1); }
      if (type === 'milicjant') { px(P.mustard, 3, 2, 2, 1); px(P.mustard, 3, 9, 2, 1); px(c.trim, 2, 3, 1, 6); }
      // round head (4×4 minus corners)
      const head = type === 'player' ? P.skin : c.head;
      px(head, 4, 5, 4, 2); px(head, 5, 4, 2, 4);
      if (type === 'dresiarz') { px(P.skinDark, 4, 5, 1, 2); }
      if (type === 'bandzior') px(P.skin, 7, 5, 1, 2);
      if (type === 'milicjant') { px(P.ink, 8, 4, 1, 4); px(P.mustard, 7, 5, 1, 2); }
    });
  }

  // Head overlays (12×12, same frame as characters), drawn over the player's head.
  function mask(id) {
    const P = HW.palette;
    return canvas(12, 12, (px) => {
      if (id === 'lajkonik') { // Kraków hobby-horse rider: tall gold-red pointed hat
        px('#c0302a', 4, 3, 4, 6); px('#c0302a', 3, 4, 6, 4);
        px(P.mustard, 5, 4, 2, 4); px('#ffd75a', 5, 5, 2, 2); px(P.mustard, 8, 5, 2, 2);
      } else if (id === 'bolek') { // black mop of hair, face forward
        px(P.skin, 5, 4, 3, 4); px('#141414', 3, 3, 4, 6); px('#141414', 4, 2, 2, 8);
        px(P.ink, 7, 4, 1, 1); px(P.ink, 7, 7, 1, 1);
      } else if (id === 'lolek') { // blond hair
        px(P.skin, 5, 4, 3, 4); px('#e8c45a', 3, 3, 4, 6); px('#e8c45a', 4, 2, 2, 8);
        px(P.ink, 7, 4, 1, 1); px(P.ink, 7, 7, 1, 1);
      } else if (id === 'czapka') { // milicja cap with visor and eagle badge
        px('#5d6b78', 3, 3, 5, 6); px('#5d6b78', 4, 2, 3, 8);
        px('#9a2230', 3, 3, 1, 6); px(P.ink, 8, 3, 2, 6); px(P.mustard, 7, 5, 1, 2);
      } else if (id === 'kleks') { // wild ginger hair and beard
        px('#d4602a', 2, 2, 6, 8); px('#d4602a', 3, 1, 4, 10); px('#f08a3a', 3, 3, 2, 2);
        px('#f08a3a', 4, 8, 2, 2); px(P.skin, 6, 4, 2, 4); px(P.ink, 7, 4, 1, 1); px(P.ink, 7, 7, 1, 1);
        px('#d4602a', 8, 4, 1, 4);
      }
    });
  }

  // Weapon icons, 14×6, pointing +x, centred on (7, 3).
  function weapon(id) {
    const P = HW.palette;
    const metal = '#c8c8d0', dark = '#2e2e34', wood = '#7a4a22';
    return canvas(14, 6, (px) => {
      switch (id) {
        case 'fists': px(P.skin, 5, 2, 3, 2); break;
        case 'pipe': px('#6e6e76', 1, 2, 12, 2); px(metal, 1, 2, 12, 1); px(dark, 12, 1, 2, 4); break;
        case 'bat': px(wood, 1, 3, 5, 1); px(wood, 5, 2, 8, 2); px(P.doorLight, 6, 2, 6, 1); break;
        case 'knife': px(dark, 2, 2, 4, 2); px(metal, 6, 2, 6, 2); px(P.white, 6, 2, 5, 1); break;
        case 'pistol': px(dark, 4, 2, 7, 2); px(dark, 4, 2, 2, 4); px('#55555c', 5, 2, 5, 1); break;
        case 'shotgun': px(wood, 0, 2, 5, 3); px(dark, 5, 1, 9, 2); px('#55555c', 5, 3, 9, 1); break;
        case 'ak': px(wood, 0, 2, 4, 2); px(dark, 4, 2, 10, 2); px(P.linoleumBrown, 7, 4, 2, 2); px(wood, 10, 2, 2, 1); break;
        default: px(P.magenta, 4, 2, 6, 2);
      }
    });
  }

  // Corpse (with blood pool) or downed body (lighter, no blood), 16×16, head toward +x.
  function body(type, dead) {
    const P = HW.palette, c = P.chars[type];
    const tint = (col) => (dead ? col : lighten(col, 0.3));
    return canvas(16, 16, (px) => {
      if (dead) {
        px(P.bloodDark, 3, 3, 10, 10); px(P.blood, 2, 5, 12, 6); px(P.blood, 5, 2, 6, 12);
        px(P.blood, 12, 4, 3, 3); px(P.bloodDark, 1, 10, 3, 2);
      }
      px(tint(c.body), 5, 5, 6, 6);                       // torso
      px(tint(c.body), 7, 2, 2, 3); px(tint(c.body), 7, 11, 2, 3); // flung arms
      px(tint(P.skin), 6, 1, 2, 1); px(tint(P.skin), 9, 14, 2, 1);
      px(tint(P.shoe), 1, 5, 4, 2); px(tint(P.shoe), 2, 9, 3, 2);  // legs
      const head = type === 'player' ? P.skin : c.head;
      px(tint(head), 11, 6, 3, 4); px(tint(head), 12, 5, 1, 6);
    });
  }

  function floorTile(level, variant) {
    const F = HW.palette.floor[level];
    return canvas(16, 16, (px) => {
      if (level === 'pewex') { // checkered shop tiles
        for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) px((x + y + variant) % 2 ? F.alt : F.base, x * 8, y * 8, 8, 8);
      } else if (level === 'komenda') { // mustard ceramic grid
        px(variant ? F.alt : F.base, 0, 0, 16, 16);
        px(F.line, 0, 0, 16, 1); px(F.line, 0, 0, 1, 16); px(F.line, 8, 0, 1, 16); px(F.line, 0, 8, 16, 1);
      } else { // linoleum planks with grain
        px(variant ? F.alt : F.base, 0, 0, 16, 16);
        px(F.line, 0, 15, 16, 1);
        for (let i = 0; i < 6; i++) px(F.line, Math.floor(hash(i, variant, 3) * 15), Math.floor(hash(variant, i, 5) * 15), 2, 1);
      }
    });
  }

  function tiles() {
    const P = HW.palette;
    const floor = {};
    for (const l of LEVEL_IDS) floor[l] = [floorTile(l, 0), floorTile(l, 1)];
    return {
      floor,
      carpet: canvas(16, 16, (px) => {
        px(P.carpet, 0, 0, 16, 16);
        for (let y = 2; y < 16; y += 4) for (let x = (y % 8 === 2 ? 2 : 0); x < 16; x += 4) px(P.carpetLight, x, y, 2, 1);
        px(P.mustard, 0, 0, 16, 1);
      }),
      wall: canvas(16, 16, (px) => {
        px(P.concrete, 0, 0, 16, 16);
        for (let i = 0; i < 14; i++) {
          px(hash(i, 1, 9) > 0.5 ? P.concreteLight : P.concreteDark, Math.floor(hash(i, 2, 9) * 16), Math.floor(hash(i, 3, 9) * 16));
        }
        px(P.concreteDark, 0, 8, 16, 1); px(P.concreteDark, 8, 0, 1, 8); // slab seams
      }),
      window: canvas(16, 16, (px) => {
        px(P.frame, 0, 0, 16, 16); px(P.glass, 1, 3, 14, 10);
        px(P.glassLight, 2, 4, 5, 1); px(P.glassLight, 2, 5, 2, 1); px(P.frame, 7, 3, 2, 10);
      }),
      stairs: canvas(16, 16, (px) => {
        for (let i = 0; i < 4; i++) { px(P.concreteLight, 0, i * 4, 16, 3); px(P.concreteDark, 0, i * 4 + 3, 16, 1); }
      }),
      car: canvas(30, 16, (px) => { // Fiat 126p "maluch", top-down, nose to +x
        px(P.ink, 1, 1, 28, 14);
        px('#c8a020', 2, 1, 26, 14); px('#e6c040', 3, 2, 24, 3);
        px(P.glass, 17, 3, 5, 10); px(P.glass, 6, 3, 3, 10); px('#b08a18', 9, 3, 8, 10);
        px(P.shoe, 4, 0, 4, 1); px(P.shoe, 21, 0, 4, 1); px(P.shoe, 4, 15, 4, 1); px(P.shoe, 21, 15, 4, 1);
        px(P.flash, 28, 3, 1, 2); px(P.flash, 28, 11, 1, 2);
      }),
    };
  }

  function build() {
    const chars = {}, corpses = {}, downed = {}, masks = {}, weapons = {};
    for (const t of CHAR_TYPES) {
      chars[t] = [0, 1, 2].map((f) => outlined(character(t, f)));
      corpses[t] = body(t, true);
      if (t !== 'player') downed[t] = body(t, false);
    }
    for (const m of MASK_IDS) masks[m] = mask(m);
    for (const w of Object.keys(HW.weapons)) weapons[w] = outlined(weapon(w));
    return { chars, corpses, downed, masks, weapons, tiles: tiles() };
  }

  HW.sprites = { build, canvas, lighten };
})(globalThis.HW);
