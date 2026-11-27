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

  const filters = {
    authored: "brightness(1)",
    floor: "sepia(.35) saturate(.43) brightness(1.25) contrast(.53)",
    wood: "sepia(.32) saturate(.62) brightness(1.17) contrast(.76)",
    cream: "sepia(.3) saturate(.42) brightness(1.24) contrast(.71)",
    lavender: "sepia(.28) hue-rotate(219deg) saturate(.66) brightness(1.17) contrast(.73)",
    rose: "sepia(.27) hue-rotate(291deg) saturate(.79) brightness(1.13) contrast(.71)",
    mint: "sepia(.33) hue-rotate(100deg) saturate(.61) brightness(1.15) contrast(.74)",
    food: "saturate(.74) brightness(1.08) contrast(.83)",
  };
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
    ctx.filter = filters[tone] + (night ? " brightness(.84)" : "");
    ctx.drawImage(source, 0, 0);
    const frame = ctx.getImageData(0, 0, sheet.width, sheet.height);
    const pixels = frame.data;
    const outline = tone === "lavender" ? [107, 91, 123] : [92, 71, 66];
    for (let i = 0; i < original.length; i += 4) {
      if (!original[i + 3]) continue;
      const darkest = Math.min(original[i], original[i + 1], original[i + 2]);
      const lightest = Math.max(original[i], original[i + 1], original[i + 2]);
      if (lightest < 35) pixels.set(outline, i);
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
    floor(tile.getContext("2d"), 0, 0, TILE, TILE);
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
    const sourceX = (wood ? 32 : 0) + (h > TILE ? 16 : 0);
    tiles(ctx, "partitions", x, y, w, h, "authored", () => [sourceX, 0]);
  }

  function rug(ctx, x, y, w, h, tone) {
    const { atlas: [sx, sy] } = catalog.objects.rug_S;
    tiles(ctx, "objects", x, y, w, h, tone, (row, col, rows, columns) => [
      sx + (col === 0 ? 0 : col === columns - 1 ? 32 : 16),
      sy + (row === rows - 1 ? 16 : 0),
    ]);
  }

  function skyline(ctx, x, y, w, h, phase) {
    const dusk = phase === "night" || phase === "dusk";
    const scale = Math.ceil(h / 64);
    for (let column = 0; column < w; column += 128 * scale) {
      blit(ctx, "skyline", dusk ? 128 : 0, 0, 128, 64, x + column, y, "authored", scale);
    }
  }

  function chairFrame(direction) {
    const name = { up: "chair_N", left: "chair_W", right: "chair_E" }[direction] ?? "chair_S";
    return catalog.objects[name];
  }

  function chairPosition(seat) {
    const { w, h, seats } = chairFrame(seat.direction);
    const anchor = seats[0];
    return { w, h, x: seat.foot.x - anchor.x, y: seat.foot.y - (h - TILE + anchor.y) - 6 };
  }

  function chairFront(ctx, seat, night) {
    const { w, h, front } = chairFrame(seat.direction);
    blit(ctx, "fronts", ...front, w, h, 0, 0, "lavender", 1, night);
  }

  function workstation(ctx, kind, x, y, scale, night, mirror = false) {
    const frames = {
      front: [0, 32], side: [32, 16], kiosk: [48, 16], vending: [64, 16], back: [80, 32],
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
    const sheet = sources[{ rain: "rain", storm: "storm", snow: "snow", clear: "leaves" }[type] ?? "leaves"];
    const frame = Math.floor(now / (reduced ? 350 : 125)) % 8;
    ctx.save();
    ctx.globalAlpha = reduced ? .17 : .34;
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < ctx.canvas.height; y += 128) {
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
    ready, PAL, snap, prop, floor, wall, windowPanel, door, chairPosition, chairFront,
    workstation, desk, food, weatherLoop, animation, marginTile, partition, rug, skyline,
  };
})();
