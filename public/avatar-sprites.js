// High-Craft 48x48 Cozy Chibi Pixel-Art Avatar Engine (4x7 Sprite Sheet)
// Inspired by Stardew Valley / Kairosoft / GPT Chibi Sheet proportions with 3-tone shading & #4c383d outlines

export const AVATAR_WARDROBE = {
  skins: [
    { id: 0, name: "치비 손님", species: "human", base: "#fbe3d3", hi: "#fff5eb", shade: "#e6bfa8", muzzle: "#fbe3d3" },
    { id: 1, name: "삼색 고양이", species: "cat", base: "#fff5eb", hi: "#ffffff", shade: "#dfd0d3", muzzle: "#ffffff" },
    { id: 2, name: "코지 곰돌이", species: "bear", base: "#ecc28e", hi: "#fbe3d3", shade: "#dc9666", muzzle: "#fff5eb" },
    { id: 3, name: "말랑 토끼", species: "bunny", base: "#fff7f2", hi: "#ffffff", shade: "#e8cfd2", muzzle: "#ffffff" },
    { id: 4, name: "카페 여우", species: "fox", base: "#e48349", hi: "#f5a571", shade: "#b85c2d", muzzle: "#fff5eb" },
    { id: 5, name: "아기 펭귄", species: "penguin", base: "#4f86b8", hi: "#6da4d4", shade: "#36618c", muzzle: "#fff9f4" },
  ],
  hairs: [
    { id: 0, name: "내추럴 숏컷" },
    { id: 1, name: "포근 단발뱅" },
    { id: 2, name: "롱 웨이브" },
    { id: 3, name: "코지 비니" },
    { id: 4, name: "동글 만두머리" },
    { id: 5, name: "별빛 핀 포인트" },
  ],
  hairColors: [
    { id: 0, name: "코코아 브라운", base: "#7a5448", hi: "#a87968", sh: "#593b33" },
    { id: 1, name: "플럼 에스프레소", base: "#4c383d", hi: "#73575e", sh: "#362529" },
    { id: 2, name: "캐러멜 밀크", base: "#c77d4e", hi: "#e8a576", sh: "#965832" },
    { id: 3, name: "버터 블론드", base: "#f6cf73", hi: "#fff1be", sh: "#d1a345" },
    { id: 4, name: "베리 로즈", base: "#d6607a", hi: "#f28da8", sh: "#a13d55" },
    { id: 5, name: "말차 세이지", base: "#569e7c", hi: "#84c7a7", sh: "#3a7357" },
  ],
  outfits: [
    { id: 0, name: "세이지 앞치마", body: "#569e7c", hi: "#7bc2a1", sub: "#3a6e54", accent: "#fff5eb", tie: "#fbe3d3" },
    { id: 1, name: "코지 가디건", body: "#dc9666", hi: "#ecc28e", sub: "#b86f4c", accent: "#fff5eb", tie: "#f6cf73" },
    { id: 2, name: "베리 스웨터", body: "#e8748c", hi: "#f5a2b3", sub: "#ba5268", accent: "#fff5eb", tie: "#fbe3d3" },
    { id: 3, name: "세이지 후드티", body: "#749e6b", hi: "#97bf8e", sub: "#4d6e46", accent: "#fbe3d3", tie: "#fff5eb" },
    { id: 4, name: "버터 멜빵바지", body: "#f6cf73", hi: "#ffe7a8", sub: "#c9973b", accent: "#fff9f2", tie: "#b86f4c" },
    { id: 5, name: "데님 자켓", body: "#6286ad", hi: "#85aad1", sub: "#425f80", accent: "#fff5eb", tie: "#e8748c" },
    { id: 6, name: "크림 세일러", body: "#fff5eb", hi: "#ffffff", sub: "#dfd0d3", accent: "#569e7c", tie: "#e8748c" },
    { id: 7, name: "모브 맨투맨", body: "#9e7b82", hi: "#c2a1a8", sub: "#73545b", accent: "#fbe3d3", tie: "#ffe7a8" },
  ],
  headsets: [
    { id: 0, name: "착용 안 함", color: null },
    { id: 1, name: "세이지 헤드셋", color: "#569e7c", band: "#4c383d" },
    { id: 2, name: "베리 고양이귀", color: "#e8748c", band: "#5e4347", ears: true },
    { id: 3, name: "크림 헤드폰", color: "#fbe3d3", band: "#b86f4c" },
    { id: 4, name: "미니 베레모", color: "#b86f4c", band: "#7a4c36", cap: true },
  ],
  accessories: [
    { id: 0, name: "없음" },
    { id: 1, name: "동글이 안경" },
    { id: 2, name: "호박색 틴트안경" },
    { id: 3, name: "코지 목도리" },
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
    headset: seed % 5 === 1 ? 1 : 0,
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

  const W = 48, H = 48;
  const grid = new Array(W * H).fill(null);
  // 3px transparent safety border so zero adjacent frame pixel bleed can occur
  const p = (x, y, col) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 3 && x <= W - 4 && y >= 3 && y <= H - 4 && col) grid[y * W + x] = col;
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
        if ((dx * dx) / (rx * rx + 0.4) + (dy * dy) / (ry * ry + 0.4) <= 1) {
          p(px(cx + dx), cy + dy, col);
        }
      }
    }
  };

  const isWalking = action === "walk";
  const isSeated = action === "sit";
  const bob = isWalking ? [0, -1, 0, -1][frame % 4] : isSeated ? (frame % 2 === 1 ? 1 : 0) : 0;
  const stepL = isWalking ? [0, -2, 0, 2][frame % 4] : 0;
  const stepR = isWalking ? [0, 2, 0, -2][frame % 4] : 0;
  const armBob = isWalking ? [-1, 0, 1, 0][frame % 4] : 0;

  // Crisp plump 48x48 GPT-sheet proportions!
  const headCenterY = (isSeated ? 22 : 19) + bob;
  const torsoY = headCenterY + 9;

  // Back hair layer for long wave / medium hair
  if (skin.species === "human" && (cfg.hair === 1 || cfg.hair === 2) && dir !== "up") {
    const hLen = cfg.hair === 2 ? 12 : 8;
    pellipse(24, headCenterY + 3, 11, hLen, hairCol.sh);
    pellipse(24, headCenterY + 2, 10, hLen - 1, hairCol.base);
  }

  // 1. Legs & Shoes (tucked cleanly when seated)
  if (isSeated) {
    if (side) {
      prect(22, torsoY + 8, 9, 4, "#5c7591");
      prect(28, torsoY + 10, 6, 3, "#6e4c49");
    } else {
      prect(17, torsoY + 8, 5, 3, "#5c7591");
      prect(26, torsoY + 8, 5, 3, "#5c7591");
    }
  } else if (side) {
    prect(20 + stepL, torsoY + 9, 5, 6, "#5c7591");
    prect(24 + stepR, torsoY + 9, 5, 6, "#455970");
    prect(20 + stepL, torsoY + 14, 6, 3, "#fff5eb");
    prect(24 + stepR, torsoY + 14, 6, 3, "#dfd0d3");
  } else {
    prect(17, torsoY + 9 + (stepL < 0 ? -1 : 0), 5, 6, "#5c7591");
    prect(26, torsoY + 9 + (stepR < 0 ? -1 : 0), 5, 6, "#5c7591");
    prect(16, torsoY + 14 + (stepL < 0 ? -1 : 0), 6, 3, "#fff5eb");
    prect(26, torsoY + 14 + (stepR < 0 ? -1 : 0), 6, 3, "#fff5eb");
    prect(17, torsoY + 16 + (stepL < 0 ? -1 : 0), 5, 1, "#6e4c49");
    prect(26, torsoY + 16 + (stepR < 0 ? -1 : 0), 5, 1, "#6e4c49");
  }

  // Species tails
  if ((skin.species === "cat" || skin.species === "fox") && dir !== "down") {
    const tx = side ? 13 : 29;
    prect(tx, torsoY + 6, 4, 5, skin.base);
    prect(tx + 1, torsoY + 4, 3, 3, skin.species === "fox" ? "#fff5eb" : hairCol.base);
  } else if (skin.species === "bunny" && dir === "up") {
    pellipse(24, torsoY + 8, 2, 2, "#ffffff");
  }

  // 2. Cozy Shaded Torso (3-tone highlights & pocket/collar details)
  if (side) {
    prect(18, torsoY, 12, 11, outfit.body);
    prect(19, torsoY + 1, 8, 3, outfit.hi);
    prect(18, torsoY + 8, 12, 3, outfit.sub);
    prect(24, torsoY + 2, 5, 7, outfit.accent);
  } else {
    prect(15, torsoY, 18, 11, outfit.body);
    prect(16, torsoY + 1, 16, 3, outfit.hi);
    prect(15, torsoY + 8, 18, 3, outfit.sub);
    if (dir === "down") {
      // Cozy cafe apron / bib / sailor collar
      prect(18, torsoY + 2, 12, 7, outfit.accent);
      prect(19, torsoY + 3, 10, 4, outfit.body);
      prect(21, torsoY + 1, 6, 2, outfit.tie);
      prect(20, torsoY + 7, 8, 2, outfit.sub);
      prect(22, torsoY + 4, 4, 2, outfit.tie);
    } else {
      prect(17, torsoY + 1, 14, 3, outfit.sub);
      prect(20, torsoY + 4, 8, 4, outfit.accent);
    }
  }

  // Scarf accessory
  if (cfg.accessory === 3) {
    prect(15, torsoY - 1, 18, 3, "#e8748c");
    prect(16, torsoY, 16, 1, "#f7a8b8");
    if (dir === "down") prect(26, torsoY + 1, 4, 5, "#e8748c");
  }

  // 3. Arms / Poses
  if (isSeated) {
    const tap = frame % 2;
    if (side) {
      prect(24, torsoY + 3, 7, 3, outfit.sub);
      prect(31, torsoY + 4 - tap, 3, 3, skin.base);
    } else {
      prect(12, torsoY + 2, 3, 5, outfit.sub);
      prect(33, torsoY + 2, 3, 5, outfit.sub);
      prect(13, torsoY + 4 - tap, 3, 2, skin.base);
      prect(32, torsoY + 3 + tap, 3, 2, skin.base);
    }
  } else if (action === "smoke" || action === "coffee" || action === "candy") {
    prect(12, torsoY + 2, 3, 6, outfit.sub);
    prect(12, torsoY + 7, 3, 2, skin.base);
    prect(33, torsoY + 1, 4, 5, outfit.body);
    prect(35, torsoY - 1, 3, 3, skin.base);
  } else if (side) {
    prect(21 + armBob, torsoY + 2, 5, 6, outfit.sub);
    prect(21 + armBob, torsoY + 7, 4, 3, skin.base);
  } else {
    prect(11, torsoY + 2 + armBob, 4, 6, outfit.sub);
    prect(11, torsoY + 7 + armBob, 4, 3, skin.base);
    prect(33, torsoY + 2 - armBob, 4, 6, outfit.sub);
    prect(33, torsoY + 7 - armBob, 4, 3, skin.base);
  }

  // 4. Ears
  const headTop = headCenterY - 9;
  if (skin.species === "bear") {
    pellipse(15, headTop + 1, 3, 3, skin.base);
    pellipse(33, headTop + 1, 3, 3, skin.base);
    prect(14, headTop, 2, 2, skin.shade);
    prect(32, headTop, 2, 2, skin.shade);
  } else if (skin.species === "cat" || skin.species === "fox") {
    pellipse(16, headTop + 1, 3, 4, skin.species === "cat" ? "#dc9666" : skin.base);
    pellipse(32, headTop + 1, 3, 4, skin.species === "cat" ? "#6e4c49" : skin.base);
    if (dir === "down") {
      prect(15, headTop, 2, 3, "#f7a8b8");
      prect(31, headTop, 2, 3, "#f7a8b8");
    }
  } else if (skin.species === "bunny") {
    prect(16, headTop - 6, 4, 9, skin.base);
    prect(28, headTop - 6, 4, 9, skin.base);
    if (dir === "down") {
      prect(17, headTop - 4, 2, 6, "#f7a8b8");
      prect(29, headTop - 4, 2, 6, "#f7a8b8");
    }
  }

  // 5. Rounded Plump Chibi Head (3-tone shading)
  pellipse(24, headCenterY, side ? 9 : 11, 8, skin.base);
  pellipse(24, headCenterY - 2, side ? 7 : 9, 5, skin.hi);
  prect(16, headCenterY + 6, 16, 2, skin.shade);

  if (skin.species === "cat") {
    if (dir !== "left") pellipse(16, headCenterY - 5, 4, 3, "#dc9666");
    if (dir !== "right") pellipse(31, headCenterY - 5, 4, 3, "#5e4347");
  } else if (skin.species === "penguin" && dir === "down") {
    pellipse(24, headCenterY + 2, 8, 5, skin.muzzle);
    pellipse(20, headCenterY - 3, 3, 2, skin.muzzle);
    pellipse(28, headCenterY - 3, 3, 2, skin.muzzle);
  } else if (skin.species === "fox" && dir === "down") {
    pellipse(24, headCenterY + 3, 8, 4, skin.muzzle);
  } else if (skin.species === "bear" && dir === "down") {
    pellipse(24, headCenterY + 3, 4, 3, skin.muzzle);
  }

  // 6. Rich Layered Hair & Cozy Hats
  if (skin.species === "human") {
    pellipse(24, headCenterY - 5, side ? 9 : 11, 5, hairCol.base);
    prect(17, headCenterY - 8, 10, 3, hairCol.hi);
    if (dir === "up") {
      pellipse(24, headCenterY, 11, 8, hairCol.base);
      pellipse(23, headCenterY - 3, 7, 4, hairCol.hi);
    } else if (side) {
      prect(14, headCenterY - 6, 9, 12, hairCol.base);
      prect(16, headCenterY - 5, 4, 5, hairCol.hi);
    } else {
      // Fluffy bangs + side strands frame the cheeks cleanly
      prect(13, headCenterY - 4, 3, 9, hairCol.base);
      prect(32, headCenterY - 4, 3, 9, hairCol.base);
      prect(16, headCenterY - 4, 4, 3, hairCol.base);
      prect(22, headCenterY - 4, 4, 2, hairCol.base);
      prect(28, headCenterY - 4, 4, 3, hairCol.base);
    }
    if (cfg.hair === 4) {
      pellipse(24, headTop - 1, 4, 3, hairCol.base);
      prect(22, headTop - 2, 3, 1, hairCol.hi);
    }
  }
  if (cfg.hair === 3) {
    prect(13, headCenterY - 9, 22, 6, hairCol.base);
    prect(14, headCenterY - 5, 20, 2, hairCol.hi);
  } else if (cfg.hair === 5 && dir === "down") {
    prect(29, headCenterY - 5, 3, 2, "#f6cf73");
    p(px(30), headCenterY - 5, "#fff5eb");
  }

  // 7. Expressive GPT-Style Eyes & Cheeks
  const eyeY = headCenterY + 1;
  if (dir === "down") {
    const blink = action === "idle" && frame % 4 === 3;
    if (blink) {
      prect(17, eyeY + 1, 3, 1, OUTLINE);
      prect(28, eyeY + 1, 3, 1, OUTLINE);
    } else {
      prect(17, eyeY - 1, 3, 3, OUTLINE);
      prect(28, eyeY - 1, 3, 3, OUTLINE);
      p(px(17), eyeY - 1, "#ffffff");
      p(px(28), eyeY - 1, "#ffffff");
      p(px(19), eyeY + 1, "#8c5c4a");
      p(px(30), eyeY + 1, "#8c5c4a");
    }
    prect(14, eyeY + 2, 3, 2, CHEEK);
    prect(31, eyeY + 2, 3, 2, CHEEK);

    if (skin.species === "penguin") {
      prect(22, eyeY + 1, 4, 2, "#f6cf73");
    } else if (skin.species === "human") {
      prect(23, eyeY + 3, 2, 1, "#d97b86");
    } else {
      prect(23, eyeY + 1, 2, 1, OUTLINE);
      prect(23, eyeY + 2, 2, 1, "#e8748c");
    }

    if (cfg.accessory === 1 || cfg.accessory === 2) {
      const lens = cfg.accessory === 2 ? "#f6cf73" : "#d6eff7";
      prect(16, eyeY - 2, 5, 5, OUTLINE);
      prect(27, eyeY - 2, 5, 5, OUTLINE);
      prect(21, eyeY, 6, 1, OUTLINE);
      prect(17, eyeY - 1, 3, 3, lens);
      prect(28, eyeY - 1, 3, 3, lens);
    }
  } else if (side) {
    prect(27, eyeY - 1, 3, 3, OUTLINE);
    p(px(27), eyeY - 1, "#ffffff");
    prect(26, eyeY + 2, 3, 2, CHEEK);
    if (skin.species === "penguin") prect(32, eyeY + 1, 3, 2, "#f6cf73");
    if (cfg.accessory === 1 || cfg.accessory === 2) {
      prect(26, eyeY - 2, 5, 5, OUTLINE);
      prect(27, eyeY - 1, 3, 3, cfg.accessory === 2 ? "#f6cf73" : "#d6eff7");
    }
  }

  // 8. Headsets & Mini Beret
  if (headset.id > 0) {
    if (headset.cap) {
      prect(16, headTop - 2, 16, 4, headset.color);
      if (dir === "down") prect(18, headTop + 1, 12, 1, headset.band);
    } else {
      prect(14, headTop - 1, 20, 2, headset.band);
      if (headset.ears) {
        prect(14, headTop - 4, 4, 3, headset.color);
        prect(30, headTop - 4, 4, 3, headset.color);
      }
      if (!side) {
        prect(11, eyeY - 2, 3, 6, headset.color);
        prect(34, eyeY - 2, 3, 6, headset.color);
      } else {
        prect(21, eyeY - 2, 4, 6, headset.color);
      }
    }
  }

  // 9. Break Zone Props (Cigarette / Milk Coffee / Candy)
  if (action === "smoke") {
    prect(37, torsoY - 3, 5, 2, "#fff5eb");
    prect(41, torsoY - 3, 1, 2, frame % 2 === 0 ? "#e8748c" : "#f6cf73");
  } else if (action === "coffee") {
    prect(36, torsoY - 5, 5, 6, "#fff5eb");
    prect(36, torsoY - 2, 5, 2, "#b86f4c");
  } else if (action === "candy") {
    prect(37, torsoY - 3, 1, 4, "#fff5eb");
    prect(36, torsoY - 7, 4, 4, "#e8748c");
  }

  // Crisp 1px #4c383d outline pass
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
  canvas.width = 48 * 4;
  canvas.height = 48 * 7;
  const ctx = canvas.getContext("2d");

  ["down", "up", "right", "left"].forEach((dir, row) => {
    for (let f = 0; f < 4; f++) {
      drawChibiFrame(ctx, f * 48, row * 48, cfg, dir, f === 0 ? "idle" : "walk", f);
    }
  });
  drawChibiFrame(ctx, 0, 4 * 48, cfg, "up", "sit", 0);
  drawChibiFrame(ctx, 48, 4 * 48, cfg, "up", "sit", 1);
  drawChibiFrame(ctx, 96, 4 * 48, cfg, "right", "sit", 0);
  drawChibiFrame(ctx, 144, 4 * 48, cfg, "right", "sit", 1);

  drawChibiFrame(ctx, 0, 5 * 48, cfg, "left", "sit", 0);
  drawChibiFrame(ctx, 48, 5 * 48, cfg, "left", "sit", 1);
  drawChibiFrame(ctx, 96, 5 * 48, cfg, "down", "smoke", 0);
  drawChibiFrame(ctx, 144, 5 * 48, cfg, "down", "smoke", 1);

  drawChibiFrame(ctx, 0, 6 * 48, cfg, "down", "coffee", 0);
  drawChibiFrame(ctx, 48, 6 * 48, cfg, "down", "coffee", 1);
  drawChibiFrame(ctx, 96, 6 * 48, cfg, "down", "candy", 0);
  drawChibiFrame(ctx, 144, 6 * 48, cfg, "down", "candy", 1);

  const url = canvas.toDataURL("image/png");
  spriteCache.set(key, url);
  return url;
}

export function renderAvatarPreview(canvas, avatarCode, action = "idle", frame = 0) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  const off = document.createElement("canvas");
  off.width = 48;
  off.height = 48;
  const cfg = normalizeAvatarCode(avatarCode, 0);
  drawChibiFrame(off.getContext("2d"), 0, 0, cfg, "down", action, frame);
  ctx.drawImage(off, 4, 3, 40, 42, 0, 0, canvas.width, canvas.height);
}

export function renderAvatarPortrait(canvas, avatarCode) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  const off = document.createElement("canvas");
  off.width = 48;
  off.height = 48;
  const cfg = normalizeAvatarCode(avatarCode, 0);
  drawChibiFrame(off.getContext("2d"), 0, 0, cfg, "down", "idle", 0);
  ctx.drawImage(off, 9, 5, 30, 30, 0, 0, canvas.width, canvas.height);
}
