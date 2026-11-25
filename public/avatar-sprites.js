// Adorable 2-Head-Tall Cozy Chibi Pixel-Art Avatar Engine (32x40 grid, 4x6 sprite sheet)
// Matches the cozy pastel café reference palette (#4c383d warm plum-espresso outlines, #fbe3d3 cream, #f28da8 berry cheeks)

export const AVATAR_WARDROBE = {
  skins: [
    { id: 0, name: "코지 곰돌이", species: "bear", base: "#f3c78b", shade: "#dc9666", muzzle: "#fff5eb" },
    { id: 1, name: "삼색 고양이", species: "cat", base: "#fff5eb", shade: "#dfd0d3", muzzle: "#ffffff" },
    { id: 2, name: "말랑 토끼", species: "bunny", base: "#fff7f2", shade: "#e8cfd2", muzzle: "#ffffff" },
    { id: 3, name: "아기 펭귄", species: "penguin", base: "#4f86b8", shade: "#36618c", muzzle: "#fff9f4" },
    { id: 4, name: "카페 여우", species: "fox", base: "#e48349", shade: "#b85c2d", muzzle: "#fff5eb" },
    { id: 5, name: "치비 손님", species: "human", base: "#fbe3d3", shade: "#e6bfa8", muzzle: "#fbe3d3" },
  ],
  hairs: [
    { id: 0, name: "내추럴 앞머리" },
    { id: 1, name: "포근 뱅스타일" },
    { id: 2, name: "리본 포인트" },
    { id: 3, name: "코지 비니" },
    { id: 4, name: "동글 베레모" },
    { id: 5, name: "별빛 핀" },
  ],
  hairColors: [
    { id: 0, name: "캐러멜 브라운", base: "#dc9666", hi: "#f6cf73" },
    { id: 1, name: "플럼 에스프레소", base: "#5e4347", hi: "#87656b" },
    { id: 2, name: "코코아 시나몬", base: "#b86f4c", hi: "#e09f74" },
    { id: 3, name: "버터 크림", base: "#f6cf73", hi: "#fff1be" },
    { id: 4, name: "베리 로즈", base: "#e8748c", hi: "#f7a8b8" },
    { id: 5, name: "말차 세이지", base: "#569e7c", hi: "#84c7a7" },
  ],
  outfits: [
    { id: 0, name: "세이지 앞치마", body: "#569e7c", sub: "#3e785c", accent: "#fff5eb", tie: "#fbe3d3" },
    { id: 1, name: "베리 스웨터", body: "#e8748c", sub: "#ba5268", accent: "#fff5eb", tie: "#f6cf73" },
    { id: 2, name: "버터 멜빵", body: "#f6cf73", sub: "#d49c45", accent: "#fff9f2", tie: "#b86f4c" },
    { id: 3, name: "캐러멜 가디건", body: "#dc9666", sub: "#b86f4c", accent: "#fbe3d3", tie: "#fff5eb" },
    { id: 4, name: "모브 후드티", body: "#9e7b82", sub: "#7a5b62", accent: "#fbe3d3", tie: "#ffe7a8" },
    { id: 5, name: "크림 세일러", body: "#fff5eb", sub: "#dfd0d3", accent: "#569e7c", tie: "#e8748c" },
    { id: 6, name: "올리브 니트", body: "#8ea147", sub: "#65752d", accent: "#fff5eb", tie: "#f6cf73" },
    { id: 7, name: "스카이블루 자켓", body: "#74a8c9", sub: "#4d7d9e", accent: "#fff5eb", tie: "#ffe7a8" },
  ],
  headsets: [
    { id: 0, name: "착용 안 함", color: null },
    { id: 1, name: "세이지 헤드셋", color: "#569e7c", band: "#4c383d" },
    { id: 2, name: "베리 고양이귀", color: "#e8748c", band: "#5e4347", ears: true },
    { id: 3, name: "밀크티 헤드폰", color: "#fbe3d3", band: "#b86f4c" },
    { id: 4, name: "미니 알바모자", color: "#569e7c", band: "#fff5eb", cap: true },
  ],
  accessories: [
    { id: 0, name: "없음" },
    { id: 1, name: "동글이 안경" },
    { id: 2, name: "버터 틴트안경" },
    { id: 3, name: "딸기 목도리" },
  ],
};

