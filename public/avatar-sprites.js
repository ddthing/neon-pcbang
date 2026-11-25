// High-Definition 4-Directional Customizable Cozy Pixel-Art Avatar Engine
// Unified Reference Palette (#4c383d warm plum-espresso outlines, #fbe3d3 cream, #569e7c sage, #dc9666 caramel, #9e7b82 mauve, #e8748c berry)

export const AVATAR_WARDROBE = {
  skins: [
    { id: 0, name: "복숭아크림", base: "#fbe3d3", shade: "#e6bfa8" },
    { id: 1, name: "바닐라밀크", base: "#fff1e6", shade: "#ebcfc0" },
    { id: 2, name: "허니토스트", base: "#ecc28e", shade: "#cf9d66" },
  ],
  hairs: [
    { id: 0, name: "댄디 투블럭" },
    { id: 1, name: "태슬 단발" },
    { id: 2, name: "하이 포니테일" },
    { id: 3, name: "코지 비니" },
    { id: 4, name: "롱 웨이브" },
    { id: 5, name: "복슬 히피펌" },
  ],
  hairColors: [
    { id: 0, name: "코코아 브라운", base: "#6e4c49", hi: "#916964" },
    { id: 1, name: "플럼 에스프레소", base: "#4c383d", hi: "#73575e" },
    { id: 2, name: "시나몬 캐러멜", base: "#b86f4c", hi: "#dc9666" },
    { id: 3, name: "버터 블론드", base: "#ecc28e", hi: "#ffe7a8" },
    { id: 4, name: "베리 로즈", base: "#a85266", hi: "#e8748c" },
    { id: 5, name: "말차 세이지", base: "#569e7c", hi: "#82c4a4" },
  ],
  outfits: [
    { id: 0, name: "세이지 후드티", body: "#569e7c", sub: "#3f7a5e", accent: "#fbe3d3" },
    { id: 1, name: "코코아 가디건", body: "#9e7b82", sub: "#7e5e68", accent: "#ffe7a8" },
    { id: 2, name: "버터 니트베스트", body: "#f6cf73", sub: "#dc9666", accent: "#fff5eb" },
    { id: 3, name: "캐러멜 패딩조끼", body: "#b86f4c", sub: "#8c5136", accent: "#fbe3d3" },
    { id: 4, name: "모브 맨투맨", body: "#c7aeb3", sub: "#9e7b82", accent: "#fff5eb" },
    { id: 5, name: "베리 체크남방", body: "#e8748c", sub: "#ba5268", accent: "#fbe3d3" },
    { id: 6, name: "올리브 과잠", body: "#8ea147", sub: "#677830", accent: "#fff5eb" },
    { id: 7, name: "스카이블루 셔츠", body: "#89c4e1", sub: "#5e98b8", accent: "#fff5eb" },
  ],
  headsets: [
    { id: 0, name: "착용 안 함", color: null },
    { id: 1, name: "세이지 헤드폰", color: "#569e7c", band: "#4c383d" },
    { id: 2, name: "베리 고양이귀", color: "#e8748c", band: "#6e4c49", ears: true },
    { id: 3, name: "크림 레트로 헤드폰", color: "#fbe3d3", band: "#b86f4c" },
    { id: 4, name: "코지 베레모", color: "#b86f4c", band: "#7e5e68", cap: true },
  ],
  accessories: [
    { id: 0, name: "없음" },
    { id: 1, name: "동글이 안경" },
    { id: 2, name: "버터 틴트선글라스" },
    { id: 3, name: "크림 마스크" },
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
  const seed = Number.isInteger(fallbackColor) ? fallbackColor : 0;
  return {
    skin: seed % 3,
    hair: seed % 6,
    hairColor: seed % 6,
    outfit: seed % 8,
    headset: seed === 1 ? 1 : 0,
    accessory: 0,
  };
}

export function encodeAvatarCode(cfg) {
  return [
    (cfg.skin ?? 0) % 3,
    (cfg.hair ?? 0) % 6,
    (cfg.hairColor ?? 0) % 6,
    (cfg.outfit ?? 0) % 8,
    (cfg.headset ?? 0) % 5,
    (cfg.accessory ?? 0) % 4,
  ].map((n) => n.toString(16)).join("");
}

const spriteCache = new Map();
const OUTLINE = "#4c383d";

function drawPixelFrame(ctx, ox, oy, cfg, dir, action, frame) {
  const skin = AVATAR_WARDROBE.skins[cfg.skin];
  const hairCol = AVATAR_WARDROBE.hairColors[cfg.hairColor];
  const outfit = AVATAR_WARDROBE.outfits[cfg.outfit];
  const headset = AVATAR_WARDROBE.headsets[cfg.headset];

  const W = 32, H = 40;
  const grid = new Array(W * H).fill(null);
  const p = (x, y, col) => {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && x < W && y >= 0 && y < H && col) grid[y * W + x] = col;
  };

  const isWalking = action === "walk";
  const isSeated = action === "sit";
  const bob = isWalking ? [0, -1, 0, -1][frame % 4] : 0;
  const stride = isWalking ? [-2, 0, 2, 0][frame % 4] : 0;
  const side = dir === "left" || dir === "right";
  const flip = dir === "left";
  const px = (x) => flip ? (W - 1 - x) : x;
  const prect = (x, y, w, h, col) => {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) p(px(x + dx), y + dy, col);
  };

  const headY = (isSeated ? 9 : 6) + bob;
  const torsoY = headY + 13;

  if (cfg.hair === 4 || cfg.hair === 5) {
    prect(9, headY + 6, 14, 11, hairCol.base);
  }
  if (cfg.hair === 2 && dir !== "down") {
    prect(side ? 7 : 13, headY + 2, 5, 9, hairCol.base);
    prect(side ? 8 : 14, headY + 3, 2, 4, hairCol.hi);
  }

  if (isSeated) {
    prect(11, torsoY + 9, 4, 4, "#6e4c49");
    prect(17, torsoY + 9, 4, 4, "#6e4c49");
    prect(10, torsoY + 12, 5, 2, "#fbe3d3");
    prect(17, torsoY + 12, 5, 2, "#fbe3d3");
  } else if (side) {
    prect(13 + stride, torsoY + 10, 4, 6, "#6e4c49");
    prect(14 - stride, torsoY + 10, 4, 6, "#593b39");
    prect(13 + stride, torsoY + 15, 6, 2, "#fbe3d3");
    prect(14 - stride, torsoY + 15, 6, 2, "#dfd0d3");
  } else {
    const lOff = isWalking ? (frame % 4 === 0 ? -1 : frame % 4 === 2 ? 1 : 0) : 0;
    prect(11, torsoY + 10 + (lOff < 0 ? -1 : 0), 4, 6, "#6e4c49");
    prect(17, torsoY + 10 + (lOff > 0 ? -1 : 0), 4, 6, "#6e4c49");
    prect(10, torsoY + 15 + (lOff < 0 ? -1 : 0), 5, 2, "#fbe3d3");
    prect(17, torsoY + 15 + (lOff > 0 ? -1 : 0), 5, 2, "#fbe3d3");
  }

  prect(10, torsoY, 12, 10, outfit.body);
  prect(10, torsoY + 8, 12, 2, outfit.sub);
  if (dir === "down") {
    prect(14, torsoY, 4, 2, skin.shade);
    prect(13, torsoY + 2, 6, 2, outfit.accent);
    if (cfg.outfit === 1 || cfg.outfit === 6 || cfg.outfit === 7) {
      prect(15, torsoY + 2, 2, 8, outfit.accent);
    }
  } else if (dir === "up") {
    prect(11, torsoY + 1, 10, 3, outfit.sub);
    prect(13, torsoY + 2, 6, 1, outfit.accent);
  } else {
    prect(14, torsoY + 1, 4, 8, outfit.sub);
    prect(16, torsoY + 2, 2, 6, outfit.accent);
  }

  const armSwing = isWalking ? [-2, 0, 2, 0][frame % 4] : 0;
  if (isSeated) {
    const typeLift = frame % 2;
    prect(8, torsoY + 2, 3, 5, outfit.sub);
    prect(21, torsoY + 2, 3, 5, outfit.sub);
    prect(9, torsoY + 5 - typeLift, 3, 2, skin.base);
    prect(20, torsoY + 4 + typeLift, 3, 2, skin.base);
  } else if (action === "smoke" || action === "coffee" || action === "candy") {
    prect(8, torsoY + 2, 3, 7, outfit.sub);
    prect(8, torsoY + 8, 3, 2, skin.base);
    prect(21, torsoY + 1, 4, 5, outfit.body);
    prect(23, torsoY - 1, 3, 3, skin.base);
  } else if (side) {
    prect(14 - armSwing, torsoY + 2, 4, 6, outfit.sub);
    prect(14 - armSwing, torsoY + 8, 3, 2, skin.base);
  } else {
    prect(8, torsoY + 2 + armSwing, 3, 6, outfit.sub);
    prect(8, torsoY + 8 + armSwing, 3, 2, skin.base);
    prect(21, torsoY + 2 - armSwing, 3, 6, outfit.sub);
    prect(21, torsoY + 8 - armSwing, 3, 2, skin.base);
  }

  prect(10, headY + 2, 12, 11, skin.base);
  prect(11, headY + 12, 10, 1, skin.shade);

  if (dir === "down") {
    const blink = action === "idle" && frame % 4 === 3;
    if (blink) {
      prect(12, headY + 8, 2, 1, OUTLINE);
      prect(18, headY + 8, 2, 1, OUTLINE);
    } else {
      prect(12, headY + 7, 2, 2, OUTLINE);
      prect(18, headY + 7, 2, 2, OUTLINE);
      p(px(12), headY + 7, "#ffffff");
      p(px(18), headY + 7, "#ffffff");
    }
    p(px(11), headY + 9, "#f49cb0");
    p(px(20), headY + 9, "#f49cb0");
    if (cfg.accessory === 1) {
      prect(11, headY + 6, 4, 3, OUTLINE);
      prect(17, headY + 6, 4, 3, OUTLINE);
      prect(15, headY + 7, 2, 1, OUTLINE);
      prect(12, headY + 7, 2, 1, "#89c4e1");
      prect(18, headY + 7, 2, 1, "#89c4e1");
    } else if (cfg.accessory === 2) {
      prect(11, headY + 7, 10, 2, "#f6cf73");
      prect(11, headY + 6, 10, 1, "#7e5e68");
    } else if (cfg.accessory === 3) {
      prect(11, headY + 9, 10, 4, "#fbe3d3");
    }
  } else if (side) {
    prect(19, headY + 7, 2, 2, OUTLINE);
    p(px(19), headY + 7, "#ffffff");
    p(px(20), headY + 9, "#f49cb0");
    if (cfg.accessory === 1) prect(18, headY + 6, 4, 2, OUTLINE);
    if (cfg.accessory === 2) prect(18, headY + 7, 4, 2, "#f6cf73");
    if (cfg.accessory === 3) prect(17, headY + 9, 5, 4, "#fbe3d3");
  }

  if (cfg.hair === 3) {
    prect(9, headY, 14, 6, hairCol.base);
    prect(10, headY + 4, 12, 2, hairCol.hi);
  } else {
    prect(9, headY + 1, 14, 4, hairCol.base);
    prect(11, headY + 2, 6, 2, hairCol.hi);
    if (dir === "up") {
      prect(9, headY + 4, 14, 8, hairCol.base);
      prect(12, headY + 5, 5, 3, hairCol.hi);
    } else if (side) {
      prect(9, headY + 4, 8, 7, hairCol.base);
      prect(17, headY + 4, 4, 2, hairCol.base);
      if (cfg.hair === 1) prect(10, headY + 9, 6, 4, hairCol.base);
    } else {
      prect(9, headY + 4, 3, cfg.hair === 1 || cfg.hair === 4 ? 8 : 4, hairCol.base);
      prect(20, headY + 4, 3, cfg.hair === 1 || cfg.hair === 4 ? 8 : 4, hairCol.base);
      prect(12, headY + 4, 8, 2, hairCol.base);
      p(px(15), headY + 5, skin.base);
    }
  }

  if (headset.id > 0) {
    if (headset.cap) {
      prect(9, headY, 14, 5, headset.color);
      if (dir === "down") prect(10, headY + 4, 12, 2, headset.band);
      else if (side) prect(16, headY + 4, 8, 2, headset.band);
    } else {
      prect(9, headY, 14, 2, headset.band);
      if (headset.ears) {
        prect(10, headY - 2, 3, 2, headset.color);
        prect(19, headY - 2, 3, 2, headset.color);
      }
      if (dir !== "up") {
        prect(8, headY + 5, 3, 5, headset.color);
        if (!side) prect(21, headY + 5, 3, 5, headset.color);
      } else {
        prect(8, headY + 5, 3, 5, headset.color);
        prect(21, headY + 5, 3, 5, headset.color);
      }
    }
  }

  if (action === "smoke") {
    prect(25, torsoY - 2, 4, 1, "#fff5eb");
    p(px(29), torsoY - 2, frame % 2 === 0 ? "#e87468" : "#f6cf73");
  } else if (action === "coffee") {
    prect(24, torsoY - 4, 4, 5, "#fff5eb");
    prect(24, torsoY - 2, 4, 2, "#b86f4c");
  } else if (action === "candy") {
    prect(25, torsoY - 3, 1, 3, "#fff5eb");
    prect(24, torsoY - 6, 3, 3, "#e8748c");
  }

  ctx.fillStyle = OUTLINE;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
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
  canvas.height = 40 * 6;
  const ctx = canvas.getContext("2d");

  ["down", "up", "right", "left"].forEach((dir, row) => {
    for (let f = 0; f < 4; f++) {
      drawPixelFrame(ctx, f * 32, row * 40, cfg, dir, f === 0 ? "idle" : "walk", f);
    }
  });
  drawPixelFrame(ctx, 0, 4 * 40, cfg, "up", "sit", 0);
  drawPixelFrame(ctx, 32, 4 * 40, cfg, "up", "sit", 1);
  drawPixelFrame(ctx, 64, 4 * 40, cfg, "right", "sit", 0);
  drawPixelFrame(ctx, 96, 4 * 40, cfg, "left", "sit", 1);

  drawPixelFrame(ctx, 0, 5 * 40, cfg, "down", "smoke", 0);
  drawPixelFrame(ctx, 32, 5 * 40, cfg, "down", "smoke", 1);
  drawPixelFrame(ctx, 64, 5 * 40, cfg, "down", "coffee", 0);
  drawPixelFrame(ctx, 96, 5 * 40, cfg, "down", "candy", 0);

  const url = canvas.toDataURL("image/png");
  spriteCache.set(key, url);
  return url;
}

export function renderAvatarPreview(canvas, avatarCode, action = "idle", frame = 0) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  const cfg = normalizeAvatarCode(avatarCode, 0);
  drawPixelFrame(ctx, 0, 0, cfg, "down", action, frame);
}
