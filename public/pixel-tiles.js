(() => {
  "use strict";

  const TILE = 16;
  const PAL = {
    k: "#5c4742", s: "#6b5b7b", d: "#a08caa", v: "#c8b6e2",
    w1: "#a67e68", w3: "#d4b092", p0: "#ddc7b7", p1: "#ebd6c7",
    p2: "#f7efe5", p3: "#fff7ed", c1: "#9486aa", c2: "#aaa0bd",
    c3: "#d6cee4", c4: "#e5dcef", t0: "#665771", t1: "#807e96",
    t2: "#8cb2ac", t3: "#acd1bf", t4: "#d1e8d8", g2: "#9bb9a6",
    g3: "#b5d5be", g4: "#d3e8c4", r1: "#bd8299", r3: "#f4c2d7",
    y2: "#e9b9a0", y3: "#f6d2b6",
  };
  const sources = {};
  const sourcePixels = new WeakMap();
  const tintedSheets = new Map();
  let catalog;

  function loadImage(key, path) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        sources[key] = image;
        resolve();
      };
      image.onerror = () => reject(new Error("에셋을 불러올 수 없습니다: " + path));
      image.src = "./assets/" + path;
    });
  }

  const images = {
    objects: "downtown/sprites/objects.png",
    fronts: "downtown/sprites/seat_fronts.png",
    floors: "downtown/tiles/floors.png",
    walls: "downtown/tiles/wallface.png",
    cap: "downtown/tiles/wallcap.png",
    window: "downtown/anim/window_N.png",
    door: "downtown/anim/door_N.png",
    steam: "downtown/anim/steam.png",
    stove: "downtown/anim/stove_on_S.png",
    neon_open: "downtown/anim/neon_open.png",
    rain: "fx/overlays/rain_light_strip.png",
    storm: "fx/overlays/rain_heavy_strip.png",
    snow: "fx/overlays/snow_strip.png",
    leaves: "fx/overlays/leaves_strip.png",
    workstations: "original/workstations.png",
    partitions: "original/partitions.png",
    skyline: "original/skyline.png",
  };
  const displayFoods = [
    "soda_coke", "soda_pepsi", "soda_fanta", "soda_sprite",
    "cake_strawberry", "cake_matcha", "cake_cheese", "cake_chocolate",
    "pastry_bread", "pastry_croissant", "pastry_brioche", "pastry_pretzel",
    "onigiri_1", "onigiri_3", "onigiri_5", "boba_taro", "boba_matcha",
    "boba_strawberry", "coffee_foam", "fruit_strawberry", "jam_peach",
  ];
  const ready = Promise.all([
    fetch("./assets/downtown/catalog.json").then((response) => {
      if (!response.ok) throw new Error("Downtown 에셋 카탈로그를 불러올 수 없습니다.");
      return response.json();
    }).then((data) => { catalog = data; }),
    ...Object.entries(images).map(([key, path]) => loadImage(key, path)),
    ...displayFoods.map((key) => loadImage(key, "foods/" + key + ".png")),
  ]);

  const ramps = {
    floor: ["#c9ae97", "#dcc7b4", "#f5e5d2"],
    margin: ["#ddd0be", "#e5d7c7", "#eee1d1"],
    wood: [PAL.k, "#ba8e73", "#eed2b2"],
    cream: [PAL.k, "#cbb5a4", PAL.p2],
    lavender: [PAL.s, "#aa98c1", "#e7dafa"],
    rose: [PAL.k, "#cb93ae", "#f6d6e4"],
    mint: [PAL.k, "#96b9a6", "#d5ebdc"],
  };
  const rgbRamps = Object.fromEntries(Object.entries(ramps).map(([tone, colors]) => [tone, colors.map(color =>
    [1, 3, 5].map(offset => Number.parseInt(color.slice(offset, offset + 2), 16)))]));
  const snap = (value) => Math.round(value / TILE) * TILE;

  function tintedSheet(image, tone, night) {
    if (tone === "authored" && !night) return sources[image];
    const key = image + ":" + tone + ":" + night;
    const cached = tintedSheets.get(key);
    if (cached) return cached;
    const source = sources[image];
    const sheet = document.createElement("canvas");
    sheet.width = source.naturalWidth;
    sheet.height = source.naturalHeight;
    const ctx = sheet.getContext("2d", { willReadFrequently: true });
    let original = sourcePixels.get(source);
    if (!original) {
      ctx.drawImage(source, 0, 0);
      original = ctx.getImageData(0, 0, sheet.width, sheet.height).data;
      sourcePixels.set(source, original);
      ctx.clearRect(0, 0, sheet.width, sheet.height);
    }
    const ramp = rgbRamps[tone];
    ctx.filter = tone === "food" ? "saturate(.58) brightness(1.08)" : "none";
    ctx.drawImage(source, 0, 0);
    const frame = ctx.getImageData(0, 0, sheet.width, sheet.height);
    const pixels = frame.data;
    const outline = tone === "lavender" ? [107, 91, 123] : [92, 71, 66];
    for (let i = 0; i < original.length; i += 4) {
      if (!original[i + 3]) continue;
      const darkest = Math.min(original[i], original[i + 1], original[i + 2]);
      const lightest = Math.max(original[i], original[i + 1], original[i + 2]);
      const luma = original[i] * .213 + original[i + 1] * .715 + original[i + 2] * .072;
      if (ramp) {
        const level = Math.min(2, Math.max(0, (luma - 24) / 108));
        const lo = Math.min(1, Math.floor(level));
        const mix = level - lo;
        for (let channel = 0; channel < 3; channel++) {
          pixels[i + channel] = (ramp[lo][channel] * (1 - mix) + ramp[lo + 1][channel] * mix) * (night ? .9 : 1);
        }
      } else if (lightest < 35) pixels.set(outline, i);
      else if (darkest >= 247) pixels.set([247, 239, 229], i);
    }
    ctx.putImageData(frame, 0, 0);
    tintedSheets.set(key, sheet);
    return sheet;
  }

  function blit(ctx, image, sx, sy, w, h, x, y, tone, scale = 1, night = false, mirror = false) {
    if (!sources[image]) return;
    const sheet = tintedSheet(image, tone, night);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (mirror) {
      ctx.translate(x + w * scale, y);
      ctx.scale(-1, 1);
      x = y = 0;
    }
    ctx.drawImage(sheet, sx, sy, w, h, x, y, w * scale, h * scale);
    ctx.restore();
  }

  function prop(ctx, name, x, y, tone = "wood", scale = 1, night = false, align = true) {
    const { w, h, atlas } = catalog.objects[name];
    blit(ctx, "objects", ...atlas, w, h, align ? snap(x) : x, align ? snap(y) : y, tone, scale, night);
  }

  function tiles(ctx, image, x, y, w, h, tone, source, night) {
    const left = snap(x), top = snap(y);
    const columns = Math.max(1, Math.round(w / TILE));
    const rows = Math.max(1, Math.round(h / TILE));
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const [sx, sy] = source(row, col, rows, columns);
        blit(ctx, image, sx, sy, TILE, TILE, left + col * TILE, top + row * TILE, tone, 1, night);
      }
    }
  }

  function floor(ctx, x, y, w, h, stone, night, material = stone ? "tile" : "wood") {
    const rowOffset = { wood: 0, tile: 3, terracotta: 4 }[material];
    tiles(ctx, "floors", x, y, w, h, stone ? (material === "terracotta" ? "rose" : "cream") : "floor",
      (row, col) => [((row * 3 + col) % 4) * TILE, rowOffset * TILE], night);
  }

  function marginTile() {
    const tile = document.createElement("canvas");
    tile.width = tile.height = TILE;
    blit(tile.getContext("2d"), "floors", 0, 0, TILE, TILE, 0, 0, "margin");
    return tile.toDataURL("image/png");
  }

  function wall(ctx, x, y, w, h, tone, night, cap = false) {
    tiles(ctx, cap ? "cap" : "walls", x, y, w, h, tone, (row, col, rows, columns) => {
      if (cap) return [TILE * 7, TILE * 5];
      const variant = columns === 1 ? 0 : col === 0 ? 1 : col === columns - 1 ? 3 : 2;
      return [variant * TILE, row === rows - 1 ? TILE : 0];
    }, night);
  }

  function windowPanel(ctx, x, y, w, h, night) {
    const scale = Math.max(1, Math.floor(h / 32));
    const size = 32 * scale;
    const left = snap(x), top = snap(y);
    const count = Math.max(1, Math.round(w / size));
    return Array.from({ length: count }, (_, index) => {
      const x = left + index * size;
      blit(ctx, "window", 0, 0, 32, 32, x, top, "lavender", scale, night);
      return { x: x + scale * 4, y: top + scale * 6, w: size - scale * 8, h: size - scale * 14 };
    });
  }

  function door(ctx, x, y, w, frame = 0, night = false) {
    const left = snap(x + (w - 32) / 2);
    blit(ctx, "door", frame * TILE, 0, TILE, 32, left, snap(y), "lavender", 1, night);
    blit(ctx, "door", frame * TILE, 0, TILE, 32, left + 16, snap(y), "lavender", 1, night, true);
  }

  function partition(ctx, { x, y, w, h }, wood = false) {
    const left = snap(x), top = snap(y), rw = Math.max(TILE, snap(w)), rh = Math.max(TILE, snap(h));
    const horizontal = rw >= rh;
    ctx.save();
    // Crisp continuous warm-brown exterior frame (eliminates broken tile seams!)
    ctx.fillStyle = PAL.k;
    ctx.fillRect(left, top, rw, rh);
    if (wood) {
      ctx.fillStyle = PAL.w1;
      ctx.fillRect(left + 1, top + 1, rw - 2, rh - 2);
      ctx.fillStyle = PAL.w3;
      if (horizontal) {
        ctx.fillRect(left + 2, top + 2, rw - 4, rh - 5);
        ctx.fillStyle = PAL.p1;
        ctx.fillRect(left + 2, top + 3, rw - 4, 3);
      } else {
        ctx.fillRect(left + 2, top + 2, rw - 5, rh - 4);
        ctx.fillStyle = PAL.p1;
        ctx.fillRect(left + 3, top + 2, 3, rh - 4);
      }
      // Subtle wood post trim every 32px
      ctx.fillStyle = PAL.k;
      if (horizontal) {
        for (let px = left + 32; px < left + rw - 8; px += 32) {
          ctx.fillRect(px, top + 1, 2, rh - 2);
        }
      } else {
        for (let py = top + 32; py < top + rh - 8; py += 32) {
          ctx.fillRect(left + 1, py, rw - 2, 2);
        }
      }
    } else {
      // Frosted lavender-cream glass partition with continuous rail & diagonal sheen
      ctx.fillStyle = PAL.d;
      ctx.fillRect(left + 1, top + 1, rw - 2, rh - 2);
      ctx.fillStyle = PAL.v;
      ctx.fillRect(left + 2, top + 2, rw - 4, rh - 4);
      ctx.fillStyle = PAL.c4;
      if (horizontal) {
        ctx.fillRect(left + 2, top + 3, rw - 4, Math.max(2, rh - 8));
        ctx.fillStyle = PAL.p3;
        for (let px = left + 8; px < left + rw - 10; px += 24) {
          ctx.fillRect(px, top + 4, 5, 2);
          ctx.fillRect(px + 2, top + 6, 4, 2);
        }
        ctx.fillStyle = PAL.w3;
        ctx.fillRect(left + 1, top + rh - 4, rw - 2, 3);
      } else {
        ctx.fillRect(left + 3, top + 2, Math.max(2, rw - 6), rh - 4);
        ctx.fillStyle = PAL.p3;
        for (let py = top + 8; py < top + rh - 10; py += 24) {
          ctx.fillRect(left + 5, py, 2, 6);
          ctx.fillRect(left + 7, py + 2, 2, 5);
        }
        ctx.fillStyle = PAL.s;
        for (let py = top + 32; py < top + rh - 8; py += 32) {
          ctx.fillRect(left + 1, py, rw - 2, 2);
        }
      }
    }
    ctx.restore();
  }

  function deskDivider(ctx, x, y, w) {
    const lx = snap(x), sy = Math.round(y), rw = snap(w);
    ctx.save();
    ctx.fillStyle = PAL.k;
    ctx.fillRect(lx, sy - 3, rw, 5);
    ctx.fillStyle = PAL.w1;
    ctx.fillRect(lx + 1, sy - 2, rw - 2, 3);
    ctx.fillStyle = PAL.w3;
    ctx.fillRect(lx + 1, sy - 2, rw - 2, 2);
    // Warm monitor stall dividers every 2 tiles (32px)
    for (let px = lx; px <= lx + rw; px += 32) {
      ctx.fillStyle = PAL.k;
      ctx.fillRect(px - 1, sy - 4, 3, 7);
      ctx.fillStyle = PAL.p1;
      ctx.fillRect(px, sy - 3, 1, 5);
    }
    ctx.restore();
  }

  function rug(ctx, x, y, w, h, tone = "rose") {
    const left = snap(x), top = snap(y), rw = snap(w), rh = snap(h);
    const ramp = ramps[tone] || ramps.rose;
    ctx.fillStyle = PAL.k;
    ctx.fillRect(left, top, rw, rh);
    ctx.fillStyle = ramp[1];
    ctx.fillRect(left + 1, top + 1, Math.max(0, rw - 2), Math.max(0, rh - 2));
    ctx.fillStyle = PAL.p2;
    ctx.fillRect(left + 3, top + 3, Math.max(0, rw - 6), Math.max(0, rh - 6));
    ctx.fillStyle = ramp[2];
    ctx.fillRect(left + 5, top + 5, Math.max(0, rw - 10), Math.max(0, rh - 10));
    // Soft woven pastel checker knots inside the rug (no horizontal stripe bands)
    ctx.fillStyle = ramp[1];
    ctx.save();
    ctx.globalAlpha = 0.28;
    for (let py = top + 7; py < top + rh - 7; py += 6) {
      for (let px = left + 7 + ((py / 6) % 2) * 3; px < left + rw - 7; px += 6) {
        ctx.fillRect(px, py, 2, 2);
      }
    }
    ctx.restore();
  }

  function jamb(ctx, x, y, h = TILE) {
    const lx = snap(x), ty = snap(y), jh = snap(h);
    ctx.fillStyle = PAL.k;
    ctx.fillRect(lx, ty, 3, jh);
    ctx.fillStyle = PAL.w1;
    ctx.fillRect(lx + 1, ty + 1, 2, Math.max(0, jh - 2));
    ctx.fillStyle = PAL.k;
    ctx.fillRect(lx + TILE * 2 - 3, ty, 3, jh);
    ctx.fillStyle = PAL.w1;
    ctx.fillRect(lx + TILE * 2 - 3, ty + 1, 2, Math.max(0, jh - 2));
  }

  function skyline(ctx, x, y, w, h, phase) {
    const dusk = phase === "night" || phase === "dusk";
    const scale = Math.ceil(h / 64);
    ctx.save();
    // 1. Unified seamless sky bands across the whole skyline (no tiled second sun!)
    ctx.fillStyle = dusk ? "#5c4e6b" : "#cbbbe3";
    ctx.fillRect(x, y, w, Math.round(h * 0.56));
    ctx.fillStyle = dusk ? "#7a6988" : "#e8dceb";
    ctx.fillRect(x, y + Math.round(h * 0.56), w, h - Math.round(h * 0.56));
    // 2. Single Sun or Moon + twinkling pixel stars at night
    const orbX = x + Math.round(w * 0.72);
    const orbY = y + Math.round(h * 0.22);
    if (dusk) {
      ctx.fillStyle = "#e5dcef";
      for (const [sx, sy] of [[92, 28], [184, 52], [312, 22], [440, 44], [648, 28], [710, 58]]) {
        ctx.fillRect(x + sx, y + sy, 3, 3);
      }
      ctx.fillStyle = "#e8e3f2";
      ctx.fillRect(orbX - 10, orbY - 12, 20, 24);
      ctx.fillRect(orbX - 14, orbY - 8, 28, 16);
      ctx.fillStyle = "#5c4e6b";
      ctx.fillRect(orbX - 2, orbY - 8, 12, 16);
    } else {
      ctx.fillStyle = "#f6d2b6";
      ctx.fillRect(orbX - 14, orbY - 10, 28, 20);
      ctx.fillRect(orbX - 10, orbY - 14, 20, 28);
      ctx.fillStyle = "#ffe5a3";
      ctx.fillRect(orbX - 8, orbY - 8, 16, 16);
    }
    ctx.restore();
    // 3. Tile ONLY the building strip (sy = 26..64) so buildings span full width with zero double sun
    const cropY = 26;
    const cropH = 64 - cropY;
    for (let column = 0; column < w; column += 128 * scale) {
      blit(ctx, "skyline", dusk ? 128 : 0, cropY, 128, cropH, x + column, y + cropY * scale, "authored", scale);
    }
  }

  function chairFrame(direction) {
    const name = { up: "chair_N", left: "chair_W", right: "chair_E" }[direction] ?? "chair_S";
    return catalog.objects[name];
  }

  const seatDirections = { N: "up", S: "down", E: "right", W: "left" };

  function seatObject(name, x, y) {
    const item = catalog.objects[name];
    const footTop = item.h - item.foot[1] * TILE;
    return {
      w: item.w, h: item.h,
      seats: item.seats.map(anchor => ({ x: x + anchor.x, y: y + footTop + anchor.y + 6,
        direction: seatDirections[anchor.dir ?? item.facing] })),
    };
  }

  function chairPosition(seat) {
    const { w, h, seats } = seatObject(chairFrame(seat.direction).id, 0, 0);
    return { w, h, x: seat.foot.x - seats[0].x, y: seat.foot.y - seats[0].y, direction: seats[0].direction };
  }

  function chairFront(ctx, seat, night) {
    furnitureFront(ctx, chairFrame(seat.direction).id, "lavender", night);
  }

  function furnitureFront(ctx, name, tone, night) {
    const { w, h, front } = catalog.objects[name];
    blit(ctx, "fronts", ...front, w, h, 0, 0, tone, 1, night);
  }

  function workstation(ctx, kind, x, y, scale, night, mirror = false) {
    const frames = {
      front: [0, 32], side: [32, 16], kiosk: [48, 16], vending: [64, 16], back: [80, 32], ashtray: [112, 16],
    };
    const [sx, width] = frames[kind];
    blit(ctx, "workstations", sx, 0, width, 32, x, y, "authored", scale, night, mirror);
  }

  function desk(ctx, seat, night) {
    const { direction, key, desk: { x: deskX, y: deskY } } = seat;
    const side = direction === "right" || direction === "left";
    const left = direction === "left";
    const back = direction === "down";
    const hardwareX = deskX;
    const hardwareY = deskY + (side ? 3 : -8);
    prop(ctx, side ? "table_rect_E" : "table_rect_S", deskX, deskY, "wood", 1, night);
    const chair = chairPosition(seat);
    prop(ctx, chairFrame(direction).id, chair.x, chair.y, "lavender", 1, night);
    workstation(ctx, side ? "side" : back ? "back" : "front", hardwareX, hardwareY, 1, night, left);
    return {
      key, x: hardwareX + (side ? (left ? 7 : 3) : back ? 11 : 4), y: hardwareY + (side ? 9 : back ? 18 : 7),
      w: side ? 6 : back ? 3 : 11, h: side ? 7 : back ? 2 : 5,
      trayX: deskX + (side ? (left ? 4 : 12) : 24), trayY: deskY + (side ? 32 : 15),
    };
  }

  function food(ctx, key, x, y, night, scale = 1) {
    blit(ctx, key, 0, 0, TILE, TILE, snap(x), snap(y), "food", scale, night);
  }

  function weatherLoop(ctx, type, now, reduced) {
    const key = { rain: "rain", storm: "storm", snow: "snow", clear: "leaves", wind: "leaves" }[type];
    if (!key) return;
    const sheet = sources[key];
    if (!sheet) return;
    const frame = Math.floor(now / (reduced ? 350 : 125)) % 8;
    ctx.save();
    const wind = type === "wind";
    ctx.globalAlpha = wind ? (reduced ? .13 : .39) : (reduced ? .17 : .34);
    ctx.imageSmoothingEnabled = false;
    for (let y = wind ? 128 : 0; y < (wind ? 384 : ctx.canvas.height); y += 128) {
      for (let x = 0; x < ctx.canvas.width; x += 128) {
        if (reduced && ((x + y) / 128) % 2) continue;
        ctx.drawImage(sheet, frame * 128, 0, 128, 128, x, y, 128, 128);
      }
    }
    ctx.restore();
  }

  function animation(ctx, name, x, y, tick, night) {
    const definition = catalog.anims[name === "stove" ? "stove_on_S" : name];
    const { w, h, frames } = definition;
    blit(ctx, name, (tick % frames) * w, 0, w, h, snap(x), snap(y), "cream", 1, night);
  }

  window.cafePixelTiles = {
    ready, PAL, snap, prop, floor, wall, windowPanel, door, jamb, chairPosition, chairFront,
    workstation, desk, deskDivider, seatObject, furnitureFront, food, weatherLoop, animation, marginTile, partition, rug, skyline,
  };
})();
