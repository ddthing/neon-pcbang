(() => {
  "use strict";

  // High-density pure pixel-art world canvas (1.5x resolution = 1152x768)
  const WIDTH = 1152;
  const HEIGHT = 768;
  const T = window.cafePixelTiles;
  const PAL = T?.PAL || {
    k: "#261c29", s: "#3b2c3f", d: "#563f54", v: "#775e78",
    w0: "#633c41", w1: "#85524f", w2: "#a86c5e", w3: "#c48870", w4: "#dfb08f",
    p0: "#cfb097", p1: "#ebd2b5", p2: "#ffe6c4", p3: "#fff5e2",
    c0: "#2c3648", c1: "#45536b", c2: "#62758f", c3: "#899db3", c4: "#b6c7d4",
    t0: "#1b2b38", t1: "#294859", t2: "#44838a", t3: "#76c4bc", t4: "#baf2df",
    g0: "#283f3d", g1: "#3d6352", g2: "#648f6b", g3: "#8eb57a", g4: "#bfd48c",
    r0: "#6e323c", r1: "#9e4b4c", r2: "#cc6c5c", r3: "#eb9a7c",
    y1: "#c98542", y2: "#e8b15d", y3: "#ffdf85",
  };
  const S = (v) => Math.round(v * 1.5);

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
  const xPercent = (x) => (x / WIDTH) * 100;
  const yPercent = (y) => (y / HEIGHT) * 100;
  const kitchenClerk = { x: xPercent(S(94)), y: yPercent(S(381)) };

  function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function frame(ctx, x, y, w, h, fill, edge = PAL.k) {
    rect(ctx, x, y, w, h, edge);
    rect(ctx, x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2), fill);
  }
  function floor(ctx, x, y, w, h, tile = false, night = false) {
    if (T) {
      if (tile) T.paintStoneFloor(ctx, x, y, w, h, night);
      else T.paintWoodFloor(ctx, x, y, w, h, night);
    } else {
      rect(ctx, x, y, w, h, tile ? PAL.c1 : PAL.w2);
    }
  }
  function rug(ctx, x, y, w, h, fill = PAL.c1, border = PAL.p0) {
    rect(ctx, x + 3, y + 4, w, h, "rgba(38, 28, 41, 0.28)");
    frame(ctx, x, y, w, h, fill);
    frame(ctx, x + 4, y + 4, w - 8, h - 8, fill, border);
    // Woven cream fringe along left/right or top/bottom borders
    for (let dx = 7; dx < w - 6; dx += 6) {
      rect(ctx, x + dx, y + 1, 3, 2, PAL.p2);
      rect(ctx, x + dx, y + h - 3, 3, 2, PAL.p2);
    }
    // Delicate diamond weaver stitch motif
    for (let dx = 14; dx < w - 12; dx += 24) {
      for (let dy = 14; dy < h - 12; dy += 24) {
        rect(ctx, x + dx - 1, y + dy, 3, 1, PAL.v);
        rect(ctx, x + dx, y + dy - 1, 1, 3, PAL.v);
      }
    }
  }
  function plant(ctx, x, y, variant = 0, night = false, animated = false) {
    if (T && !animated) {
      T.paintPlant(ctx, x, y, variant % 3, night);
      return;
    }
    if (animated) foliage.push({ x, y, variant });
    else if (T) T.paintPlant(ctx, x, y, variant % 3, night);
  }
  function plantLeavesSway(ctx, x, y, sway, night) {
    if (T) T.paintPlant(ctx, x + sway, y, 1, night);
  }
  function windowFrame(ctx, x, y, w, h, night) {
    frame(ctx, x, y, w, h, night ? "#323d5e" : "#a9b7c9");
    rect(ctx, x + 3, y + 3, w - 6, h - 8, night ? "#3b466b" : "#bfd0de");
    // Horizon skyline pixel art
    if (h > 80) {
      const horizon = y + h - 14;
      const backs = night ? ["#2f3959", "#374263", "#404569"] : ["#8fa3b5", "#a3abb8", "#b2acb6"];
      const fronts = night ? ["#262e4a", "#383554", "#31304b"] : ["#768fa6", "#a18a96", "#8f838b"];
      for (let index = 0; 18 + index * 42 < w - 34; index++) {
        const left = x + 18 + index * 42;
        const tower = 30 + ((index * 53) % 68);
        const top = horizon - tower;
        rect(ctx, left, top, 36, tower, backs[index % 3]);
        rect(ctx, left + 4, top - 3, 28, 3, backs[(index + 1) % 3]);
        for (let pane = 12; pane < tower - 5; pane += 12) {
          rect(ctx, left + 6, top + pane, 4, 4, (index + pane) % 2 ? PAL.y2 : PAL.c3);
          rect(ctx, left + 22, top + pane, 4, 4, night ? PAL.c3 : PAL.p2);
        }
      }
      for (let index = 0; 10 + index * 64 < w - 42; index++) {
        const left = x + 10 + index * 64;
        const top = horizon - 28 - ((index * 19) % 34);
        rect(ctx, left, top, 48, horizon - top, fronts[index % 3]);
        for (let tier = 0; tier < 8; tier++) {
          rect(ctx, left + tier * 2, top - tier - 1, 48 - tier * 4, 1, night ? PAL.k : "#6d5263");
        }
        for (let pane = 8; pane < horizon - top - 8; pane += 16) {
          rect(ctx, left + 7, top + pane, 6, 7, night ? PAL.y3 : "#e6edf2");
          rect(ctx, left + 21, top + pane, 6, 7, index % 2 ? PAL.c3 : PAL.p2);
          rect(ctx, left + 35, top + pane, 6, 7, night ? PAL.c2 : "#c6d2de");
        }
      }
    }
    // Moon or sun disk
    if (h >= 48) {
      const skyX = x + Math.floor(w * 0.65);
      const skyY = y + (h > 85 ? 24 : 11);
      const glow = night ? PAL.y3 : PAL.p3;
      rect(ctx, skyX + 3, skyY, 9, 12, glow);
      rect(ctx, skyX, skyY + 3, 15, 6, glow);
      if (night) rect(ctx, skyX + 6, skyY, 9, 8, "#3b466b");
    }
    // Window frame mullions & sill bevel
    for (let dx = 0; dx < w - 4; dx += 48) {
      rect(ctx, x + dx, y, 3, h, PAL.k);
      rect(ctx, x + dx + 3, y + 2, 2, h - 4, PAL.p0);
    }
    rect(ctx, x - 3, y + h - 4, w + 6, 6, PAL.w1);
    rect(ctx, x - 2, y + h - 4, w + 4, 2, PAL.p1);
    glassPanes.push({ x: x + 4, y: y + 4, w: w - 8, h: h - 9 });
  }
  function lamp(ctx, x, y, night) {
    rect(ctx, x - 1, y - 16, 2, 16, PAL.s);
    rect(ctx, x - 9, y, 18, 3, PAL.k);
    rect(ctx, x - 12, y + 3, 24, 5, PAL.y2);
    rect(ctx, x - 10, y + 7, 20, 3, PAL.y3);
    if (night && T) {
      T.drawDitherGlow(ctx, x, y + 24, 34, 22, PAL.y3, 0.22);
    }
  }
  function door(ctx, x, y, w = 44) {
    frame(ctx, x, y, w, 45, PAL.t0);
    rect(ctx, x + 2, y + 2, w - 4, 4, PAL.c2);
    rect(ctx, x + Math.floor(w / 2), y + 2, 2, 39, PAL.c3);
    rect(ctx, x + 7, y + 11, 2, 18, PAL.t3);
    rect(ctx, x + Math.floor(w / 2) - 5, y + 25, 3, 6, PAL.y3);
    rect(ctx, x - 2, y + 43, w + 4, 4, PAL.p1);
  }
  function couch(ctx, x, y, w, berry = true) {
    if (T) T.paintCouch(ctx, x, y, w, berry);
  }
  function counter(ctx, x, y, w) {
    frame(ctx, x, y, w, 54, PAL.w1);
    rect(ctx, x + 3, y + 3, w - 6, 22, PAL.p2);
    rect(ctx, x + 4, y + 21, w - 8, 4, PAL.w3);
    for (let dx = 7; dx < w - 6; dx += 14) rect(ctx, x + dx, y + 30, 2, 19, PAL.w0);
    rect(ctx, x + 3, y + 46, w - 6, 3, PAL.s);
  }
  function cabinet(ctx, x, y, w, h) {
    if (T) T.paintCabinet(ctx, x, y, w, h);
  }
  function panel(ctx, x, y, w, h) {
    frame(ctx, x, y, w, h, PAL.d);
    frame(ctx, x + 4, y + 4, w - 8, h - 8, PAL.v, PAL.w1);
    rect(ctx, x + 7, y + 7, w - 14, 3, PAL.p0);
    rect(ctx, x + 4, y + h - 7, w - 8, 3, PAL.s);
  }
  function poster(ctx, x, y, accent = PAL.r2) {
    frame(ctx, x, y, 25, 32, PAL.p2, PAL.w1);
    rect(ctx, x + 4, y + 4, 17, 15, accent);
    rect(ctx, x + 6, y + 13, 13, 4, PAL.c2);
    rect(ctx, x + 15, y + 7, 3, 3, PAL.y3);
    rect(ctx, x + 4, y + 22, 17, 2, PAL.d);
    rect(ctx, x + 4, y + 26, 11, 2, PAL.v);
  }
  function sofaTable(ctx, x, y) {
    if (T?.paintSofaTable) {
      T.paintSofaTable(ctx, x, y);
      return;
    }
    frame(ctx, x, y, 46, 30, PAL.w1);
  }
  function counterApron() {
    const front = document.createElement("canvas");
    front.className = "cafe-art-prop-front";
    front.width = S(101);
    front.height = S(23);
    Object.assign(front.style, {
      left: xPercent(S(47)) + "%",
      top: yPercent(S(367)) + "%",
      width: xPercent(front.width) + "%",
      height: yPercent(front.height) + "%",
      zIndex: String(Math.round(yPercent(S(389)) * 10)),
    });
    const ctx = front.getContext("2d");
    frame(ctx, 1, 0, front.width - 2, front.height - 2, PAL.w1);
    rect(ctx, 3, 0, front.width - 6, 3, PAL.p2);
    rect(ctx, 3, 3, front.width - 6, 3, PAL.w2);
    for (let x = 6; x < front.width - 10; x += 18) {
      frame(ctx, x, 8, 15, 17, PAL.w2, PAL.w0);
      rect(ctx, x + 2, 10, 11, 2, PAL.w3);
    }
    rect(ctx, 3, front.height - 5, front.width - 6, 3, PAL.s);
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
    const CL = window.cafeLayout;
    const lm = CL?.landmarks;
    rect(base, 0, 0, WIDTH, HEIGHT, "#2a2236");
    floor(base, S(35), S(52), S(698), S(422), false, night);
    floor(base, S(32), S(460), S(704), S(52), true, night);
    frame(base, S(24), S(21), S(720), S(38), PAL.d);
    windowFrame(base, S(126), S(21), S(515), S(40), night);
    for (const x of [152, 240, 335, 433, 530, 622]) lamp(base, S(x), S(60), night);
    rect(base, S(25), S(52), S(10), S(394), PAL.d);
    rect(base, S(733), S(52), S(10), S(394), PAL.d);

    const alcoves = lm?.alcoves?.map((a) => [a.x, a.y, a.w, a.h]) ?? [
      [43, 106, 77, 103], [43, 238, 77, 56], [657, 165, 69, 53], [657, 307, 69, 47],
    ];
    for (const [x, y, w, h] of alcoves) {
      frame(base, S(x), S(y), S(w), S(h), PAL.s);
      floor(base, S(x + 4), S(y + 4), S(w - 8), S(h - 8), true, night);
      couch(base, S(x + 9), S(y + 8), S(w - 18), true);
    }
    for (const { x, y } of hallDoors) door(base, x, y, S(25));

    // Bay center cable-spine wood beams (derived from cafeLayout.hallBanks)
    const spines = CL?.hallBanks?.map((b) => b.spineX) ?? [231, 343, 463, 584];
    for (const x of spines) {
      frame(base, S(x) - 5, S(87), 10, S(283), PAL.d);
      rect(base, S(x) - 2, S(89), 4, S(277), PAL.w3);
      for (let y = S(95); y < S(367); y += 36) rect(base, S(x) - 3, y, 7, 3, PAL.r3);
    }

    // Waiting lounge rug + sofas + coffee table
    const lg = lm?.lounge ?? { x: 126, y: 159, w: 52, h: 95 };
    rug(base, S(lg.x), S(lg.y), S(lg.w), S(lg.h), PAL.v, PAL.p0);
    couch(base, S(lg.x + 5), S(lg.y + 4), S(lg.w - 10), false);
    couch(base, S(lg.x + 5), S(lg.y + lg.h - 30), S(lg.w - 10), false);
    sofaTable(base, S(lg.x + 11), S(lg.y + 33));

    // Open Kitchen Snack Zone
    const ct = lm?.counter ?? { x: 48, y: 295, w: 99, h: 93 };
    floor(base, S(ct.x), S(ct.y), S(ct.w), S(56), true, night);
    cabinet(base, S(ct.x + 1), S(ct.y + 1), S(55), S(38));
    if (T) T.paintFridge(base, S(ct.x + 63), S(ct.y));
    if (T) T.paintCookingRange(base, S(ct.x + 58), S(ct.y + 41));
    frame(base, S(ct.x), S(ct.y - 14), S(90), S(15), PAL.s);
    rect(base, S(ct.x + 4), S(ct.y - 12), S(71), 2, PAL.y3);
    for (const [dx, w] of [[13, 12], [29, 9], [42, 17]]) {
      rect(base, S(ct.x + dx), S(ct.y - 8), S(w), 3, PAL.p3);
      rect(base, S(ct.x + dx), S(ct.y - 5), S(w - 4), 2, PAL.r3);
    }
    counter(base, S(ct.x), S(ct.y + 57), S(ct.w));
    frame(base, S(ct.x + 13), S(ct.y + 64), S(13), S(8), PAL.c1);
    rect(base, S(ct.x + 32), S(ct.y + 63), S(9), S(6), PAL.r1);
    for (const dx of [72, 77, 82]) {
      frame(base, S(ct.x + dx), S(ct.y + 63), 6, 9, PAL.p3, PAL.w1);
      rect(base, S(ct.x + dx) + 1, S(ct.y + 64), 4, 2, PAL.r3);
    }
    plant(base, S(ct.x + 62), S(ct.y + 55), 0, night);

    // Self-service Kiosk
    const ks = lm?.kiosk ?? { x: 186, y: 386 };
    if (T) T.paintKiosk(base, S(ks.x), S(ks.y));

    // Main Entrance & Welcome Mat
    const en = lm?.entrance ?? { x: 241, y: 457, w: 36, rugX: 224, rugY: 432, rugW: 71, rugH: 29 };
    rug(base, S(en.rugX), S(en.rugY), S(en.rugW), S(en.rugH), PAL.c1, PAL.p0);
    doorway = { x: S(en.x), y: S(en.y), w: S(en.w) };
    door(base, doorway.x, doorway.y, doorway.w);
    frame(base, S(en.x - 1), S(en.y - 11), S(en.w + 2), S(9), PAL.t1);
    rect(base, S(en.x + 2), S(en.y - 8), S(en.w - 4), 2, PAL.t3);
    if (T) T.drawDitherGlow(base, S(en.x + Math.floor(en.w / 2)), S(en.y + 33), 22, 12, PAL.t3, night ? 0.24 : 0.1);

    const plants = lm?.plants ?? [
      [170, 449], [327, 449], [651, 449], [99, 448], [145, 83],
      [267, 386], [382, 386], [500, 386], [623, 386], [687, 405],
    ];
    for (const [x, y] of plants) plant(base, S(x), S(y), x % 3, night);
    for (const x of [22, 724]) rect(base, S(x), S(447), S(21), S(30), PAL.s);
  }

  function privateRoom(night) {
    const roomAccent = { solo: PAL.v, duo: "#716667", team: "#535f75", squad: "#775669" }[area] ?? PAL.v;
    rect(base, 0, 0, WIDTH, HEIGHT, PAL.s);
    floor(base, S(58), S(84), S(650), S(416), false, night);
    frame(base, S(52), S(24), S(664), S(75), roomAccent);
    rect(base, S(55), S(78), S(658), S(15), PAL.w1);
    rect(base, S(55), S(79), S(658), S(3), PAL.w3);
    windowFrame(base, S(118), S(37), S(416), S(39), night);
    cabinet(base, S(569), S(38), S(80), S(46));
    rect(base, S(42), S(89), S(17), S(406), PAL.d);
    rect(base, S(709), S(89), S(17), S(406), PAL.d);
    for (const x of [129, 286, 474, 624]) lamp(base, S(x), S(100), night);

    if (area === "solo") {
      floor(base, S(59), S(102), S(648), S(120), true, night);
      rect(base, S(59), S(218), S(648), S(5), PAL.d);
      rect(base, S(59), S(223), S(648), S(2), PAL.p1);
      for (const [x, y] of [[116, 134], [229, 134], [548, 134]]) {
        rug(base, S(x - 10), S(y - 7), S(95), S(63), PAL.c1);
        couch(base, S(x), S(y), S(73), true);
        sofaTable(base, S(x + 20), S(y + 32));
        plant(base, S(x + 78), S(y + 24), 1, night);
      }
      cabinet(base, S(596), S(263), S(55), S(76));
      poster(base, S(555), S(270), PAL.r1);
      rug(base, S(574), S(348), S(100), S(54), "#785872");
      couch(base, S(585), S(355), S(64), false);
      sofaTable(base, S(607), S(381));
      cabinet(base, S(89), S(269), S(54), S(61));
      plant(base, S(158), S(329), 2, night);
      panel(base, S(278), S(260), S(250), S(52));
      for (const x of [258, 535]) {
        panel(base, S(x), S(291), S(14), S(66));
        rect(base, S(x + 2), S(354), S(11), S(4), PAL.w1);
      }
      rug(base, S(320), S(314), S(180), S(113), PAL.v);
      rug(base, S(186), S(321), S(85), S(75), "#765771");
      couch(base, S(196), S(327), S(61), true);
      sofaTable(base, S(211), S(363));
      cabinet(base, S(503), S(312), S(39), S(49));
      windowFrame(base, S(320), S(271), S(180), S(34), night);
      poster(base, S(289), S(276), PAL.r1);
      poster(base, S(508), S(276), PAL.g2);
      lamp(base, S(410), S(305), night);
      plant(base, S(306), S(381), 1, night);
      plant(base, S(504), S(384), 0, night);
      rug(base, S(374), S(431), S(35), S(27), PAL.c1);
    } else {
      const lastRow = Math.max(...layout.map((seat) => seat.y));
      const firstRow = Math.min(...layout.map((seat) => seat.y));
      floor(base, S(60), S(101), S(646), Math.max(15, firstRow - S(138)), true, night);
      rug(base, S(88), Math.max(S(122), lastRow - S(61)), S(591), S(87), roomAccent);
      couch(base, S(618), S(420), S(61), true);
      for (const seat of layout) {
        panel(base, seat.x - S(35), seat.y - S(91), S(70), S(44));
        poster(base, seat.x - S(26), seat.y - S(85), seat.x % 2 ? PAL.r1 : PAL.g2);
        lamp(base, seat.x + S(18), seat.y - S(78), night);
      }
      if (area === "duo") {
        rug(base, S(84), S(210), S(119), S(80), "#70647b");
        couch(base, S(102), S(221), S(75), false);
        sofaTable(base, S(126), S(256));
        if (T) T.paintFridge(base, S(631), S(242));
        cabinet(base, S(565), S(239), S(45), S(51));
      } else if (area === "team") {
        for (const x of [93, 217, 358, 500, 638]) {
          frame(base, S(x - 8), S(156), S(31), S(20), PAL.c1);
          rect(base, S(x - 5), S(160), S(24), 3, PAL.c2);
          rect(base, S(x - 5), S(165), S(17), 2, PAL.p3);
        }
        cabinet(base, S(111), S(390), S(70), S(46));
      } else if (area === "squad") {
        for (const x of [119, 292, 466, 633]) {
          couch(base, S(x - 25), S(215), S(51), true);
          plant(base, S(x + 31), S(237), 0, night);
        }
      }
    }
    rug(base, S(345), S(460), S(78), S(29), PAL.c1);
    doorway = { x: S(369), y: S(478), w: S(30) };
    door(base, doorway.x, doorway.y, doorway.w);
    for (const [x, y] of [[92, 128], [668, 130], [100, 462], [672, 462]]) plant(base, S(x), S(y), 1, night);
  }

  function lounge(night) {
    const outside = area === "terrace";
    rect(base, 0, 0, WIDTH, HEIGHT, outside ? "#2c3452" : PAL.s);
    windowFrame(base, S(46), S(89), S(676), S(156), night);
    floor(base, S(44), S(251), S(680), S(147), true, night);
    floor(base, S(44), S(398), S(680), S(114), true, night);
    if (outside) {
      rect(base, S(42), S(248), S(682), S(4), PAL.p1);
      for (let x = S(46); x < S(725); x += S(16)) rect(base, x, S(252), 3, S(13), PAL.c1);
      frame(base, S(131), S(295), S(47), S(48), PAL.r1);
      frame(base, S(135), S(299), S(37), S(15), PAL.t0);
      rect(base, S(138), S(301), S(31), 3, PAL.y3);
      for (let x = S(139); x < S(167); x += S(6)) frame(base, x, S(306), S(4), S(6), PAL.p1, PAL.v);
      frame(base, S(144), S(322), S(17), S(9), PAL.s);
      rect(base, S(149), S(324), S(7), S(4), PAL.p1);
      rect(base, S(133), S(335), S(43), 3, PAL.r3);
      couch(base, S(480), S(267), S(75), false);
      rug(base, S(429), S(314), S(112), S(49), PAL.v);
      sofaTable(base, S(464), S(325));
    } else {
      cabinet(base, S(622), S(243), S(51), S(47));
      couch(base, S(327), S(235), S(46), true);
      couch(base, S(623), S(332), S(50), false);
      rug(base, S(211), S(240), S(108), S(61), PAL.v);
      couch(base, S(218), S(245), S(88), true);
      sofaTable(base, S(246), S(275));
      frame(base, S(570), S(245), S(48), S(13), PAL.t0);
      for (let x = S(574); x < S(614); x += S(4)) rect(base, x, S(248), 3, S(7), PAL.c2);
      rect(base, S(573), S(255), S(42), 2, PAL.t3);
    }
    for (const [x, y] of [[61, 266], [111, 282], [696, 270], [636, 281], [682, 384], [75, 395]]) {
      plant(base, S(x), S(y), 1, night, true);
    }
    for (const x of [115, 274, 480, 646]) lamp(base, S(x), S(256), night);
    doorway = { x: S(outside ? 365 : 448), y: S(outside ? 368 : 338), w: S(30) };
    door(base, doorway.x, doorway.y, doorway.w);
  }

  function desk(seat, night) {
    if (T) {
      screens.push(T.paintDeskSet(base, seat, night));
    }
  }

  function chairFront(seat) {
    const { x, y, key, direction } = seat;
    const side = direction !== "up";
    const w = side ? S(10) : S(24);
    const h = side ? S(19) : S(18);
    const left = side ? (direction === "right" ? x - S(11) : x + 1) : x - Math.floor(w / 2);
    const top = y - S(17);
    const element = document.createElement("canvas");
    element.className = "cafe-art-chair";
    element.dataset.seat = key;
    element.width = w;
    element.height = h;
    Object.assign(element.style, {
      left: xPercent(left) + "%",
      top: yPercent(top) + "%",
      width: xPercent(w) + "%",
      height: yPercent(h) + "%",
      zIndex: String(Math.round(yPercent(y) * 10) + 1),
    });
    const ctx = element.getContext("2d");
    if (T) T.paintChairFront(ctx, w, h, key, direction);
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
    for (const seat of layout) desk(seat, night);
  }

  function paintEffects(now) {
    if (!area) return;
    const phase = document.body.dataset.cafeLight || "night";
    const night = phase !== "day" && phase !== "dawn";
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
      rect(overlay, x, y, w, h, away.has(key) ? PAL.c1 : booting ? PAL.t0 : "#2e5c6b");
      if (booting) {
        rect(overlay, x + 2, y + h - 3, Math.max(2, Math.floor(((w - 4) * (now - bootAt)) / 800)), 2, PAL.g3);
      } else if (away.has(key)) {
        rect(overlay, x + Math.floor(w / 2) - 1, y + Math.floor(h / 2) - 1, 3, 3, PAL.y3);
      } else {
        rect(overlay, x + 2, y + 2, Math.max(3, Math.floor(w * 0.65)), 2, PAL.t3);
        rect(overlay, x + 3, y + h - 3, w - 6, 2, PAL.c2);
        if (w > 26) {
          rect(overlay, x + 3, y + 6, 3, 3, PAL.y3);
          rect(overlay, x + 3, y + 12, 3, 3, PAL.r3);
          rect(overlay, x + 13, y + 7, w - 18, h - 13, PAL.t2);
          rect(overlay, x + 13, y + 8, w - 18, 2, PAL.t4);
        }
      }
    }

    const tick = Math.floor(now / 100);
    const staticMotion = reducedMotion.matches;
    const animTick = staticMotion ? 0 : tick;
    for (const { x, y } of foliage) {
      const sway = staticMotion ? 0 : [-1, 0, 1, 0][Math.floor((tick + x) / 3) % 4];
      plantLeavesSway(overlay, x, y, sway, night);
    }
    if (area === "hall") paintHallStatus();

    const weather = document.body.dataset.cafeWeather;
    if (weather === "rain" || weather === "storm" || weather === "snow") {
      for (const { x, y, w, h } of glassPanes) {
        overlay.save();
        overlay.beginPath();
        overlay.rect(x, y, w, h);
        overlay.clip();
        for (let drop = 0; drop < Math.floor(w / 14); drop++) {
          const px = (drop * 31 + animTick * 2) % w;
          const py = (drop * 23 + animTick * 4) % Math.max(1, h - 5);
          rect(overlay, x + px, y + py, 1, weather === "snow" ? 2 : 6, PAL.c3);
        }
        overlay.restore();
      }
      if (!staticMotion && area === "terrace" && weather !== "snow") {
        for (let n = 0; n < 24; n++) {
          const x = S(65) + ((n * 117) % S(628));
          const y = S(266) + ((n * 79) % S(105));
          const splash = (tick + n * 3) % 7;
          if (splash < 3) rect(overlay, x - splash * 2, y, 2 + splash * 4, 1, PAL.c4);
        }
      }
    }

    const cooking = area === "hall" && document.querySelector("#cafe-delivery-clerk[data-mode='cook']:not([hidden])");
    if (cooking) {
      for (const x of [S(114), S(124)]) {
        const rise = staticMotion ? 1 : (tick + x) % 6;
        rect(overlay, x + (rise % 2), S(338) - rise * 3, 2, 3, PAL.p1);
      }
    }

    if (doorway && now - doorAt < 650) {
      const { x, y, w } = doorway;
      const age = now - doorAt;
      const opening = Math.max(0, Math.min(1, age / 160, (650 - age) / 170));
      const half = Math.round(w * opening * 0.42);
      rect(overlay, x + Math.floor(w / 2) - half, y + 3, half * 2, S(27), PAL.k);
      rect(overlay, x + Math.floor(w / 2) - half, y + 3, 2, S(27), PAL.t3);
    }
  }

  function paintHallStatus() {
    const phase = window.cafeSeating?.phase();
    const selecting = document.getElementById("floor-kiosk").open;
    if (phase || selecting) {
      const sx = S(190), sy = S(393);
      rect(overlay, sx, sy, S(18), S(8), phase ? PAL.t1 : PAL.c1);
      if (phase) {
        rect(overlay, sx + 8, sy + 5, 3, 3, PAL.g4);
        rect(overlay, sx + 11, sy + 7, 3, 2, PAL.g4);
        rect(overlay, sx + 14, sy + 3, 3, 4, PAL.g4);
      } else {
        for (const y of [sy + 3, sy + 6, sy + 9]) rect(overlay, sx + 4, y, S(11), 2, PAL.p2);
      }
    }
    const mode = document.getElementById("cafe-delivery-clerk").dataset.mode;
    if (mode === "plate") {
      frame(overlay, S(124), S(297), S(15), S(30), PAL.t0);
      rect(overlay, S(125), S(298), S(13), 2, PAL.t3);
      rect(overlay, S(135), S(310), 3, S(8), PAL.p3);
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
      const screen = screens.find((item) => item.key === key);
      if (!screen) return null;
      return {
        x: xPercent(screen.x), y: yPercent(screen.y),
        w: xPercent(screen.w), h: yPercent(screen.h),
      };
    },
    tray(key) {
      const screen = screens.find((item) => item.key === key);
      const seat = layout.find((item) => item.key === key);
      if (!screen || !seat) return null;
      const side = seat.direction !== "up";
      const offset = seat.direction === "left" ? -S(19) : side ? S(19) : -S(26);
      return { x: xPercent(seat.x + offset), y: yPercent(seat.y - (side ? S(8) : S(31))) };
    },
    show(space, seats) {
      if (area === space) return;
      area = space;
      layout = seats.map(({ key, point, ...seat }) => ({ key, ...pixel(point), ...seat }));
      avatars.querySelectorAll(".cafe-art-chair, .cafe-art-prop-front").forEach((element) => element.remove());
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
      hallDoors = [...Object.values(rooms), ...Object.values(lounges)].map((point) => {
        const { x, y } = pixel(point);
        return { x: x - S(12), y: y - S(27) };
      });
      if (area === "hall") lastPhase = "";
    },
  };
  setInterval(() => paintEffects(performance.now()), 100);
})();
