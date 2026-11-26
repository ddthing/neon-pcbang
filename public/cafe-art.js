(() => {
  "use strict";

  const WIDTH = 768;
  const HEIGHT = 512;
  const colors = {
    ink: "#292435", shade: "#3c3049", plum: "#574059", violet: "#77617e",
    slate: "#4d5c79", blue: "#677fa0", aqua: "#83c9c5", glass: "#263849",
    gold: "#ecb779", milk: "#ffe2ad", mint: "#94ac82", green: "#586b68",
    rust: "#9e5755", peach: "#da8c76", wood: "#a56b62",
    darkWood: "#80535c", lightWood: "#bd8470", paper: "#f9cca5",
  };
  const { ink, shade, plum, violet, slate, blue, aqua, glass, gold, milk,
    mint, green, rust, peach, wood, darkWood, lightWood, paper } = colors;
  const scene = document.querySelector(".scene");
  const background = document.createElement("canvas");
  const previous = document.createElement("canvas");
  const effects = document.createElement("canvas");
  const avatars = document.getElementById("cafe-avatars");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  background.className = "cafe-art-base";
  previous.className = "cafe-art-base cafe-art-previous";
  effects.className = "cafe-art-effects";
  for (const canvas of [background, previous, effects]) {
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    canvas.setAttribute("aria-hidden", "true");
  }
  const base = background.getContext("2d", { alpha: false });
  const prior = previous.getContext("2d", { alpha: false });
  const overlay = effects.getContext("2d");
  if (!base || !prior || !overlay) return;
  base.imageSmoothingEnabled = prior.imageSmoothingEnabled = overlay.imageSmoothingEnabled = false;
  scene.prepend(background, previous, effects);
  scene.dataset.canvasWorld = "";

  const pixel = (point) => ({
    x: Math.round(point.x * WIDTH / 100),
    y: Math.round(point.y * HEIGHT / 100),
  });
  const xPercent = (x) => x / WIDTH * 100;
  const yPercent = (y) => y / HEIGHT * 100;
  const kitchenClerk = { x: xPercent(94), y: yPercent(381) };
  function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
  function frame(ctx, x, y, w, h, fill, edge = ink) {
    rect(ctx, x, y, w, h, edge);
    rect(ctx, x + 1, y + 1, w - 2, h - 2, fill);
  }
  function floor(ctx, x, y, w, h, tile = false) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    rect(ctx, x, y, w, h, tile ? slate : darkWood);
    const swatches = tile ? [slate, "#68718a", "#596581", "#716d87"]
      : [wood, "#a16b66", "#b1786b", "#aa7066", "#a46d66"];
    for (let row = 0; row * 16 < h; row++) {
      const tileWidth = tile ? 16 : 48;
      for (let col = -1; col * tileWidth < w; col++) {
        const hash = Math.abs(col * 73 + row * 59) % 19;
        const left = x + col * tileWidth + (tile ? 0 : (row % 3) * 16);
        const top = y + row * 16;
        rect(ctx, left, top, tileWidth - 1, 15, swatches[hash % swatches.length]);
        rect(ctx, left + 1, top + 1, tile ? 8 : 38, 1, tile ? "#7a8195" : "#b98171");
        if (!tile) {
          if (hash % 3 === 0) rect(ctx, left + 3 + hash, top + 7, 11, 1, "#b57c6e");
          if (hash % 4 === 0) rect(ctx, left + 13 + hash, top + 11, 9, 1, "#986267");
        }
      }
    }
    ctx.restore();
  }
  function rug(ctx, x, y, w, h, color = slate) {
    rect(ctx, x + 2, y + 3, w, h, "#442e40");
    frame(ctx, x, y, w, h, color);
    frame(ctx, x + 3, y + 3, w - 6, h - 6, color, "#bc8f8d");
    for (let dx = 5; dx < w - 4; dx += 5) {
      rect(ctx, x + dx, y + 1, 2, 1, paper);
      rect(ctx, x + dx, y + h - 2, 2, 1, paper);
    }
    for (let dx = 9; dx < w - 8; dx += 16) {
      for (let dy = 9; dy < h - 8; dy += 16) {
        rect(ctx, x + dx, y + dy, 2, 1, "#91839c");
        rect(ctx, x + dx + 1, y + dy - 1, 1, 3, "#91839c");
      }
    }
  }
  function plant(ctx, x, y, variant = 0, animated = false) {
    rect(ctx, x - 12, y - 3, 26, 5, "#503748");
    frame(ctx, x - 8, y - 14, 16, 13, variant ? violet : rust);
    rect(ctx, x - 6, y - 13, 4, 10, variant ? "#a88ea1" : peach);
    rect(ctx, x - 2, y - 32, 3, 21, green);
    if (animated) foliage.push({ x, y });
    else plantLeaves(ctx, x, y, 0);
  }
  function plantLeaves(ctx, x, y, sway) {
    for (const [dx, dy, w, h, tint] of [
      [-13, -27, 13, 7, green], [0, -34, 14, 8, mint], [-7, -40, 11, 10, mint],
      [0, -25, 12, 6, green], [-15, -36, 9, 6, "#788573"],
    ]) {
      const left = x + dx + (dy < -29 ? sway : 0);
      const top = y + dy;
      rect(ctx, left + 2, top, w - 4, h, "#394953");
      rect(ctx, left, top + 2, w, h - 4, "#394953");
      rect(ctx, left + 1, top + 2, w - 2, h - 4, tint);
      rect(ctx, left + 2, top + 1, w - 4, 2, "#a9b88b");
      rect(ctx, left + 4, top + 3, w - 7, 1, "#c2c18c");
    }
  }
  function windowFrame(ctx, x, y, w, h, night) {
    frame(ctx, x, y, w, h, night ? "#414b70" : "#a8adba");
    rect(ctx, x + 3, y + 3, w - 6, h - 7, night ? "#4f597d" : "#b8bbc5");
    if (h > 60) {
      const horizon = y + h - 12;
      const backs = night ? ["#424f70", "#4a5272", "#555778"] : ["#8c9aab", "#a7a7b3", "#bab0b6"];
      const fronts = night ? ["#3c4666", "#524763", "#48425a"] : ["#778ca4", "#a98793", "#9a8187"];
      for (let index = 0; 19 + index * 31 < w - 23; index++) {
        const left = x + 14 + index * 31;
        const tower = 21 + (index * 37 % 49);
        const top = horizon - tower;
        rect(ctx, left, top, 26, tower, backs[index % 3]);
        rect(ctx, left + 3, top - 2, 20, 3, backs[(index + 1) % 3]);
        for (let pane = 9; pane < tower - 3; pane += 9) {
          rect(ctx, left + 4, top + pane, 2, 3, night ? "#697393" : "#c4b3b7");
          rect(ctx, left + 17, top + pane, 2, 3, night ? "#687590" : "#d0b8ad");
        }
      }
      for (let index = 0; 8 + index * 47 < w - 31; index++) {
        const left = x + 8 + index * 47;
        const top = horizon - 20 - index * 13 % 25;
        const fill = fronts[index % 3];
        rect(ctx, left, top, 35, horizon - top, fill);
        for (let tier = 0; tier < 7; tier++) {
          rect(ctx, left + tier * 2, top - tier - 1, 35 - tier * 4, 1, night ? "#332c44" : "#765467");
        }
        rect(ctx, left + 2, top + 1, 31, 1, night ? "#71627b" : "#c0a39e");
        rect(ctx, left + 23, top + 2, 10, horizon - top - 2, backs[index % 3]);
        for (let pane = 6; pane < horizon - top - 5; pane += 12) {
          rect(ctx, left + 5, top + pane, 4, 5, night ? gold : "#dde2e8");
          rect(ctx, left + 15, top + pane, 4, 5, index % 2 ? "#939eb2" : paper);
          rect(ctx, left + 26, top + pane, 4, 5, night ? "#7186a1" : "#bbc5d1");
        }
      }
    }
    if (h >= 35) {
      const skyX = x + Math.floor(w * .62);
      const skyY = y + (h > 60 ? 19 : 8);
      const glow = night ? "#a3a5c4" : "#f0c5a0";
      rect(ctx, skyX + 2, skyY, 6, 8, glow);
      rect(ctx, skyX, skyY + 2, 10, 4, glow);
      if (night) rect(ctx, skyX + 4, skyY, 6, 5, "#4f597d");
    }
    for (let i = 0; i * 17 < w - 20; i++) {
      const px = x + 5 + i * 17;
      const top = y + h - 11 - (i * 7 % 14);
      const wall = night ? ["#354461", "#3e4c6a", "#494766"] : ["#8198a9", "#9d9dab", "#9e889b"];
      rect(ctx, px, top, 14, y + h - top - 3, wall[i % 3]);
      for (let row = 0; row < 4; row++) {
        rect(ctx, px + 1 + row, top - 1 - row, 12 - row * 2, 1, night ? "#29364f" : "#697a93");
      }
      rect(ctx, px + 2, top + 3, 2, 3, night ? gold : "#e1c6bd");
      rect(ctx, px + 8, top + 4, 2, 2, night ? "#5f7091" : "#d0ccd0");
      if (top + 9 < y + h - 3) rect(ctx, px + 8, top + 7, 2, 2, night ? peach : paper);
    }
    for (let dx = 0; dx < w - 3; dx += 32) {
      rect(ctx, x + dx, y, 2, h, shade);
      rect(ctx, x + dx + 2, y + 1, 1, h - 2, "#8d8da6");
    }
    rect(ctx, x - 2, y + h - 2, w + 4, 4, shade);
    rect(ctx, x - 1, y + h - 2, w + 2, 1, paper);
    glassPanes.push({ x: x + 3, y: y + 3, w: w - 6, h: h - 6 });
  }
  function lamp(ctx, x, y, night) {
    rect(ctx, x, y - 12, 1, 13, shade);
    rect(ctx, x - 6, y, 13, 2, shade);
    rect(ctx, x - 8, y + 2, 17, 4, gold);
    rect(ctx, x - 7, y + 5, 15, 2, milk);
    if (night) {
      ctx.globalAlpha = .14;
      rect(ctx, x - 10, y + 7, 21, 7, gold);
      rect(ctx, x - 14, y + 14, 29, 6, gold);
      ctx.globalAlpha = .08;
      rect(ctx, x - 19, y + 20, 39, 6, gold);
      rect(ctx, x - 23, y + 26, 47, 4, gold);
      ctx.globalAlpha = 1;
    }
  }
  function door(ctx, x, y, w = 29) {
    frame(ctx, x, y, w, 30, glass);
    rect(ctx, x + 2, y + 2, w - 4, 3, blue);
    rect(ctx, x + Math.floor(w / 2), y + 2, 1, 26, "#98a2b1");
    rect(ctx, x + 5, y + 8, 1, 12, "#819ab2");
    rect(ctx, x + Math.floor(w / 2) - 3, y + 17, 2, 4, gold);
    rect(ctx, x - 1, y + 29, w + 2, 3, paper);
  }
  function couch(ctx, x, y, w, color = rust) {
    rect(ctx, x + 2, y + 3, w, 21, "#5d394e");
    frame(ctx, x, y, w, 23, color);
    rect(ctx, x + 3, y + 3, w - 6, 5, peach);
    for (let dx = 5; dx < w - 8; dx += 14) frame(ctx, x + dx, y + 9, 13, 9, color, plum);
    rect(ctx, x + 2, y + 19, w - 4, 2, "#b57979");
  }
  function counter(ctx, x, y, w) {
    frame(ctx, x, y, w, 36, darkWood);
    rect(ctx, x + 2, y + 2, w - 4, 15, paper);
    rect(ctx, x + 3, y + 14, w - 6, 3, lightWood);
    for (let dx = 5; dx < w - 4; dx += 9) rect(ctx, x + dx, y + 20, 1, 13, wood);
    rect(ctx, x + 2, y + 31, w - 4, 2, shade);
  }
  function cabinet(ctx, x, y, w, h) {
    frame(ctx, x, y, w, h, darkWood);
    rect(ctx, x + 3, y + 4, w - 6, h - 8, shade);
    for (let dy = 7; dy < h - 7; dy += 13) {
      for (let dx = 4; dx < w - 7; dx += 8) {
        frame(ctx, x + dx, y + dy, 6, 7, [gold, peach, mint, blue][(dx + dy) % 4], plum);
        rect(ctx, x + dx + 1, y + dy + 1, 4, 1, paper);
      }
      rect(ctx, x + 3, y + dy + 7, w - 6, 2, lightWood);
    }
  }
  function panel(ctx, x, y, w, h) {
    frame(ctx, x, y, w, h, plum);
    frame(ctx, x + 3, y + 3, w - 6, h - 6, violet, darkWood);
    rect(ctx, x + 5, y + 5, w - 10, 2, "#a68399");
    rect(ctx, x + 3, y + h - 5, w - 6, 2, shade);
  }
  function poster(ctx, x, y, color) {
    frame(ctx, x, y, 17, 22, paper, darkWood);
    rect(ctx, x + 3, y + 3, 11, 10, color);
    rect(ctx, x + 4, y + 9, 9, 3, blue);
    rect(ctx, x + 10, y + 5, 2, 2, milk);
    rect(ctx, x + 3, y + 15, 11, 1, plum);
    rect(ctx, x + 3, y + 17, 7, 1, violet);
  }
  function sofaTable(ctx, x, y) {
    frame(ctx, x, y, 31, 20, darkWood);
    rect(ctx, x + 2, y + 2, 27, 12, lightWood);
    frame(ctx, x + 5, y + 5, 10, 7, slate);
    rect(ctx, x + 7, y + 7, 6, 1, paper);
    frame(ctx, x + 19, y + 4, 6, 6, milk);
    rect(ctx, x + 25, y + 5, 2, 2, milk);
  }
  function fridge(ctx, x, y) {
    frame(ctx, x, y, 23, 40, slate);
    frame(ctx, x + 2, y + 2, 19, 30, glass);
    rect(ctx, x + 3, y + 3, 17, 1, aqua);
    for (const bottom of [12, 21, 30]) {
      for (let n = 0; n < 4; n++) {
        const left = x + 5 + n * 3;
        const tint = [peach, mint, blue, gold][(n + bottom) % 4];
        rect(ctx, left, y + bottom - 6, 1, 1, paper);
        rect(ctx, left, y + bottom - 5, 2, 5, tint);
        rect(ctx, left, y + bottom - 3, 2, 1, paper);
      }
      rect(ctx, x + 3, y + bottom, 17, 1, slate);
    }
    rect(ctx, x + 17, y + 14, 2, 9, paper);
    rect(ctx, x + 5, y + 35, 8, 1, violet);
  }
  function cookingRange(ctx, x, y) {
    frame(ctx, x, y, 27, 20, slate);
    rect(ctx, x + 2, y + 2, 23, 12, glass);
    for (const left of [x + 4, x + 15]) {
      frame(ctx, left, y + 4, 8, 7, shade, violet);
      rect(ctx, left + 2, y + 6, 4, 3, rust);
    }
    rect(ctx, x + 3, y + 16, 21, 2, "#8d8da6");
    rect(ctx, x + 8, y + 16, 1, 2, gold);
  }
  function counterApron() {
    const front = document.createElement("canvas");
    front.className = "cafe-art-prop-front";
    front.width = 101;
    front.height = 23;
    Object.assign(front.style, { left: xPercent(47) + "%", top: yPercent(367) + "%",
      width: xPercent(front.width) + "%", height: yPercent(front.height) + "%",
      zIndex: String(Math.round(yPercent(389) * 10)) });
    const ctx = front.getContext("2d");
    frame(ctx, 1, 0, 99, 21, darkWood);
    rect(ctx, 2, 0, 97, 2, paper);
    rect(ctx, 2, 2, 97, 2, wood);
    for (let x = 4; x < 96; x += 12) {
      frame(ctx, x, 5, 10, 12, wood, "#825567");
      rect(ctx, x + 1, 6, 8, 1, lightWood);
    }
    rect(ctx, 2, 18, 97, 2, shade);
    avatars.append(front);
  }

  let area = "";
  let layout = [];
  let glassPanes = [];
  let screens = [];
  let foliage = [];
  let occupied = new Set();
  let away = new Set();
  let activeSeat = null;
  let bootAt = 0;
  let lastPhase = "";
  let lightFade;
  let doorAt = 0;
  let doorway = null;
  let hallDoors = [];

  function hallway(night) {
    rect(base, 0, 0, WIDTH, HEIGHT, "#322b42");
    floor(base, 35, 52, 698, 422);
    floor(base, 32, 460, 704, 52, true);
    frame(base, 24, 21, 720, 38, plum);
    windowFrame(base, 126, 21, 515, 40, night);
    for (const x of [152, 240, 335, 433, 530, 622]) lamp(base, x, 60, night);
    rect(base, 25, 52, 10, 394, plum);
    rect(base, 733, 52, 10, 394, plum);
    const alcoves = [[43, 106, 77, 103], [43, 238, 77, 56], [657, 165, 69, 53], [657, 307, 69, 47]];
    for (const [x, y, w, h] of alcoves) {
      frame(base, x, y, w, h, shade);
      floor(base, x + 4, y + 4, w - 8, h - 8, true);
      couch(base, x + 9, y + 8, w - 18, violet);
    }
    for (const { x, y } of hallDoors) door(base, x, y, 25);
    for (const x of [231, 343, 463, 584]) {
      frame(base, x - 3, 87, 7, 283, plum);
      rect(base, x - 1, 89, 2, 277, lightWood);
      for (let y = 95; y < 367; y += 24) rect(base, x - 2, y, 5, 2, peach);
    }
    rug(base, 126, 159, 52, 95, violet);
    couch(base, 131, 163, 42);
    couch(base, 131, 224, 42);
    frame(base, 142, 195, 20, 16, wood);
    rect(base, 150, 197, 4, 5, milk);
    floor(base, 48, 295, 99, 56, true);
    cabinet(base, 49, 296, 55, 38);
    fridge(base, 111, 295);
    cookingRange(base, 106, 336);
    frame(base, 48, 281, 90, 15, shade);
    rect(base, 52, 283, 71, 1, gold);
    for (const [x, w] of [[61, 12], [77, 9], [90, 17]]) {
      rect(base, x, 287, w, 2, milk);
      rect(base, x, 290, w - 4, 1, peach);
    }
    counter(base, 48, 352, 99);
    frame(base, 61, 359, 13, 8, slate);
    rect(base, 80, 358, 9, 6, rust);
    for (const x of [120, 125, 130]) {
      frame(base, x, 358, 4, 6, milk, darkWood);
      rect(base, x + 1, 359, 2, 1, peach);
    }
    plant(base, 110, 350);
    frame(base, 186, 389, 29, 24, slate);
    frame(base, 189, 392, 23, 13, glass);
    rect(base, 193, 395, 8, 2, aqua);
    rect(base, 193, 399, 13, 1, blue);
    rect(base, 197, 413, 7, 9, plum);
    rug(base, 224, 432, 71, 29);
    doorway = { x: 241, y: 457, w: 36 };
    door(base, doorway.x, doorway.y, doorway.w);
    frame(base, 240, 446, 38, 9, "#384d61");
    rect(base, 243, 449, 32, 1, aqua);
    for (const [x, y] of [[247, 490], [259, 487], [268, 492]]) {
      base.globalAlpha = night ? .19 : .08;
      rect(base, x, y, 4, 9, aqua);
      rect(base, x - 1, y + 2, 6, 3, aqua);
      base.globalAlpha = 1;
    }
    for (const [x, y] of [[170, 449], [327, 449], [651, 449], [99, 448], [145, 83],
      [267, 386], [382, 386], [500, 386], [623, 386], [687, 405]]) plant(base, x, y, x % 2);
    for (const x of [22, 724]) rect(base, x, 447, 21, 30, shade);
  }
  function privateRoom(night) {
    const roomAccent = { solo: violet, duo: "#716667", team: "#535f75", squad: "#775669" }[area] ?? violet;
    rect(base, 0, 0, WIDTH, HEIGHT, shade);
    floor(base, 58, 84, 650, 416);
    frame(base, 52, 24, 664, 75, roomAccent);
    rect(base, 55, 78, 658, 15, darkWood);
    rect(base, 55, 79, 658, 3, lightWood);
    windowFrame(base, 118, 37, 416, 39, night);
    cabinet(base, 569, 38, 80, 46);
    rect(base, 42, 89, 17, 406, plum);
    rect(base, 709, 89, 17, 406, plum);
    for (const x of [129, 286, 474, 624]) lamp(base, x, 100, night);
    if (area === "solo") {
      floor(base, 59, 102, 648, 120, true);
      rect(base, 59, 218, 648, 5, plum);
      rect(base, 59, 223, 648, 2, paper);
      for (const [x, y] of [[116, 134], [229, 134], [548, 134]]) {
        rug(base, x - 10, y - 7, 95, 63, slate);
        couch(base, x, y, 73, violet);
        sofaTable(base, x + 20, y + 32);
        plant(base, x + 78, y + 24);
      }
      cabinet(base, 596, 263, 55, 76);
      poster(base, 555, 270, rust);
      rug(base, 574, 348, 100, 54, "#785872");
      couch(base, 585, 355, 64);
      sofaTable(base, 607, 381);
      cabinet(base, 89, 269, 54, 61);
      plant(base, 158, 329);
      panel(base, 278, 260, 250, 52);
      for (const x of [258, 535]) {
        panel(base, x, 291, 14, 66);
        rect(base, x + 2, 354, 11, 4, darkWood);
      }
      rug(base, 320, 314, 180, 113, violet);
      rug(base, 186, 321, 85, 75, "#765771");
      couch(base, 196, 327, 61, violet);
      sofaTable(base, 211, 363);
      cabinet(base, 503, 312, 39, 49);
      windowFrame(base, 320, 271, 180, 34, night);
      poster(base, 289, 276, rust);
      poster(base, 508, 276, green);
      lamp(base, 410, 305, night);
      plant(base, 306, 381, 1);
      plant(base, 504, 384);
      rug(base, 374, 431, 35, 27);
    } else {
      const lastRow = Math.max(...layout.map(seat => seat.y));
      const firstRow = Math.min(...layout.map(seat => seat.y));
      floor(base, 60, 101, 646, Math.max(10, firstRow - 138), true);
      rug(base, 88, Math.max(122, lastRow - 61), 591, 87, roomAccent);
      couch(base, 618, 420, 61, roomAccent);
      for (const seat of layout) {
        panel(base, seat.x - 35, seat.y - 91, 70, 44);
        poster(base, seat.x - 26, seat.y - 85, seat.x % 2 ? rust : green);
        lamp(base, seat.x + 18, seat.y - 78, night);
      }
      if (area === "duo") {
        rug(base, 84, 210, 119, 80, "#70647b");
        couch(base, 102, 221, 75, rust);
        sofaTable(base, 126, 256);
        fridge(base, 631, 242);
        cabinet(base, 565, 239, 45, 51);
      } else if (area === "team") {
        for (const x of [93, 217, 358, 500, 638]) {
          frame(base, x - 8, 156, 31, 20, slate);
          rect(base, x - 5, 160, 24, 2, blue);
          rect(base, x - 5, 165, 17, 1, milk);
        }
        cabinet(base, 111, 390, 70, 46);
      } else if (area === "squad") {
        for (const x of [119, 292, 466, 633]) {
          couch(base, x - 25, 215, 51, violet);
          plant(base, x + 31, 237);
        }
      }
    }
    rug(base, 345, 460, 78, 29);
    doorway = { x: 369, y: 478, w: 30 };
    door(base, doorway.x, doorway.y, doorway.w);
    for (const [x, y] of [[92, 128], [668, 130], [100, 462], [672, 462]]) plant(base, x, y, 1);
  }
  function lounge(night) {
    const outside = area === "terrace";
    rect(base, 0, 0, WIDTH, HEIGHT, outside ? "#373d5d" : shade);
    windowFrame(base, 46, 89, 676, 156, night);
    floor(base, 44, 251, 680, 147, true);
    floor(base, 44, 398, 680, 114, true);
    if (outside) {
      rect(base, 42, 248, 682, 4, paper);
      for (let x = 46; x < 725; x += 16) rect(base, x, 252, 2, 13, slate);
      frame(base, 131, 295, 47, 48, rust);
      frame(base, 135, 299, 37, 15, glass);
      rect(base, 138, 301, 31, 2, milk);
      for (let x = 139; x < 167; x += 6) frame(base, x, 306, 4, 6, paper, violet);
      frame(base, 144, 322, 17, 9, shade);
      rect(base, 149, 324, 7, 4, paper);
      rect(base, 133, 335, 43, 2, peach);
      couch(base, 480, 267, 75);
      rug(base, 429, 314, 112, 49, violet);
      sofaTable(base, 464, 325);
    } else {
      cabinet(base, 622, 243, 51, 47);
      couch(base, 327, 235, 46, violet);
      couch(base, 623, 332, 50);
      rug(base, 211, 240, 108, 61, violet);
      couch(base, 218, 245, 88, violet);
      sofaTable(base, 246, 275);
      frame(base, 570, 245, 48, 13, glass);
      for (let x = 574; x < 614; x += 4) rect(base, x, 248, 2, 7, "#6e8196");
      rect(base, 573, 255, 42, 1, aqua);
    }
    for (const [x, y] of [[61, 266], [111, 282], [696, 270], [636, 281], [682, 384], [75, 395]]) {
      plant(base, x, y, 1, true);
    }
    for (const x of [115, 274, 480, 646]) lamp(base, x, 256, night);
    doorway = { x: outside ? 365 : 448, y: outside ? 368 : 338, w: 30 };
    door(base, doorway.x, doorway.y, doorway.w);
  }
  function keyboard(ctx, x, y, wide = 14) {
    frame(ctx, x, y, wide, 5, violet);
    for (let i = 2; i < wide - 1; i += 2) rect(ctx, x + i, y + 1, 1, 2, "#d4bbb4");
    rect(ctx, x + 4, y + 3, wide - 8, 1, "#d4bbb4");
  }
  function desk(seat) {
    const { x, y, key, direction } = seat;
    const side = direction !== "up";
    const sign = direction === "left" ? -1 : 1;
    const center = side ? x + sign * 13 : x;
    const front = side ? y - 3 : y - 22;
    const width = side ? 26 : 74;
    const left = center - Math.floor(width / 2);
    const depth = side ? 15 : 24;
    rect(base, left + 2, front - 2, width, 11, "#684455");
    frame(base, left + 1, front - 3, width - 2, 13, darkWood);
    rect(base, left + 4, front + 4, 4, 6, plum);
    rect(base, left + width - 7, front + 4, 4, 6, plum);
    frame(base, left, front - depth, width, depth + 2, lightWood);
    rect(base, left + 2, front - depth + 1, width - 4, 2, paper);
    rect(base, left + 3, front - 3, width - 6, 1, wood);
    rect(base, left + 2, front - 1, width - 4, 1, paper);
    if (!side) {
      rect(base, left + 4, front - 12, 12, 1, wood);
      rect(base, left + width - 16, front - 12, 10, 1, wood);
      rect(base, left + width - 14, front - 8, 7, 1, paper);
    }

    const mx = side ? center + sign * 3 - 7 : center - 17;
    const my = front - depth - (side ? 4 : 14);
    const mw = side ? 14 : 34;
    const mh = side ? 11 : 23;
    frame(base, mx, my, mw, mh, slate);
    rect(base, mx + 2, my + 2, mw - 4, mh - 5, glass);
    rect(base, mx + 2, my + 2, mw - 4, 1, blue);
    rect(base, mx + mw - 4, my + mh - 2, 1, 1, mint);
    rect(base, mx + Math.floor(mw / 2) - 3, my + mh, 7, 2, shade);
    screens.push({ key, x: mx + 2, y: my + 3, w: mw - 4, h: mh - 6 });
    keyboard(base, side ? x + (sign === 1 ? 1 : -15) : x - 14, side ? front - 5 : y - 25, side ? 14 : 28);
    if (side) {
      rect(base, center + sign * 7 - 2, front - 5, 4, 4, plum);
      rect(base, center + sign * 7, front - 4, 1, 2, paper);
      frame(base, center + sign * 8 - 3, my - 1, 6, 12, plum);
      rect(base, center + sign * 8, my + 7, 1, 1, gold);
    }
    if (!side) {
      frame(base, x + 16, front - 8, 10, 8, violet);
      rect(base, x + 20, front - 6, 3, 3, paper);
      frame(base, x + 22, my + 4, 11, 21, plum);
      frame(base, x + 24, my + 9, 7, 7, shade, slate);
      rect(base, x + 25, my + 21, 2, 1, aqua);
    }

    rect(base, x - 8, y + 2, 17, 3, "#493346");
    rect(base, x - 5, y, 11, 2, shade);
    rect(base, x - 1, y - 5, 3, 7, ink);
    frame(base, x - 7, y - 9, 15, 7, slate);
  }
  function chairFront(seat) {
    const { x, y, key, direction } = seat;
    const side = direction !== "up";
    const w = side ? 9 : 22;
    const h = side ? 19 : 18;
    const left = side ? x + (direction === "right" ? -13 : 4) : x - 11;
    const top = y - 17;
    const element = document.createElement("canvas");
    element.className = "cafe-art-chair";
    element.dataset.seat = key;
    element.width = w;
    element.height = h;
    Object.assign(element.style, { left: xPercent(left) + "%", top: yPercent(top) + "%",
      width: xPercent(w) + "%", height: yPercent(h) + "%", zIndex: Math.round(yPercent(y) * 10) + 1 });
    const ctx = element.getContext("2d");
    const tint = Number(key.split(":")[1]) % 2 ? slate : plum;
    frame(ctx, 2, 0, w - 4, h - 3, tint);
    frame(ctx, 0, 3, w, h - 4, tint);
    rect(ctx, 2, 3, w - 4, 2, violet);
    rect(ctx, 2, 6, 1, h - 9, "#a4869a");
    rect(ctx, w - 3, 6, 1, h - 9, shade);
    rect(ctx, 1, h - 4, w - 2, 2, shade);
    avatars.append(element);
  }
  function paintBase(phase) {
    const night = phase !== "day" && phase !== "dawn";
    screens = [];
    glassPanes = [];
    foliage = [];
    if (area === "hall") hallway(night);
    else if (area === "booth" || area === "terrace") lounge(night);
    else privateRoom(night);
    for (const seat of layout) desk(seat);
  }
  function paintEffects(now) {
    if (!area) return;
    const phase = document.body.dataset.cafeLight || "night";
    if (phase !== lastPhase) {
      const fade = lastPhase && !document.hidden && !reducedMotion.matches;
      if (fade) {
        lightFade?.cancel();
        prior.drawImage(background, 0, 0);
      }
      lastPhase = phase;
      paintBase(phase);
      if (fade) lightFade = previous.animate([{ opacity: 1 }, { opacity: 0 }], 900);
    }
    if (document.hidden) return;
    overlay.clearRect(0, 0, WIDTH, HEIGHT);
    for (const { key, x, y, w, h } of screens) {
      if (key !== activeSeat && !occupied.has(key)) continue;
      const booting = key === activeSeat && !reducedMotion.matches && now - bootAt < 800;
      rect(overlay, x, y, w, h, away.has(key) ? slate : booting ? glass : "#376270");
      if (booting) rect(overlay, x + 1, y + h - 2, Math.max(1, Math.floor((w - 2) * (now - bootAt) / 800)), 1, mint);
      else if (away.has(key)) rect(overlay, x + Math.floor(w / 2), y + Math.floor(h / 2), 2, 2, gold);
      else {
        rect(overlay, x + 1, y + 1, Math.max(2, Math.floor(w * .6)), 1, aqua);
        rect(overlay, x + 2, y + h - 2, w - 4, 1, blue);
        if (w > 20) {
          rect(overlay, x + 2, y + 4, 2, 2, milk);
          rect(overlay, x + 2, y + 8, 2, 2, paper);
          rect(overlay, x + 9, y + 5, w - 13, h - 9, "#659491");
          rect(overlay, x + 9, y + 6, w - 13, 1, mint);
        }
      }
    }
    const tick = Math.floor(now / 100);
    for (const { x, y } of foliage) {
      const sway = reducedMotion.matches ? 0 : [-1, 0, 1, 0][Math.floor((tick + x) / 3) % 4];
      plantLeaves(overlay, x, y, sway);
    }
    if (area === "hall") paintHallStatus();
    if (reducedMotion.matches) return;
    const weather = document.body.dataset.cafeWeather;
    if (weather === "rain" || weather === "storm" || weather === "snow") {
      for (const { x, y, w, h } of glassPanes) {
        for (let drop = 0; drop < Math.floor(w / 11); drop++) {
          const px = (drop * 23 + tick) % w;
          const py = (drop * 17 + tick * 3) % (h - 4);
          rect(overlay, x + px, y + py, 1, weather === "snow" ? 1 : 4, "#8e98b3");
        }
      }
      if (area === "terrace" && weather !== "snow") {
        for (let n = 0; n < 20; n++) {
          const x = 65 + (n * 83) % 628;
          const y = 266 + (n * 53) % 105;
          const splash = (tick + n * 3) % 7;
          if (splash < 3) rect(overlay, x - splash, y, 1 + splash * 2, 1, "#a2adbd");
        }
      }
    }
    const cooking = area === "hall" && document.querySelector("#cafe-delivery-clerk[data-mode='cook']:not([hidden])");
    if (cooking) {
      for (const x of [114, 123]) {
        const rise = (tick + x) % 5;
        rect(overlay, x + rise % 2, 338 - rise * 2, 1, 2, "#cfb8bb");
      }
    }
    if (doorway && now - doorAt < 650) {
      const { x, y, w } = doorway;
      const age = now - doorAt;
      const opening = Math.max(0, Math.min(1, age / 160, (650 - age) / 170));
      const half = Math.round(w * opening * .4);
      rect(overlay, x + Math.floor(w / 2) - half, y + 2, half * 2, 27, ink);
      rect(overlay, x + Math.floor(w / 2) - half, y + 2, 1, 27, blue);
    }
  }
  function paintHallStatus() {
    const phase = window.cafeSeating?.phase();
    const selecting = document.getElementById("floor-kiosk").open;
    if (phase || selecting) {
      rect(overlay, 191, 394, 19, 8, phase ? "#435d62" : slate);
      if (phase) {
        rect(overlay, 197, 398, 2, 2, mint);
        rect(overlay, 199, 400, 2, 1, mint);
        rect(overlay, 201, 397, 2, 3, mint);
      } else {
        for (const y of [396, 398, 400]) rect(overlay, 194, y, 11, 1, paper);
      }
    }
    const mode = document.getElementById("cafe-delivery-clerk").dataset.mode;
    if (mode === "plate") {
      frame(overlay, 124, 297, 15, 30, glass);
      rect(overlay, 125, 298, 13, 1, aqua);
      rect(overlay, 135, 310, 2, 8, paper);
    }
  }
  window.cafeArt = {
    pixel,
    kitchenClerk,
    place(point) {
      const { x, y } = pixel(point);
      return { x: xPercent(x), y: yPercent(y) };
    },
    screen(key) {
      const screen = screens.find(item => item.key === key);
      if (!screen) return null;
      return {
        x: xPercent(screen.x), y: yPercent(screen.y),
        w: xPercent(screen.w), h: yPercent(screen.h),
      };
    },
    tray(key) {
      const screen = screens.find(item => item.key === key);
      const seat = layout.find(item => item.key === key);
      if (!screen || !seat) return null;
      const side = seat.direction !== "up";
      const offset = seat.direction === "left" ? -19 : side ? 19 : -26;
      return { x: xPercent(seat.x + offset), y: yPercent(seat.y - (side ? 8 : 31)) };
    },
    show(space, seats) {
      if (area === space) return;
      area = space;
      layout = seats.map(({ key, point, ...seat }) => ({ key, ...pixel(point), ...seat }));
      avatars.querySelectorAll(".cafe-art-chair, .cafe-art-prop-front").forEach(element => element.remove());
      for (const seat of layout) chairFront(seat);
      if (area === "hall") counterApron();
      lightFade?.cancel();
      lastPhase = "";
      doorAt = -Infinity;
      paintEffects(performance.now());
    },
    updateScreens(seat, seats, awaySeats) {
      if (activeSeat !== seat) bootAt = performance.now();
      activeSeat = seat;
      occupied = seats;
      away = awaySeats;
      paintEffects(performance.now());
    },
    openDoor() {
      doorAt = performance.now();
    },
    placeDoors(rooms, lounges) {
      hallDoors = [...Object.values(rooms), ...Object.values(lounges)].map(point => {
        const { x, y } = pixel(point);
        return { x: x - 12, y: y - 27 };
      });
      if (area === "hall") lastPhase = "";
    },
  };
  setInterval(() => paintEffects(performance.now()), 100);
})();
