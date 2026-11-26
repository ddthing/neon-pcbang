// 100% Pure Pixel-Matrix Chibi Avatar Engine (48x48 Cells, 4x11 Sprite Sheet)
// Authored with explicit coordinate pixel matrices, 4-tone hue-shifted palettes, and zero math ellipses.

export const AVATAR_WARDROBE = {
  skins: [
    { id: 0, name: "치비 손님", species: "human", base: "#f9cfb4", hi: "#ffe8d6", shade: "#d99d82", muzzle: "#f9cfb4" },
    { id: 1, name: "삼색 고양이", species: "cat", base: "#fff2e6", hi: "#ffffff", shade: "#dec8c8", muzzle: "#ffffff" },
    { id: 2, name: "코지 곰돌이", species: "bear", base: "#e3b278", hi: "#f5cfa0", shade: "#bd8353", muzzle: "#fff0dc" },
    { id: 3, name: "말랑 토끼", species: "bunny", base: "#fff5f0", hi: "#ffffff", shade: "#e6c7ce", muzzle: "#ffffff" },
    { id: 4, name: "카페 여우", species: "fox", base: "#e67c45", hi: "#f79f68", shade: "#b3532c", muzzle: "#fff2e2" },
    { id: 5, name: "아기 펭귄", species: "penguin", base: "#4d82b3", hi: "#6ea2cf", shade: "#345b85", muzzle: "#fff7f0" },
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
    { id: 0, name: "코코아 브라운", base: "#784f44", hi: "#a67563", sh: "#52322d" },
    { id: 1, name: "플럼 에스프레소", base: "#473238", hi: "#6e5159", sh: "#2e1e23" },
    { id: 2, name: "캐러멜 밀크", base: "#c97a49", hi: "#eba26e", sh: "#8f4e2b" },
    { id: 3, name: "버터 블론드", base: "#f2c663", hi: "#ffebb3", sh: "#c4933b" },
    { id: 4, name: "베리 로즈", base: "#d45d78", hi: "#f08ca6", sh: "#9c3851" },
    { id: 5, name: "말차 세이지", base: "#549c79", hi: "#82c4a3", sh: "#376e53" },
  ],
  outfits: [
    { id: 0, name: "세이지 앞치마", body: "#549c79", hi: "#79bf9d", sub: "#376b51", accent: "#fff3e6", tie: "#f7dfc8" },
    { id: 1, name: "코지 가디건", body: "#d98f5f", hi: "#ebb98a", sub: "#a86140", accent: "#fff3e6", tie: "#f2c663" },
    { id: 2, name: "베리 스웨터", body: "#e36d86", hi: "#f59cb0", sub: "#ad475e", accent: "#fff3e6", tie: "#f7dfc8" },
    { id: 3, name: "세이지 후드티", body: "#6e9965", hi: "#94ba88", sub: "#486b42", accent: "#f7dfc8", tie: "#fff3e6" },
    { id: 4, name: "버터 멜빵바지", body: "#f0c360", hi: "#ffe39c", sub: "#bf8c34", accent: "#fff7ec", tie: "#a86140" },
    { id: 5, name: "데님 자켓", body: "#5b7ea8", hi: "#80a3cc", sub: "#3c5778", accent: "#fff3e6", tie: "#e36d86" },
    { id: 6, name: "크림 세일러", body: "#fff2e4", hi: "#ffffff", sub: "#dbc7ca", accent: "#549c79", tie: "#e36d86" },
    { id: 7, name: "모브 맨투맨", body: "#96717b", hi: "#ba95a0", sub: "#6b4c54", accent: "#f7dfc8", tie: "#ffe39c" },
  ],
  headsets: [
    { id: 0, name: "착용 안 함", color: null },
    { id: 1, name: "세이지 헤드셋", color: "#549c79", band: "#3f2e34" },
    { id: 2, name: "베리 고양이귀", color: "#e36d86", band: "#52383e", ears: true },
    { id: 3, name: "크림 헤드폰", color: "#f7dfc8", band: "#a86140" },
    { id: 4, name: "미니 베레모", color: "#ad5e45", band: "#753c2c", cap: true },
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
const OUTLINE = "#2d1f2a";
const CHEEK = "#f28da8";

// Hand-crafted 20x15 chibi cranium pixel matrices (s=shade, b=base, h=hi, m=muzzle, c=cheek, e=eye, w=shine)
const HEAD_FRONT = [
  "......hhhhhhhh......",
  "....hhbbbbbbbbhh....",
  "...hbbbbbbbbbbbbh...",
  "..hbbbbbbbbbbbbbbh..",
  "..bbbbbbbbbbbbbbbb..",
  ".sbbbbbbbbbbbbbbbbs.",
  ".sbbbebbbbbbbbebbbs.",
  ".sbbbebbbbbbbbebbbs.",
  ".sbbbebbbbbbbbebbbs.",
  ".sbbccbbmmmmbbccbbs.",
  ".ssbbbbbmmmmbbbbbss.",
  "..ssbbbbbbbbbbbbss..",
  "...sssbbbbbbbbsss...",
  "......ssssssss......",
];

const HEAD_SIDE = [
  "......hhhhhhh.......",
  "....hhbbbbbbbbh.....",
  "...hbbbbbbbbbbbh....",
  "..hbbbbbbbbbbbbbh...",
  "..bbbbbbbbbbbbbbb...",
  ".sbbbbbbbbbbbbbbb...",
  ".sbbbbbbbbbbebbbb...",
  ".sbbbbbbbbbbebbbb...",
  ".sbbbbbbbbbbebbbb...",
  ".sbbbbbbbbccbbmmmb..",
  ".ssbbbbbbbbbbmmmb...",
  "..ssbbbbbbbbbbbbss..",
  "...sssbbbbbbbbss....",
  "......ssssssss......",
];

// Hair matrices positioned relative to head top (origin cx-10, headY)
const HAIR_FRONT = [
  // 0: Natural short cut
  [
    ".....HHHHHHHHhh.....",
    "...HHBBBBBBBBBBHH...",
    "..HBBBBBBBBBBBBBBH..",
    "..BBBBBhHBBBBBBBBs..",
    "..BBbs..sBbh..sBBs..",
    ".sBB.....bs....BBs..",
    ".sB.............Bs..",
  ],
  // 1: Cozy bob with bangs
  [
    ".....HHHHHHHHhh.....",
    "...HHBBBBBBBBBBHH...",
    "..HBBBBBBBBBBBBBBH..",
    "..BBBHBBBBBBBBHBBB..",
    "..BBBBhhBBBBhhBBBB..",
    ".sBBBs........sBBBs.",
    ".sBBs..........sBBs.",
    ".sBBs..........sBBs.",
    ".sBBs..........sBBs.",
    ".sBBs..........sBBs.",
    "..ss............ss..",
  ],
  // 2: Long wave
  [
    ".....HHHHHHHHhh.....",
    "...HHBBBBBBBBBBHH...",
    "..HBBBBBBBBBBBBBBH..",
    "..BBBhhBBBBBBhhBBB..",
    "..BBBs........sBBB..",
    ".sBBs..........sBBs.",
    ".sBBs..........sBBs.",
    ".sBbs..........sbBs.",
    ".sBbs..........sbBs.",
    ".sBBs..........sBBs.",
    ".sBbs..........sbBs.",
    "..ss............ss..",
  ],
  // 3: Cozy ribbed beanie (accent + hair)
  [
    "......ssssssss......",
    "....ssAAAAAAAAss....",
    "...sAAAAAAAAAAAAss..",
    "..sAAAAHHHHHHAAAAss.",
    "..AAAAAAAAAAAAAAAA..",
    ".sKKKKKKKKKKKKKKKKs.",
    ".sBB............BBs.",
  ],
  // 4: Double buns
  [
    "..sHH..........HHs..",
    ".sHBBs.HHHHHH.sBBHs.",
    "..sBBHHBBBBBBHHBBs..",
    "..HBBBBBBBBBBBBBBH..",
    "..BBBhhBBBBBBhhBBB..",
    ".sBBs..........sBBs.",
    ".sBBs..........sBBs.",
  ],
  // 5: Star hairpin parting
  [
    ".....HHHHHHHHhh.....",
    "...HHBBBBBBBBBBHH...",
    "..HBBBBBBBBBBBBBBH..",
    "..BBBhYYBBBBBBhBBB..",
    "..BBb.YY.sBBb..BBs..",
    ".sBB.....bs....BBs..",
  ],
];

function drawChibiFrame(ctx, ox, oy, cfg, dir, action, frame) {
  const skin = AVATAR_WARDROBE.skins[cfg.skin];
  const hairCol = AVATAR_WARDROBE.hairColors[cfg.hairColor];
  const outfit = AVATAR_WARDROBE.outfits[cfg.outfit];
  const headset = AVATAR_WARDROBE.headsets[cfg.headset];

  const W = 48, H = 48;
  const grid = new Array(W * H).fill(null);
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
  const stamp = (x0, y0, rows, map) => {
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch !== "." && map[ch]) p(px(x0 + c), y0 + r, map[ch]);
      }
    }
  };

  const isSeated = action === "sit" || action === "sit-transition" || action === "eat";
  const walking = action === "walk";
  const stridePhase = walking ? frame % 6 : 0;
  const bob = walking ? [0, -1, -1, 0, -1, -1][stridePhase] : action === "sit" ? frame % 2 : 0;
  const sitDrop = action === "sit" || action === "eat" ? 5 : action === "sit-transition" ? 2 + frame : 0;

  const cx = 24;
  const headY = 10 + bob + sitDrop;
  const torsoY = 24 + bob + sitDrop;
  const legY = 34 + bob + (action === "sit-transition" ? frame : 0);

  const skinMap = {
    h: skin.hi,
    b: skin.base,
    s: skin.shade,
    m: skin.muzzle,
    c: CHEEK,
    e: dir === "up" ? skin.base : OUTLINE,
  };

  // Penguin dark crown backing
  const isPenguin = skin.species === "penguin";

  // Tail behind torso for animal species
  if (dir !== "down" || side) {
    if (skin.species === "cat") {
      const sway = (frame % 2) * (side ? 1 : -1);
      prect(cx - (side ? 8 : 1), torsoY + 6, 2, 4, skin.shade);
      prect(cx - (side ? 10 : 2) + sway, torsoY + 3, 2, 4, "#e37e49");
    } else if (skin.species === "fox") {
      prect(cx - (side ? 10 : 3), torsoY + 5, 5, 5, skin.base);
      prect(cx - (side ? 11 : 2), torsoY + 5, 3, 2, "#fff5eb");
    } else if (skin.species === "bunny") {
      prect(cx - (side ? 7 : 2), torsoY + 6, 3, 3, "#ffffff");
    } else if (skin.species === "bear") {
      prect(cx - (side ? 7 : 2), torsoY + 7, 3, 3, skin.shade);
    }
  }

  // Legs & Sneakers
  if (!isSeated || action === "sit-transition") {
    const legOffsets = walking ? [-2, -1, 1, 2, 1, -1] : [0, 0, 0, 0, 0, 0];
    const lShift = legOffsets[stridePhase];
    const rShift = -lShift;
    const pants = outfit.id === 4 ? outfit.sub : "#3f4f6b";
    const pantsHi = outfit.id === 4 ? outfit.body : "#5b7191";
    if (side) {
      prect(cx - 3 + lShift, legY, 4, 5, pants);
      prect(cx - 3 + lShift, legY, 2, 4, pantsHi);
      prect(cx - 3 + lShift, legY + 5, 5, 2, "#4a3330");
      prect(cx - 3 + lShift, legY + 7, 5, 1, "#f7e8d8");

      prect(cx - 1 + rShift, legY, 4, 5, pants);
      prect(cx - 1 + rShift, legY + 5, 5, 2, "#322325");
      prect(cx - 1 + rShift, legY + 7, 5, 1, "#e6d5c5");
    } else {
      prect(cx - 5, legY + Math.max(0, -lShift), 4, 5, pants);
      prect(cx - 5, legY + Math.max(0, -lShift), 2, 4, pantsHi);
      prect(cx - 5, legY + 5 + Math.max(0, -lShift), 4, 2, "#4a3330");
      prect(cx - 5, legY + 7 + Math.max(0, -lShift), 4, 1, "#f7e8d8");

      prect(cx + 1, legY + Math.max(0, -rShift), 4, 5, pants);
      prect(cx + 1, legY + Math.max(0, -rShift), 2, 4, pantsHi);
      prect(cx + 1, legY + 5 + Math.max(0, -rShift), 4, 2, "#4a3330");
      prect(cx + 1, legY + 7 + Math.max(0, -rShift), 4, 1, "#f7e8d8");
    }
  } else {
    // Tucked seated lap & knees
    prect(cx - 5, torsoY + 8, 10, 4, "#3f4f6b");
    prect(cx - 4, torsoY + 8, 8, 2, "#5b7191");
  }

  // Sculpted Chibi Torso + Outfit shading
  const torW = side ? 10 : 14;
  const torLeft = cx - Math.floor(torW / 2);
  prect(torLeft, torsoY, torW, 10, outfit.body);
  prect(torLeft, torsoY, Math.max(3, torW - 4), 2, outfit.hi);
  prect(torLeft, torsoY + 8, torW, 2, outfit.sub);
  prect(torLeft + torW - 2, torsoY + 2, 2, 6, outfit.sub);

  if (dir !== "up") {
    if (outfit.id === 0) {
      // Cafe Sage Apron with crisp straps & pocket
      prect(torLeft + 2, torsoY + 2, torW - 4, 7, outfit.accent);
      prect(cx - 2, torsoY + 5, 4, 3, outfit.tie);
    } else if (outfit.id === 1 || outfit.id === 5) {
      // Cardigan / Denim inner tee & V-neck placket
      prect(cx - 2, torsoY, 4, 9, outfit.accent);
      p(cx, torsoY + 3, outfit.tie);
      p(cx, torsoY + 6, outfit.tie);
    } else if (outfit.id === 6) {
      // Sailor collar + ribbon bow
      prect(torLeft + 1, torsoY, torW - 2, 3, outfit.accent);
      prect(cx - 1, torsoY + 2, 3, 2, outfit.tie);
    } else {
      // Hoodie strings or overalls badge
      prect(cx - 2, torsoY + 1, 1, 3, outfit.accent);
      prect(cx + 1, torsoY + 1, 1, 3, outfit.accent);
      prect(cx - 2, torsoY + 4, 4, 2, outfit.tie);
    }
  }

  // Arms & Action Hands
  const armSwing = walking ? [2, 1, -1, -2, -1, 1][stridePhase] : 0;
  if (action === "sit" || action === "eat") {
    const keyTap = frame % 2;
    if (side) {
      prect(cx + 4, torsoY + 2 + keyTap, 4, 3, outfit.body);
      prect(cx + 7, torsoY + 3 - keyTap, 2, 2, skin.base);
    } else {
      prect(cx - 7, torsoY - 2 + keyTap, 3, 4, outfit.body);
      prect(cx + 4, torsoY - 2 + (1 - keyTap), 3, 4, outfit.body);
      p(cx - 6, torsoY - 3 + keyTap, skin.base);
      p(cx + 5, torsoY - 3 + (1 - keyTap), skin.base);
    }
  } else if (dir === "down" && (action === "coffee" || action === "candy" || action === "smoke")) {
    prect(torLeft - 2, torsoY + 1, 2, 6, outfit.body);
    prect(torLeft - 2, torsoY + 7, 2, 2, skin.base);
    prect(torLeft + torW, torsoY + 1, 2, 5, outfit.body);
    prect(torLeft + torW, torsoY + 5, 3, 2, skin.base);
    if (action === "coffee") {
      prect(torLeft + torW + 2, torsoY + 3, 4, 4, "#fff5eb");
      prect(torLeft + torW + 3, torsoY + 3, 2, 1, "#8c573c");
      if (frame % 2 === 0) p(torLeft + torW + 3, torsoY + 1, "#e8f2f5");
    } else if (action === "candy") {
      prect(torLeft + torW + 3, torsoY + 2, 1, 4, "#fff9f2");
      prect(torLeft + torW + 2, torsoY, 3, 3, "#f27ca4");
      p(torLeft + torW + 3, torsoY + 1, "#ffe596");
    } else if (action === "smoke") {
      prect(torLeft + torW + 2, torsoY + 4, 3, 1, "#fff5eb");
      p(torLeft + torW + 5, torsoY + 4, "#f0764a");
      p(torLeft + torW + 5, torsoY + 2 - (frame % 2), "#cbd6df");
    }
  } else {
    if (side) {
      prect(cx - 1 + armSwing, torsoY + 1, 3, 6, outfit.hi);
      prect(cx - 1 + armSwing, torsoY + 7, 3, 2, skin.base);
    } else {
      prect(torLeft - 3, torsoY + 1 + Math.max(0, armSwing), 3, 6, outfit.body);
      prect(torLeft - 3, torsoY + 7 + Math.max(0, armSwing), 2, 2, skin.base);
      prect(torLeft + torW, torsoY + 1 + Math.max(0, -armSwing), 3, 6, outfit.sub);
      prect(torLeft + torW + 1, torsoY + 7 + Math.max(0, -armSwing), 2, 2, skin.shade);
    }
  }

  // Head Stamp (20x14 pixel matrix)
  stamp(cx - 10, headY, side ? HEAD_SIDE : HEAD_FRONT, skinMap);
  if (dir !== "up") {
    // Crisp eye catchlights + rosy cheek tint
    if (side) {
      p(px(cx + 2), headY + 6, "#ffffff");
    } else {
      p(px(cx - 6), headY + 6, "#ffffff");
      p(px(cx + 4), headY + 6, "#ffffff");
      if (frame % 2 === 1 && action === "eat") {
        prect(px(cx - 1), headY + 10, 2, 2, "#d95f76");
      }
    }
  }

  // Penguin blue cap forehead
  if (isPenguin && dir !== "up") {
    prect(cx - 5, headY + 4, 10, 4, "#fff7f0");
    prect(cx - 2, headY + 9, 4, 2, "#f0993e");
  }

  // Species Ears / Patches
  if (skin.species === "cat") {
    prect(cx - 8, headY - 3, 4, 4, skin.base);
    prect(cx - 7, headY - 2, 2, 2, "#f29cb8");
    prect(cx + 4, headY - 3, 4, 4, "#e37e49");
    prect(cx + 5, headY - 2, 2, 2, "#f29cb8");
    prect(cx + 5, headY + 2, 3, 3, "#e37e49");
  } else if (skin.species === "bear") {
    prect(cx - 9, headY - 2, 4, 4, skin.base);
    prect(cx - 8, headY - 1, 2, 2, "#ffd1a8");
    prect(cx + 5, headY - 2, 4, 4, skin.base);
    prect(cx + 6, headY - 1, 2, 2, "#ffd1a8");
  } else if (skin.species === "bunny") {
    prect(cx - 7, headY - 6, 3, 7, skin.base);
    prect(cx - 6, headY - 5, 1, 5, "#f29cb8");
    prect(cx + 4, headY - 6, 3, 7, skin.base);
    prect(cx + 5, headY - 5, 1, 5, "#f29cb8");
  } else if (skin.species === "fox") {
    prect(cx - 9, headY - 4, 4, 5, skin.base);
    prect(cx - 8, headY - 2, 2, 3, "#362529");
    prect(cx + 5, headY - 4, 4, 5, skin.base);
    prect(cx + 6, headY - 2, 2, 3, "#362529");
  }

  // Crisp Pixel-Matrix Hairstyle Overlay
  const hMap = {
    H: hairCol.hi,
    h: hairCol.hi,
    B: hairCol.base,
    b: hairCol.base,
    s: hairCol.sh,
    A: outfit.body,
    K: outfit.sub,
    Y: "#ffdf6b",
  };
  if (dir === "up") {
    prect(cx - 8, headY, 16, 12, hairCol.base);
    prect(cx - 7, headY + 1, 14, 2, hairCol.hi);
    prect(cx - 8, headY + 9, 16, 3, hairCol.sh);
    if (cfg.hair === 2) prect(cx - 8, headY + 11, 16, 5, hairCol.base);
    if (cfg.hair === 3) prect(cx - 8, headY - 1, 16, 5, outfit.body);
  } else if (side) {
    prect(cx - 8, headY, 13, 4, hairCol.base);
    prect(cx - 8, headY + 3, 7, 8, hairCol.sh);
    prect(cx - 6, headY + 1, 8, 2, hairCol.hi);
    if (cfg.hair === 2 || cfg.hair === 1) prect(cx - 9, headY + 7, 5, cfg.hair === 2 ? 9 : 5, hairCol.base);
    if (cfg.hair === 3) prect(cx - 8, headY - 1, 14, 5, outfit.body);
  } else {
    stamp(cx - 10, headY - 1, HAIR_FRONT[cfg.hair] || HAIR_FRONT[0], hMap);
  }

  // Headsets & Berets
  if (headset.color && dir !== "up") {
    if (headset.cap) {
      prect(cx - 7, headY - 3, 13, 4, headset.color);
      prect(cx - 4, headY - 4, 7, 2, "#ffe3b8");
      p(cx, headY - 5, headset.band);
    } else {
      prect(cx - 8, headY - 1, 16, 2, headset.band);
      prect(cx - 10, headY + 4, 3, 6, headset.color);
      prect(cx + 7, headY + 4, 3, 6, headset.color);
      if (headset.ears) {
        prect(cx - 8, headY - 4, 3, 3, headset.color);
        prect(cx + 5, headY - 4, 3, 3, headset.color);
      }
    }
  }

  // Glasses & Cozy Scarf
  if (cfg.accessory === 1 && dir !== "up") {
    prect(cx - 7, headY + 6, 4, 3, "#362529");
    p(cx - 6, headY + 7, "#cbeeff");
    prect(cx - 3, headY + 7, 6, 1, "#362529");
    prect(cx + 3, headY + 6, 4, 3, "#362529");
    p(cx + 4, headY + 7, "#cbeeff");
  } else if (cfg.accessory === 2 && dir !== "up") {
    prect(cx - 7, headY + 6, 5, 3, "#f09948");
    p(cx - 5, headY + 7, "#fff0a8");
    prect(cx + 2, headY + 6, 5, 3, "#f09948");
    p(cx + 4, headY + 7, "#fff0a8");
  } else if (cfg.accessory === 3) {
    prect(cx - 6, torsoY - 1, 12, 3, "#d45d78");
    prect(cx + 2, torsoY + 1, 3, 5, "#ad3e59");
  }

  // Ground Pixel Shadow
  ctx.fillStyle = "rgba(38, 28, 41, 0.24)";
  ctx.fillRect(ox + cx - 6, oy + 42, 12, 2);

  // Clean 1px Dark Outline Pass (only edges bordering empty cells)
  ctx.fillStyle = OUTLINE;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (grid[y * W + x]) continue;
      if (
        grid[y * W + x - 1] ||
        grid[y * W + x + 1] ||
        grid[(y - 1) * W + x] ||
        grid[(y + 1) * W + x]
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
  canvas.width = 48 * 7;
  canvas.height = 48 * 11;
  const ctx = canvas.getContext("2d");

  ["down", "up", "right", "left"].forEach((dir, row) => {
    drawChibiFrame(ctx, 0, row * 48, cfg, dir, "idle", 0);
    for (let frame = 0; frame < 6; frame++) {
      drawChibiFrame(ctx, (frame + 1) * 48, row * 48, cfg, dir, "walk", frame);
    }
  });
  ["up", "right", "left"].forEach((dir, index) => {
    const y = (index + 4) * 48;
    for (let frame = 0; frame < 4; frame++) {
      drawChibiFrame(ctx, frame * 48, y, cfg, dir, "sit", frame);
    }
    for (let frame = 0; frame < 3; frame++) {
      drawChibiFrame(ctx, (frame + 4) * 48, y, cfg, dir, "sit-transition", frame);
    }
  });
  ["coffee", "candy", "smoke"].forEach((action, index) => {
    for (let frame = 0; frame < 2; frame++) {
      drawChibiFrame(ctx, (2 * index + frame) * 48, 7 * 48, cfg, "down", action, frame);
    }
  });
  ["up", "right", "left"].forEach((dir, index) => {
    for (let frame = 0; frame < 4; frame++) {
      drawChibiFrame(ctx, frame * 48, (index + 8) * 48, cfg, dir, "eat", frame);
    }
  });

  const url = canvas.toDataURL("image/png");
  spriteCache.set(key, url);
  return url;
}

export function renderAvatarPreview(canvas, avatarCode, action = "idle", frame = 0, dir = "down") {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  const off = document.createElement("canvas");
  off.width = 48;
  off.height = 48;
  const cfg = normalizeAvatarCode(avatarCode, 0);
  drawChibiFrame(off.getContext("2d"), 0, 0, cfg, dir, action, frame);
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
