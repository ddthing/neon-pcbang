(() => {
  "use strict";

  // 100% pure-pixel tile & sprite generator (Kairosoft / Stardew 4-tone hue-shifted palette)
  const PAL = {
    // Outlines & shadows (warm plum-ink, never sterile black)
    k: "#261c29",
    s: "#3b2c3f",
    d: "#563f54",
    v: "#775e78",
    // Warm wood (4 tones: dark -> shadow -> base -> highlight)
    w0: "#633c41",
    w1: "#85524f",
    w2: "#a86c5e",
    w3: "#c48870",
    w4: "#dfb08f",
    // Cream / Paper / Warm Ceramic
    p0: "#cfb097",
    p1: "#ebd2b5",
    p2: "#ffe6c4",
    p3: "#fff5e2",
    // Cool Slate / Steel / Terrazzo
    c0: "#2c3648",
    c1: "#45536b",
    c2: "#62758f",
    c3: "#899db3",
    c4: "#b6c7d4",
    // Tech Screens & Aqua LED
    t0: "#1b2b38",
    t1: "#294859",
    t2: "#44838a",
    t3: "#76c4bc",
    t4: "#baf2df",
    // Foliage Greens (4 hue-shifted olive -> emerald -> sun-tip)
    g0: "#283f3d",
    g1: "#3d6352",
    g2: "#648f6b",
    g3: "#8eb57a",
    g4: "#bfd48c",
    // Terracotta / Coral / Berry / Gold Accents
    r0: "#6e323c",
    r1: "#9e4b4c",
    r2: "#cc6c5c",
    r3: "#eb9a7c",
    y1: "#c98542",
    y2: "#e8b15d",
    y3: "#ffdf85",
  };

  const cache = new Map();

  function parseMatrix(rows, overrides = null) {
    const h = rows.length;
    const w = Math.max(...rows.map((r) => r.trim().split(/\s+/).length));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    const pal = overrides ? { ...PAL, ...overrides } : PAL;
    for (let y = 0; y < h; y++) {
      const tokens = rows[y].trim().split(/\s+/);
      for (let x = 0; x < tokens.length; x++) {
        const tok = tokens[x];
        if (tok === "." || tok === "..") continue;
        const col = pal[tok] || (tok.startsWith("#") ? tok : null);
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return canvas;
  }

  function getCached(key, builder) {
    if (!cache.has(key)) cache.set(key, builder());
    return cache.get(key);
  }

  // Bayer 4x4 threshold matrix for crisp ordered pixel dithering
  const BAYER4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];

  function drawDitherGlow(ctx, cx, cy, rx, ry, color, peakAlpha = 0.24) {
    const x0 = Math.floor(cx - rx);
    const y0 = Math.floor(cy - ry);
    const x1 = Math.ceil(cx + rx);
    const y1 = Math.ceil(cy + ry);
    ctx.fillStyle = color;
    ctx.save();
    for (let y = y0; y <= y1; y++) {
      const dy = (y - cy) / ry;
      for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) / rx;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= 1) continue;
        const level = Math.pow(1 - dist, 1.45);
        const threshold = (BAYER4[(y & 3)][(x & 3)] + 0.5) / 16;
        if (level > threshold) {
          ctx.globalAlpha = peakAlpha * (level > 0.65 ? 1 : 0.65);
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    ctx.restore();
  }

  // Procedural multi-tone wood floor tile pattern (4 staggered planks per 64x36 pattern)
  function buildWoodPattern(night) {
    return getCached(`wood-${night ? "n" : "d"}`, () => {
      const w = 72;
      const h = 36;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      const tones = night
        ? ["#8c554f", "#965d53", "#824d4a", "#9f6457", "#8a534c"]
        : ["#a86c5e", "#b37664", "#9c6258", "#bb7f6b", "#a3685a"];
      const seam = night ? "#663c42" : "#7d4949";
      const bevel = night ? "#aa7060" : "#c78b73";
      const grainDark = night ? "#7a4946" : "#91584f";
      ctx.fillStyle = tones[0];
      ctx.fillRect(0, 0, w, h);
      const rowH = 12;
      for (let r = 0; r < 3; r++) {
        const y = r * rowH;
        const offset = (r * 24) % w;
        const segW = 36;
        for (let s = -2; s < 3; s++) {
          const x = s * segW + offset;
          const idx = Math.abs(r * 7 + s * 11) % tones.length;
          ctx.fillStyle = tones[idx];
          ctx.fillRect(x, y, segW, rowH);
          // Top plank bevel highlight
          ctx.fillStyle = bevel;
          ctx.fillRect(x + 1, y + 1, segW - 2, 1);
          // Horizontal wood grain flecks
          ctx.fillStyle = grainDark;
          ctx.fillRect(x + 6 + ((r * 3) % 7), y + 4, 8, 1);
          ctx.fillRect(x + 18 - (Math.abs(s) & 1) * 5, y + 8, 10, 1);
          if ((r + Math.abs(s)) % 2 === 0) {
            ctx.fillStyle = bevel;
            ctx.fillRect(x + 12, y + 6, 5, 1);
          }
          // Crisp staggered plank seam & subtle nail dots
          ctx.fillStyle = seam;
          ctx.fillRect(x, y, 1, rowH);
          ctx.fillRect(x, y + rowH - 1, segW, 1);
          ctx.fillStyle = grainDark;
          ctx.fillRect(x + 2, y + 2, 1, 1);
          ctx.fillRect(x + 2, y + rowH - 3, 1, 1);
        }
      }
      return c;
    });
  }

  function buildStonePattern(night) {
    return getCached(`stone-${night ? "n" : "d"}`, () => {
      const s = 32;
      const c = document.createElement("canvas");
      c.width = s;
      c.height = s;
      const ctx = c.getContext("2d");
      const a = night ? "#404d66" : "#566680";
      const b = night ? "#485673" : "#61738f";
      const grout = night ? "#2b354a" : "#3a475e";
      const hi = night ? "#5d6e8c" : "#7e91ab";
      for (let ty = 0; ty < 2; ty++) {
        for (let tx = 0; tx < 2; tx++) {
          const x = tx * 16;
          const y = ty * 16;
          ctx.fillStyle = (tx + ty) % 2 === 0 ? a : b;
          ctx.fillRect(x, y, 16, 16);
          ctx.fillStyle = hi;
          ctx.fillRect(x + 1, y + 1, 13, 1);
          ctx.fillRect(x + 1, y + 1, 1, 12);
          ctx.fillStyle = grout;
          ctx.fillRect(x, y + 15, 16, 1);
          ctx.fillRect(x + 15, y, 1, 16);
          // Subtle terrazzo mineral flecks
          ctx.fillStyle = hi;
          ctx.fillRect(x + 5 + tx * 2, y + 5, 1, 1);
          ctx.fillRect(x + 10, y + 10 - ty * 2, 1, 1);
          ctx.fillStyle = grout;
          ctx.fillRect(x + 9 - tx, y + 6, 1, 1);
        }
      }
      return c;
    });
  }

  function paintWoodFloor(ctx, x, y, w, h, night = false) {
    const patCanvas = buildWoodPattern(night);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    const pat = ctx.createPattern(patCanvas, "repeat");
    ctx.fillStyle = pat;
    ctx.translate(x, y);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function paintStoneFloor(ctx, x, y, w, h, night = false) {
    const patCanvas = buildStonePattern(night);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    const pat = ctx.createPattern(patCanvas, "repeat");
    ctx.fillStyle = pat;
    ctx.translate(x, y);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // Pixel-matrix Plant Sprites (Stardew broadleaf, trailing pothos, tabletop palm)
  const BROADLEAF_ROWS = [
    ".  .  .  .  .  .  .  g0 g0 g0 .  .  .  .  .  .  .  .  .  .",
    ".  .  .  .  .  .  g0 g4 g3 g2 g0 .  .  .  .  .  .  .  .  .",
    ".  .  .  g0 g0 .  g0 g3 g3 g2 g0 .  g0 g0 g0 .  .  .  .  .",
    ".  .  g0 g4 g3 g0 g0 g2 g1 g1 g0 g0 g4 g3 g2 g0 .  .  .  .",
    ".  g0 g3 g3 g2 g2 g0 .  g1 .  g0 g3 g3 g2 g1 g0 .  .  .  .",
    ".  g0 g2 g1 g1 g0 .  .  g1 .  g0 g2 g1 g1 g0 .  .  .  .  .",
    ".  .  g0 g0 g0 .  g0 g0 g1 g0 g0 .  g0 g0 .  .  .  .  .  .",
    ".  .  .  .  g0 g3 g4 g3 g1 g3 g3 g0 .  .  .  .  .  .  .  .",
    ".  .  .  g0 g3 g2 g2 g1 g1 g2 g1 g0 .  .  .  .  .  .  .  .",
    ".  .  .  .  g0 g0 g1 g0 g0 g0 g0 .  .  .  .  .  .  .  .  .",
    ".  .  .  .  .  k  k  k  k  k  k  k  k  k  k  .  .  .  .  .",
    ".  .  .  .  k  r3 r3 r2 r2 r2 r2 r1 r1 r1 r2 k  .  .  .  .",
    ".  .  .  .  k  r0 r0 r0 r0 r0 r0 r0 r0 r0 r0 k  .  .  .  .",
    ".  .  .  .  .  k  r3 r2 r2 r2 r1 r1 r1 r0 k  .  .  .  .  .",
    ".  .  .  .  .  k  r3 r2 r2 r1 r1 r1 r0 r0 k  .  .  .  .  .",
    ".  .  .  .  .  k  r2 r2 r1 r1 r1 r0 r0 r0 k  .  .  .  .",
    ".  .  .  .  .  .  k  r2 r1 r1 r0 r0 r0 k  .  .  .  .  .  .",
    ".  .  .  .  .  .  k  k  k  k  k  k  k  k  .  .  .  .  .  .",
  ];

  const POTHOS_ROWS = [
    ".  .  .  .  .  g0 g0 .  .  .  g0 g0 .  .  .  .",
    ".  .  .  .  g0 g4 g3 g0 .  g0 g3 g4 g0 .  .  .",
    ".  .  .  g0 g3 g2 g1 g0 g0 g2 g2 g3 g0 .  .  .",
    ".  g0 g0 g0 g1 g1 .  g1 g1 .  g1 g0 g0 g0 .  .",
    "g0 g4 g3 g2 g0 .  k  k  k  k  k  g2 g3 g4 g0 .",
    "g0 g2 g1 g0 k  v  v  v  d  d  d  k  g1 g2 g0 .",
    ".  g0 g0 .  k  p1 p0 v  v  d  d  k  .  g0 .  .",
    ".  .  .  .  k  p1 v  v  d  d  d  k  .  .  .  .",
    ".  .  .  .  .  k  v  v  d  d  k  .  .  .  .  .",
    ".  .  .  g0 g0 k  v  d  d  s  k  g0 g0 .  .  .",
    ".  .  g0 g3 g2 k  k  k  k  k  k  g2 g3 g0 .  .",
    ".  .  g0 g1 g0 .  .  .  .  .  .  g0 g1 g0 .  .",
  ];

  const PALM_ROWS = [
    ".  .  .  g0 g0 .  .  g0 g0 .  .  g0 g0 .  .  .",
    ".  .  g0 g4 g3 g0 .  g4 g3 g0 .  g3 g4 g0 .  .",
    ".  g0 g3 g2 g1 g0 g0 g3 g2 g0 g0 g2 g3 g0 .  .",
    ".  .  .  g0 g1 g2 g1 g2 g1 g2 g1 g0 .  .  .  .",
    ".  .  .  .  k  k  k  k  k  k  k  k  .  .  .  .",
    ".  .  .  k  c4 c3 c3 c2 c2 c2 c1 c1 k  .  .  .",
    ".  .  .  k  c3 c2 c2 c1 c1 c1 c0 c0 k  .  .  .",
    ".  .  .  .  k  c2 c1 c1 c0 c0 c0 k  .  .  .  .",
    ".  .  .  .  .  k  k  k  k  k  k  .  .  .  .  .",
  ];

  // Self-service Kiosk (18x28 scaled 2x crisp pixel sprite = 36x56 logical)
  const KIOSK_ROWS = [
    ".  .  k  k  k  k  k  k  k  k  k  k  k  k  k  k  .  .",
    ".  k  c4 c4 c3 c3 c3 c3 c3 c3 c3 c3 c3 c2 c2 c1 k  .",
    ".  k  c3 c1 t0 t0 t0 t0 t0 t0 t0 t0 t0 t0 c1 c1 k  .",
    ".  k  c3 t0 t1 t1 t1 t1 t1 t1 t1 t1 t1 t1 t0 c1 k  .",
    ".  k  c3 t0 t1 t3 t3 t3 t1 t4 t4 t1 t2 t1 t0 c1 k  .",
    ".  k  c3 t0 t1 t3 t3 t3 t1 t4 t4 t1 t2 t1 t0 c1 k  .",
    ".  k  c3 t0 t1 t1 t1 t1 t1 t1 t1 t1 t1 t1 t0 c1 k  .",
    ".  k  c3 t0 t1 t2 t2 t1 t3 t3 t1 t3 t3 t3 t0 c1 k  .",
    ".  k  c3 t0 t1 t1 t1 t1 t1 t1 t1 t1 t1 t1 t0 c1 k  .",
    ".  k  c3 c1 t0 t0 t0 t0 t0 t0 t0 t0 t0 t0 c1 c1 k  .",
    ".  k  c3 c3 c2 c2 c2 y2 y3 y2 c2 c2 c2 c1 c1 c0 k  .",
    ".  k  c2 c2 c2 c2 c2 c2 c2 c2 c2 c2 c2 c1 c1 c0 k  .",
    ".  .  k  k  c2 c2 c1 t0 t0 t0 t0 c1 c1 c0 k  k  .  .",
    ".  .  .  .  k  c2 c1 c1 c1 c1 c1 c1 c0 k  .  .  .  .",
    ".  .  .  .  k  c2 c2 c1 c1 c1 c0 c0 c0 k  .  .  .  .",
    ".  .  .  .  k  c2 c1 c1 k  k  c0 c0 c0 k  .  .  .  .",
    ".  .  .  .  k  c1 c1 c1 c1 c1 c0 c0 c0 k  .  .  .  .",
    ".  .  k  k  c3 c3 c2 c2 c2 c1 c1 c1 c0 c0 k  k  .  .",
    ".  k  c4 c3 c2 c2 c2 c2 c1 c1 c1 c0 c0 c0 c0 c0 k  .",
    ".  k  k  k  k  k  k  k  k  k  k  k  k  k  k  k  k  .",
  ];

  function paintSpriteScaled(ctx, spriteKey, rows, overrides, x, y, pixelScale = 2) {
    const spr = getCached(spriteKey, () => parseMatrix(rows, overrides));
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spr, Math.round(x), Math.round(y), spr.width * pixelScale, spr.height * pixelScale);
    ctx.restore();
  }

  function paintPlant(ctx, cx, bottomY, variant = 0, night = false) {
    const scale = 2;
    const rows = variant === 2 ? PALM_ROWS : variant === 1 ? POTHOS_ROWS : BROADLEAF_ROWS;
    const spr = getCached(`plant-v${variant}`, () => parseMatrix(rows, null));
    const w = spr.width * scale;
    const h = spr.height * scale;
    const x = Math.round(cx - w / 2);
    const y = Math.round(bottomY - h);
    ctx.save();
    ctx.fillStyle = "rgba(38, 28, 41, 0.34)";
    ctx.fillRect(Math.round(cx - 14), Math.round(bottomY - 3), 28, 5);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spr, x, y, w, h);
    if (night) {
      ctx.fillStyle = "rgba(25, 22, 46, 0.14)";
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  }

  function paintKiosk(ctx, x, y) {
    const spr = getCached("kiosk-base", () => parseMatrix(KIOSK_ROWS, null));
    const w = spr.width * 2;
    const h = spr.height * 2;
    ctx.save();
    ctx.fillStyle = "rgba(38, 28, 41, 0.35)";
    ctx.fillRect(Math.round(x + 2), Math.round(y + h - 3), w - 4, 6);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spr, Math.round(x), Math.round(y), w, h);
    ctx.restore();
  }

  // Pixel PC Desk + Mechanical Keyboard + Mouse + Gaming Monitor + Tower + Chair
  function paintDeskSet(ctx, seat, night) {
    const { x, y, direction, key } = seat;
    const side = direction !== "up";
    const sign = direction === "left" ? -1 : 1;
    const center = side ? Math.round(x + sign * 20) : x;
    const front = side ? y - 4 : y - 33;
    const width = side ? 39 : 111;
    const left = center - Math.floor(width / 2);
    const depth = side ? 23 : 36;
    const right = left + width;

    // Grounded contact shadow under desk legs
    ctx.fillStyle = "rgba(38, 28, 41, 0.28)";
    ctx.fillRect(left + 3, front + 12, width - 6, 4);

    // Desk apron & carved legs
    ctx.fillStyle = PAL.k;
    ctx.fillRect(left + 1, front - 4, width - 2, 18);
    ctx.fillStyle = PAL.w1;
    ctx.fillRect(left + 2, front - 3, width - 4, 15);
    // Leg posts with highlight edge
    ctx.fillStyle = PAL.w0;
    ctx.fillRect(left + 4, front + 4, 7, 9);
    ctx.fillRect(right - 11, front + 4, 7, 9);
    ctx.fillStyle = PAL.w2;
    ctx.fillRect(left + 5, front + 5, 2, 7);
    ctx.fillRect(right - 10, front + 5, 2, 7);

    // Desk surface top with 4-tone wood grain & rounded pixel bevel
    ctx.fillStyle = PAL.k;
    ctx.fillRect(left, front - depth, width, depth + 2);
    ctx.fillStyle = PAL.w3;
    ctx.fillRect(left + 1, front - depth + 1, width - 2, depth);
    // Top-edge chamfer highlight + front edge warm trim
    ctx.fillStyle = PAL.w4;
    ctx.fillRect(left + 2, front - depth + 2, width - 4, 2);
    ctx.fillStyle = PAL.p1;
    ctx.fillRect(left + 2, front - 2, width - 4, 2);
    ctx.fillStyle = PAL.w2;
    ctx.fillRect(left + 2, front - 4, width - 4, 2);
    // Subtle wood plank grain marks on desk surface
    ctx.fillStyle = PAL.w2;
    ctx.fillRect(left + 8, front - depth + 8, 12, 1);
    ctx.fillRect(right - 22, front - depth + 11, 10, 1);
    if (!side) {
      // Stitched RGB/charcoal desk mat under keyboard & mouse
      ctx.fillStyle = PAL.k;
      ctx.fillRect(x - 27, front - depth + 14, 54, 15);
      ctx.fillStyle = PAL.c0;
      ctx.fillRect(x - 26, front - depth + 15, 52, 13);
      ctx.fillStyle = PAL.t2;
      ctx.fillRect(x - 26, front - depth + 27, 52, 1);
    }

    // Monitor with metallic bezel, stand neck & indicator LED
    const mx = side ? center + sign * 4 - 11 : center - 26;
    const my = front - depth - (side ? 6 : 22);
    const mw = side ? 22 : 52;
    const mh = side ? 17 : 34;
    ctx.fillStyle = PAL.k;
    ctx.fillRect(mx - 1, my - 1, mw + 2, mh + 2);
    ctx.fillStyle = PAL.c2;
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = PAL.c3;
    ctx.fillRect(mx + 1, my + 1, mw - 2, 1);
    ctx.fillStyle = PAL.c1;
    ctx.fillRect(mx + 1, my + mh - 2, mw - 2, 1);
    ctx.fillStyle = PAL.t0;
    ctx.fillRect(mx + 3, my + 3, mw - 6, mh - 7);
    ctx.fillStyle = PAL.t3;
    ctx.fillRect(mx + mw - 5, my + mh - 2, 2, 1);
    // Monitor stand neck + pedestal foot
    ctx.fillStyle = PAL.c0;
    ctx.fillRect(mx + Math.floor(mw / 2) - 4, my + mh + 1, 8, 4);
    ctx.fillStyle = PAL.c2;
    ctx.fillRect(mx + Math.floor(mw / 2) - 7, my + mh + 4, 14, 2);

    // Mechanical Keyboard (individual keycap row texture)
    const kx = side ? x + (sign === 1 ? 1 : -22) : x - 21;
    const ky = side ? front - 8 : y - 38;
    const kw = side ? 21 : 40;
    ctx.fillStyle = PAL.k;
    ctx.fillRect(kx, ky, kw, 8);
    ctx.fillStyle = PAL.c1;
    ctx.fillRect(kx + 1, ky + 1, kw - 2, 6);
    for (let dx = 2; dx < kw - 2; dx += 3) {
      ctx.fillStyle = PAL.p2;
      ctx.fillRect(kx + dx, ky + 2, 2, 2);
      ctx.fillStyle = dx === Math.floor(kw / 2) - 1 ? PAL.r3 : PAL.p1;
      ctx.fillRect(kx + dx, ky + 5, 2, 1);
    }

    // Gaming Mouse + RGB/Wood Tower + Ceramic Mug
    if (side) {
      ctx.fillStyle = PAL.k;
      ctx.fillRect(center + sign * 10 - 3, front - 8, 6, 7);
      ctx.fillStyle = PAL.p2;
      ctx.fillRect(center + sign * 10 - 2, front - 7, 4, 5);
      // Side PC Tower
      const tx = center + sign * 12 - 5;
      ctx.fillStyle = PAL.k;
      ctx.fillRect(tx, my - 2, 10, 19);
      ctx.fillStyle = PAL.c1;
      ctx.fillRect(tx + 1, my - 1, 8, 17);
      ctx.fillStyle = night ? PAL.t3 : PAL.y3;
      ctx.fillRect(tx + 3, my + 2, 4, 4);
      ctx.fillRect(tx + 3, my + 8, 4, 4);
    } else {
      // Mouse
      ctx.fillStyle = PAL.k;
      ctx.fillRect(x + 17, front - depth + 16, 7, 9);
      ctx.fillStyle = PAL.p2;
      ctx.fillRect(x + 18, front - depth + 17, 5, 7);
      ctx.fillStyle = PAL.t3;
      ctx.fillRect(x + 20, front - depth + 18, 1, 2);
      // Coaster + mug on left corner
      ctx.fillStyle = PAL.w1;
      ctx.fillRect(left + 8, front - depth + 18, 8, 7);
      ctx.fillStyle = PAL.p3;
      ctx.fillRect(left + 9, front - depth + 17, 6, 6);
      ctx.fillStyle = PAL.w0;
      ctx.fillRect(left + 10, front - depth + 18, 4, 2);
      // Tempered-glass Gaming PC Tower on right
      const pcX = x + 31;
      const pcY = my + 5;
      ctx.fillStyle = PAL.k;
      ctx.fillRect(pcX, pcY, 18, 32);
      ctx.fillStyle = PAL.c1;
      ctx.fillRect(pcX + 1, pcY + 1, 16, 30);
      ctx.fillStyle = PAL.t0;
      ctx.fillRect(pcX + 3, pcY + 4, 12, 16);
      ctx.fillStyle = night ? PAL.t3 : PAL.t2;
      ctx.fillRect(pcX + 5, pcY + 6, 8, 5);
      ctx.fillRect(pcX + 5, pcY + 13, 8, 5);
      ctx.fillStyle = PAL.r3;
      ctx.fillRect(pcX + 4, pcY + 25, 3, 2);
    }

    // Gaming Chair base (cushion + 5-star caster legs behind character)
    const even = Number(key.split(":")[1]) % 2 === 0;
    const chairCol = even ? PAL.c2 : PAL.d;
    const chairHi = even ? PAL.c3 : PAL.v;
    ctx.fillStyle = "rgba(38, 28, 41, 0.3)";
    ctx.fillRect(x - 13, y + 3, 26, 5);
    ctx.fillStyle = PAL.c0;
    ctx.fillRect(x - 9, y, 18, 3);
    ctx.fillRect(x - 2, y - 7, 4, 9);
    // Cushioned seat pan
    ctx.fillStyle = PAL.k;
    ctx.fillRect(x - 12, y - 14, 24, 11);
    ctx.fillStyle = chairCol;
    ctx.fillRect(x - 11, y - 13, 22, 9);
    ctx.fillStyle = chairHi;
    ctx.fillRect(x - 10, y - 13, 20, 2);

    return { key, x: mx + 3, y: my + 3, w: mw - 6, h: mh - 7 };
  }

  // Sculpted Racing/Cozy Chair Backrest (foreground depth element when seated)
  function paintChairFront(ctx, w, h, key) {
    const even = Number(key.split(":")[1]) % 2 === 0;
    const body = even ? PAL.c2 : PAL.d;
    const hi = even ? PAL.c3 : PAL.v;
    const sh = even ? PAL.c1 : PAL.s;
    const strap = even ? PAL.p1 : PAL.r3;

    // Headrest top crown
    ctx.fillStyle = PAL.k;
    ctx.fillRect(3, 0, w - 6, h - 4);
    // Backrest wing bolsters
    ctx.fillRect(0, 5, w, h - 6);
    ctx.fillStyle = body;
    ctx.fillRect(4, 1, w - 8, h - 6);
    ctx.fillRect(1, 6, w - 2, h - 9);
    // Lumbar/headrest cushion & stitch detail
    ctx.fillStyle = hi;
    ctx.fillRect(4, 2, w - 8, 3);
    ctx.fillStyle = strap;
    ctx.fillRect(5, 5, w - 10, 2);
    // Side bolster shading
    ctx.fillStyle = hi;
    ctx.fillRect(2, 8, 2, h - 13);
    ctx.fillStyle = sh;
    ctx.fillRect(w - 4, 8, 2, h - 13);
    ctx.fillRect(2, h - 5, w - 4, 3);
  }

  // Tufted Lounge Sofa
  function paintCouch(ctx, x, y, w, berry = false) {
    const fill = berry ? PAL.d : PAL.r2;
    const hi = berry ? PAL.v : PAL.r3;
    const sh = berry ? PAL.s : PAL.r1;
    const h = 34;
    ctx.fillStyle = "rgba(38, 28, 41, 0.3)";
    ctx.fillRect(x + 2, y + 4, w, h - 2);
    ctx.fillStyle = PAL.k;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fill;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    // Rolled back & armrests
    ctx.fillStyle = hi;
    ctx.fillRect(x + 3, y + 2, w - 6, 7);
    ctx.fillStyle = PAL.k;
    ctx.fillRect(x + 6, y + 11, w - 12, 16);
    for (let dx = 7; dx < w - 14; dx += 20) {
      ctx.fillStyle = fill;
      ctx.fillRect(x + dx, y + 12, 18, 14);
      ctx.fillStyle = hi;
      ctx.fillRect(x + dx + 1, y + 12, 16, 2);
      ctx.fillStyle = sh;
      ctx.fillRect(x + dx + 1, y + 24, 16, 2);
    }
    ctx.fillStyle = sh;
    ctx.fillRect(x + 2, y + h - 4, w - 4, 2);
  }

  // Open Kitchen Fridge, Cooking Station, Snack Cabinet & Counter
  function paintFridge(ctx, x, y) {
    const w = 36, h = 60;
    ctx.fillStyle = PAL.k;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = PAL.c2;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = PAL.t0;
    ctx.fillRect(x + 4, y + 4, w - 8, 44);
    ctx.fillStyle = PAL.t3;
    ctx.fillRect(x + 5, y + 5, w - 10, 2);
    const drinks = [PAL.r3, PAL.g3, PAL.c3, PAL.y3, PAL.r2, PAL.t3];
    for (let row = 0; row < 3; row++) {
      const sy = y + 16 + row * 14;
      for (let i = 0; i < 5; i++) {
        const bx = x + 6 + i * 5;
        const col = drinks[(i + row * 2) % drinks.length];
        ctx.fillStyle = PAL.p3;
        ctx.fillRect(bx + 1, sy - 9, 2, 2);
        ctx.fillStyle = col;
        ctx.fillRect(bx, sy - 7, 4, 7);
        ctx.fillStyle = PAL.p2;
        ctx.fillRect(bx + 1, sy - 5, 2, 2);
      }
      ctx.fillStyle = PAL.c3;
      ctx.fillRect(x + 5, sy, w - 10, 2);
    }
    // Chrome handle
    ctx.fillStyle = PAL.p3;
    ctx.fillRect(x + w - 8, y + 20, 2, 14);
    ctx.fillStyle = PAL.c1;
    ctx.fillRect(x + 4, y + 50, w - 8, 7);
  }

  function paintCookingRange(ctx, x, y) {
    ctx.fillStyle = PAL.k;
    ctx.fillRect(x, y, 40, 30);
    ctx.fillStyle = PAL.c2;
    ctx.fillRect(x + 1, y + 1, 38, 28);
    ctx.fillStyle = PAL.c0;
    ctx.fillRect(x + 3, y + 3, 34, 18);
    for (const bx of [x + 6, x + 22]) {
      ctx.fillStyle = PAL.v;
      ctx.fillRect(bx, y + 5, 12, 12);
      // Brass ramen pot + glowing heat ring
      ctx.fillStyle = PAL.y2;
      ctx.fillRect(bx + 2, y + 6, 8, 8);
      ctx.fillStyle = PAL.y3;
      ctx.fillRect(bx + 3, y + 7, 6, 2);
      ctx.fillStyle = PAL.r2;
      ctx.fillRect(bx + 3, y + 10, 6, 3);
    }
    ctx.fillStyle = PAL.c4;
    ctx.fillRect(x + 4, y + 24, 32, 3);
    ctx.fillStyle = PAL.y3;
    ctx.fillRect(x + 9, y + 24, 3, 3);
    ctx.fillRect(x + 25, y + 24, 3, 3);
  }

  function paintCabinet(ctx, x, y, w, h) {
    ctx.fillStyle = PAL.k;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = PAL.w1;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = PAL.s;
    ctx.fillRect(x + 4, y + 5, w - 8, h - 10);
    const items = [PAL.y3, PAL.r3, PAL.g3, PAL.c4];
    for (let sy = y + 9; sy < y + h - 10; sy += 18) {
      for (let sx = x + 6; sx < x + w - 12; sx += 11) {
        const tint = items[(sx + sy) % items.length];
        ctx.fillStyle = PAL.k;
        ctx.fillRect(sx, sy, 9, 10);
        ctx.fillStyle = tint;
        ctx.fillRect(sx + 1, sy + 1, 7, 8);
        ctx.fillStyle = PAL.p3;
        ctx.fillRect(sx + 2, sy + 2, 5, 2);
      }
      ctx.fillStyle = PAL.w3;
      ctx.fillRect(x + 4, sy + 10, w - 8, 3);
    }
  }

  window.cafePixelTiles = {
    PAL,
    drawDitherGlow,
    paintWoodFloor,
    paintStoneFloor,
    paintPlant,
    paintKiosk,
    paintDeskSet,
    paintChairFront,
    paintCouch,
    paintFridge,
    paintCookingRange,
    paintCabinet,
  };
})();