export function normalizeAvatarCode(code, fallbackColor = 0) {
  if (typeof code === "string" && /^[0-9a-f]{6}$/i.test(code)) {
    return {
      skin: parseInt(code[0], 16) % AVATAR_WARDROBE.skins.length,
      hair: parseInt(code[1], 16) % AVATAR_WARDROBE.hairs.length,
      hairColor: parseInt(code[2], 16) % AVATAR_WARDROBE.hairColors.length,
      outfit: parseInt(code[3], 16) % AVATAR_WARDROBE.outfits.length,
      headset: parseInt(code[4], 16) % AVATAR_WARDROBE.headsets.length,
      accessory: parseInt(code[5], 16) % AVATAR_WARDROBE.accessories.length,
    };
  }
  const seed = Number.isInteger(fallbackColor) ? Math.abs(fallbackColor) : 0;
  return {
    skin: seed % AVATAR_WARDROBE.skins.length,
    hair: seed % AVATAR_WARDROBE.hairs.length,
    hairColor: seed % AVATAR_WARDROBE.hairColors.length,
    outfit: seed % AVATAR_WARDROBE.outfits.length,
    headset: seed % 5 === 1 ? 4 : 0,
    accessory: 0,
  };
}

export function encodeAvatarCode(cfg) {
  return [
    (cfg.skin ?? 0) % AVATAR_WARDROBE.skins.length,
    (cfg.hair ?? 0) % AVATAR_WARDROBE.hairs.length,
    (cfg.hairColor ?? 0) % AVATAR_WARDROBE.hairColors.length,
    (cfg.outfit ?? 0) % AVATAR_WARDROBE.outfits.length,
    (cfg.headset ?? 0) % AVATAR_WARDROBE.headsets.length,
    (cfg.accessory ?? 0) % AVATAR_WARDROBE.accessories.length,
  ].map((n) => n.toString(16)).join("");
}

const spriteCache = new Map();
const OUTLINE = "#4c383d";
const CHEEK = "#f28da8";

function drawChibiFrame(ctx, ox, oy, cfg, dir, action, frame) {
  const skin = AVATAR_WARDROBE.skins[cfg.skin];
  const hairCol = AVATAR_WARDROBE.hairColors[cfg.hairColor];
  const outfit = AVATAR_WARDROBE.outfits[cfg.outfit];
  const headset = AVATAR_WARDROBE.headsets[cfg.headset];

  const W = 32, H = 40;
  const grid = new Array(W * H).fill(null);
  // Keep 2px transparent safety margin (x: 2..29, y: 2..37) so fractional scaling never bleeds into neighbor frames!
  const p = (x, y, col) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 2 && x <= W - 3 && y >= 2 && y <= H - 3 && col) grid[y * W + x] = col;
  };
  const side = dir === "left" || dir === "right";
  const flip = dir === "left";
  const px = (x) => (flip ? W - 1 - x : x);
  const prect = (x, y, w, h, col) => {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) p(px(x + dx), y + dy, col);
    }
  };
  const pellipse = (cx, cy, rx, ry, col) => {
    for (let dy = -ry; dy <= ry; dy++) {
      for (let dx = -rx; dx <= rx; dx++) {
        if ((dx * dx) / (rx * rx + 0.35) + (dy * dy) / (ry * ry + 0.35) <= 1) {
          p(px(cx + dx), cy + dy, col);
        }
      }
    }
  };

  const isWalking = action === "walk";
  const isSeated = action === "sit";
  const bob = isWalking ? [0, -1, 0, -1][frame % 4] : isSeated ? (frame % 2 === 1 ? 1 : 0) : 0;
  const stepL = isWalking ? [0, -1, 0, 1][frame % 4] : 0;
  const stepR = isWalking ? [0, 1, 0, -1][frame % 4] : 0;
  const armBob = isWalking ? [-1, 0, 1, 0][frame % 4] : 0;

  // Big adorable 2-head-tall chibi proportions! Seated tucks lower so the character sits IN the chair.
  const headCenterY = (isSeated ? 19 : 16) + bob;
  const torsoY = headCenterY + 7;

  // 1. Feet / Stubby legs (tucked neatly forward when seated!)
  if (isSeated) {
    if (side) {
      prect(13, torsoY + 6, 8, 3, outfit.sub);
      prect(18, torsoY + 8, 5, 2, "#6e4c49");
    } else {
      prect(10, torsoY + 6, 4, 3, outfit.sub);
      prect(18, torsoY + 6, 4, 3, outfit.sub);
    }
  } else if (side) {
    prect(12 + stepL, torsoY + 7, 4, 5, skin.shade);
    prect(15 + stepR, torsoY + 7, 4, 5, OUTLINE);
    prect(12 + stepL, torsoY + 11, 5, 2, skin.base);
  } else {
    prect(10, torsoY + 7 + (stepL < 0 ? -1 : 0), 4, 5, skin.shade);
    prect(18, torsoY + 7 + (stepR < 0 ? -1 : 0), 4, 5, skin.shade);
    prect(10, torsoY + 11 + (stepL < 0 ? -1 : 0), 4, 2, "#6e4c49");
    prect(18, torsoY + 11 + (stepR < 0 ? -1 : 0), 4, 2, "#6e4c49");
  }

  // Tail for cat/fox/bunny when up or side
  if ((skin.species === "cat" || skin.species === "fox") && dir !== "down") {
    const tailX = side ? 8 : 19;
    prect(tailX, torsoY + 5, 3, 4, skin.base);
    p(px(tailX + 1), torsoY + 4, skin.species === "fox" ? "#fff5eb" : hairCol.base);
  } else if (skin.species === "bunny" && dir === "up") {
    prect(14, torsoY + 6, 4, 3, "#ffffff");
  }

  // 2. Chunky Cozy Torso (apron / sweater / jacket)
  if (side) {
    prect(11, torsoY, 10, 9, outfit.body);
    prect(11, torsoY + 7, 10, 2, outfit.sub);
    prect(16, torsoY + 2, 4, 5, outfit.accent);
  } else {
    prect(9, torsoY, 14, 9, outfit.body);
    prect(9, torsoY + 7, 14, 2, outfit.sub);
    if (dir === "down") {
      // Cozy bib/apron or collar detail like the reference picture
      prect(11, torsoY + 2, 10, 5, outfit.accent);
      prect(12, torsoY + 3, 8, 3, outfit.body);
      prect(14, torsoY + 1, 4, 2, outfit.tie);
      prect(13, torsoY + 6, 6, 2, outfit.sub);
    } else {
      prect(11, torsoY + 1, 10, 2, outfit.sub);
      prect(13, torsoY + 3, 6, 4, outfit.accent);
    }
  }

  // Cozy scarf accessory around neck
  if (cfg.accessory === 3) {
    prect(9, torsoY, 14, 2, "#e8748c");
    if (dir === "down") prect(17, torsoY + 1, 3, 4, "#f7a8b8");
  }

  // 3. Cute Stubby Arms / Interactive Props
  if (isSeated) {
    const tap = frame % 2;
    if (side) {
      // Arms reaching forward toward the keyboard!
      prect(16, torsoY + 2, 5, 3, outfit.sub);
      prect(21, torsoY + 3 - tap, 3, 2, skin.base);
    } else {
      prect(7, torsoY + 1, 3, 4, outfit.sub);
      prect(22, torsoY + 1, 3, 4, outfit.sub);
      prect(8, torsoY + 3 - tap, 2, 2, skin.base);
      prect(22, torsoY + 2 + tap, 2, 2, skin.base);
    }
  } else if (action === "smoke" || action === "coffee" || action === "candy") {
    prect(7, torsoY + 1, 3, 5, outfit.sub);
    prect(7, torsoY + 5, 3, 2, skin.base);
    prect(22, torsoY, 4, 4, outfit.body);
    prect(24, torsoY - 2, 2, 3, skin.base);
  } else if (side) {
    prect(14 + armBob, torsoY + 2, 4, 5, outfit.sub);
    prect(14 + armBob, torsoY + 6, 3, 2, skin.base);
  } else {
    prect(6, torsoY + 1 + armBob, 3, 5, outfit.sub);
    prect(6, torsoY + 5 + armBob, 3, 2, skin.base);
    prect(23, torsoY + 1 - armBob, 3, 5, outfit.sub);
    prect(23, torsoY + 5 - armBob, 3, 2, skin.base);
  }

  // 4. Ears behind/on top of rounded Chibi Head
  const headTop = headCenterY - 6;
  if (skin.species === "bear") {
    pellipse(9, headTop, 2, 2, skin.base);
    pellipse(23, headTop, 2, 2, skin.base);
    p(px(9), headTop, skin.shade);
    p(px(23), headTop, skin.shade);
  } else if (skin.species === "cat" || skin.species === "fox") {
    // Pointed triangular ears like the reference Fox/Cat!
    prect(8, headTop - 3, 4, 5, skin.base);
    prect(9, headTop - 4, 2, 2, skin.base);
    prect(20, headTop - 3, 4, 5, skin.species === "cat" ? "#b86f4c" : skin.base);
    prect(21, headTop - 4, 2, 2, skin.species === "cat" ? "#b86f4c" : skin.base);
    if (dir === "down") {
      prect(9, headTop - 2, 2, 3, "#f7a8b8");
      prect(21, headTop - 2, 2, 3, "#f7a8b8");
    }
  } else if (skin.species === "bunny") {
    prect(10, headTop - 6, 3, 7, skin.base);
    prect(19, headTop - 6, 3, 7, skin.base);
    if (dir === "down") {
      prect(11, headTop - 5, 1, 5, "#f7a8b8");
      prect(20, headTop - 5, 1, 5, "#f7a8b8");
    }
  }

  // 5. Rounded Plump Chibi Head (16x13 rounded oval)
  pellipse(16, headCenterY, side ? 7 : 8, 6, skin.base);
  // Subtle chin warmth/shadow
  prect(11, headCenterY + 5, 10, 1, skin.shade);

  // Species markings (Calico spots, Penguin cream belly-face, Fox cheeks)
  if (skin.species === "cat") {
    if (dir !== "left") prect(9, headCenterY - 5, 5, 4, "#dc9666");
    if (dir !== "right") prect(18, headCenterY - 5, 5, 4, "#5e4347");
  } else if (skin.species === "penguin" && dir === "down") {
    pellipse(16, headCenterY + 1, 6, 4, skin.muzzle);
    prect(13, headCenterY - 3, 2, 2, skin.muzzle);
    prect(17, headCenterY - 3, 2, 2, skin.muzzle);
  } else if (skin.species === "fox" && dir === "down") {
    prect(9, headCenterY + 1, 5, 4, skin.muzzle);
    prect(18, headCenterY + 1, 5, 4, skin.muzzle);
    prect(13, headCenterY + 2, 6, 4, skin.muzzle);
  } else if (skin.species === "bear" && dir === "down") {
    pellipse(16, headCenterY + 2, 3, 2, skin.muzzle);
  }

  // 6. Human hair or animal hair tuff/beanie
  if (skin.species === "human") {
    prect(9, headCenterY - 6, 14, 4, hairCol.base);
    prect(11, headCenterY - 5, 6, 2, hairCol.hi);
    if (dir === "up") {
      pellipse(16, headCenterY, 7, 5, hairCol.base);
    } else if (side) {
      prect(8, headCenterY - 4, 6, 8, hairCol.base);
    } else {
      prect(8, headCenterY - 3, 2, 7, hairCol.base);
      prect(22, headCenterY - 3, 2, 7, hairCol.base);
      prect(11, headCenterY - 3, 10, 2, hairCol.base);
      p(px(15), headCenterY - 2, skin.base);
    }
  } else if (cfg.hair === 1) {
    // Cozy bangs/tuft on animal forehead
    prect(12, headCenterY - 6, 8, 2, hairCol.base);
    p(px(14), headCenterY - 5, hairCol.hi);
  } else if (cfg.hair === 2 && dir === "down") {
    // Cute pastel ribbon on ear
    prect(8, headCenterY - 6, 3, 2, hairCol.base);
    p(px(9), headCenterY - 6, hairCol.hi);
  } else if (cfg.hair === 3) {
    // Warm beanie hat
    prect(9, headCenterY - 7, 14, 4, hairCol.base);
    prect(10, headCenterY - 5, 12, 2, hairCol.hi);
  } else if (cfg.hair === 4) {
    // Artist beret
    prect(10, headCenterY - 7, 12, 3, hairCol.base);
    p(px(16), headCenterY - 8, hairCol.base);
  } else if (cfg.hair === 5 && dir === "down") {
    // Butter star hairclip
    prect(20, headCenterY - 4, 2, 2, "#f6cf73");
  }

  // 7. Expressive Reference-Style Face (Sparkle Eyes, Rosy Cheeks, Little Snout/Beak)
  const eyeY = headCenterY;
  if (dir === "down") {
    const blink = action === "idle" && frame % 4 === 3;
    if (blink) {
      prect(11, eyeY + 1, 2, 1, OUTLINE);
      prect(19, eyeY + 1, 2, 1, OUTLINE);
    } else {
      prect(11, eyeY, 2, 2, OUTLINE);
      prect(19, eyeY, 2, 2, OUTLINE);
      p(px(11), eyeY, "#ffffff");
      p(px(19), eyeY, "#ffffff");
    }
    // Rosy pastel cheeks
    prect(9, eyeY + 2, 2, 1, CHEEK);
    prect(21, eyeY + 2, 2, 1, CHEEK);

    // Cute nose / beak
    if (skin.species === "penguin") {
      prect(15, eyeY + 1, 2, 2, "#f6cf73");
    } else if (skin.species === "human") {
      p(px(15), eyeY + 3, "#d9828c");
      p(px(16), eyeY + 3, "#d9828c");
    } else {
      prect(15, eyeY + 1, 2, 1, OUTLINE);
      p(px(15), eyeY + 2, "#e8748c");
    }

    // Round glasses / tint glasses
    if (cfg.accessory === 1 || cfg.accessory === 2) {
      const lens = cfg.accessory === 2 ? "#f6cf73" : "#d6eff7";
      prect(10, eyeY - 1, 4, 4, OUTLINE);
      prect(18, eyeY - 1, 4, 4, OUTLINE);
      prect(14, eyeY, 4, 1, OUTLINE);
      prect(11, eyeY, 2, 2, lens);
      prect(19, eyeY, 2, 2, lens);
    }
  } else if (side) {
    prect(19, eyeY, 2, 2, OUTLINE);
    p(px(19), eyeY, "#ffffff");
    prect(18, eyeY + 2, 2, 1, CHEEK);
    if (skin.species === "penguin") prect(22, eyeY + 1, 2, 2, "#f6cf73");
    if (cfg.accessory === 1 || cfg.accessory === 2) {
      prect(18, eyeY - 1, 4, 4, OUTLINE);
      prect(19, eyeY, 2, 2, cfg.accessory === 2 ? "#f6cf73" : "#d6eff7");
    }
  }

  // 8. Headsets & Cute Cafe Visor Caps
  if (headset.id > 0) {
    if (headset.cap) {
      prect(11, headTop - 1, 10, 3, headset.color);
      if (dir === "down") prect(12, headTop + 1, 8, 1, headset.band);
    } else {
      prect(10, headTop, 12, 2, headset.band);
      if (headset.ears) {
        prect(9, headTop - 2, 3, 2, headset.color);
        prect(20, headTop - 2, 3, 2, headset.color);
      }
      if (!side) {
        prect(7, eyeY - 1, 2, 4, headset.color);
        prect(23, eyeY - 1, 2, 4, headset.color);
      } else {
        prect(13, eyeY - 1, 3, 4, headset.color);
      }
    }
  }

  // 9. Break Zone Hand Props (Smoking / Warm Milk Coffee / Candy)
  if (action === "smoke") {
    prect(24, torsoY - 3, 4, 1, "#fff5eb");
    p(px(28), torsoY - 3, frame % 2 === 0 ? "#e8748c" : "#f6cf73");
  } else if (action === "coffee") {
    prect(23, torsoY - 4, 4, 5, "#fff5eb");
    prect(23, torsoY - 2, 4, 2, "#b86f4c");
    p(px(25), torsoY - 5, "#ffe7a8");
  } else if (action === "candy") {
    prect(24, torsoY - 3, 1, 3, "#fff5eb");
    prect(23, torsoY - 6, 3, 3, "#e8748c");
  }

  // Crisp #4c383d 1px automatic pixel outline pass (keeps 1px outermost margin inside 32x40 cell)
  ctx.fillStyle = OUTLINE;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (grid[y * W + x]) continue;
      if (
        (x > 0 && grid[y * W + x - 1]) ||
        (x < W - 1 && grid[y * W + x + 1]) ||
        (y > 0 && grid[(y - 1) * W + x]) ||
        (y < H - 1 && grid[(y + 1) * W + x])
      ) {
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const col = grid[y * W + x];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

export function getAvatarSheetUrl(avatarCode, fallbackColor = 0) {
  const cfg = normalizeAvatarCode(avatarCode, fallbackColor);
  const key = encodeAvatarCode(cfg);
  if (spriteCache.has(key)) return spriteCache.get(key);

  const canvas = document.createElement("canvas");
  canvas.width = 32 * 4;
  canvas.height = 40 * 7;
  const ctx = canvas.getContext("2d");

  ["down", "up", "right", "left"].forEach((dir, row) => {
    for (let f = 0; f < 4; f++) {
      drawChibiFrame(ctx, f * 32, row * 40, cfg, dir, f === 0 ? "idle" : "walk", f);
    }
  });
  // Row 4: Seated typing (up cols 0-1, right cols 2-3)
  drawChibiFrame(ctx, 0, 4 * 40, cfg, "up", "sit", 0);
  drawChibiFrame(ctx, 32, 4 * 40, cfg, "up", "sit", 1);
  drawChibiFrame(ctx, 64, 4 * 40, cfg, "right", "sit", 0);
  drawChibiFrame(ctx, 96, 4 * 40, cfg, "right", "sit", 1);

  // Row 5: Seated typing left (cols 0-1) + smoking break (cols 2-3)
  drawChibiFrame(ctx, 0, 5 * 40, cfg, "left", "sit", 0);
  drawChibiFrame(ctx, 32, 5 * 40, cfg, "left", "sit", 1);
  drawChibiFrame(ctx, 64, 5 * 40, cfg, "down", "smoke", 0);
  drawChibiFrame(ctx, 96, 5 * 40, cfg, "down", "smoke", 1);

  // Row 6: Coffee break (cols 0-1) + candy break (cols 2-3)
  drawChibiFrame(ctx, 0, 6 * 40, cfg, "down", "coffee", 0);
  drawChibiFrame(ctx, 32, 6 * 40, cfg, "down", "coffee", 1);
  drawChibiFrame(ctx, 64, 6 * 40, cfg, "down", "candy", 0);
  drawChibiFrame(ctx, 96, 6 * 40, cfg, "down", "candy", 1);

  const url = canvas.toDataURL("image/png");
  spriteCache.set(key, url);
  return url;
}

export function renderAvatarPreview(canvas, avatarCode, action = "idle", frame = 0) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  const cfg = normalizeAvatarCode(avatarCode, 0);
  drawChibiFrame(ctx, 0, 0, cfg, "down", action, frame);
}

export function renderAvatarPortrait(canvas, avatarCode) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  const off = document.createElement("canvas");
  off.width = 32;
  off.height = 40;
  const cfg = normalizeAvatarCode(avatarCode, 0);
  drawChibiFrame(off.getContext("2d"), 0, 0, cfg, "down", "idle", 0);
  ctx.drawImage(off, 4, 3, 24, 24, 0, 0, canvas.width, canvas.height);
}
