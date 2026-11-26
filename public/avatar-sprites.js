// 100% Pure Pixel-Matrix Cute Animal & Human Avatar Engine (48x48 Cells, 7x11 Sprite Sheet)
// Species: 사람, 고양이, 곰, 토끼, 쥐, 기린, 호랑이 with 4-tone palettes & cute pixel fashion

export const AVATAR_WARDROBE = {
  skins: [
    { id: 0, name: "사람", species: "human", base: "#ffd8be", hi: "#ffefe4", shade: "#e0a587", muzzle: "#ffd8be", iris: "#593b33" },
    { id: 1, name: "고양이", species: "cat", base: "#fff4e8", hi: "#ffffff", shade: "#dec8c2", muzzle: "#ffffff", iris: "#4f7c6b" },
    { id: 2, name: "곰", species: "bear", base: "#d99d6a", hi: "#f0be90", shade: "#a86f44", muzzle: "#fff1de", iris: "#3d2824" },
    { id: 3, name: "토끼", species: "bunny", base: "#fff6f6", hi: "#ffffff", shade: "#ebd0d8", muzzle: "#ffffff", iris: "#b5526c" },
    { id: 4, name: "쥐", species: "mouse", base: "#e2dde6", hi: "#f7f5fa", shade: "#b3abbf", muzzle: "#fff7fc", iris: "#47374f" },
    { id: 5, name: "기린", species: "giraffe", base: "#f5cc62", hi: "#ffe699", shade: "#c9963a", muzzle: "#fff3d6", iris: "#593b29" },
    { id: 6, name: "호랑이", species: "tiger", base: "#f2914b", hi: "#ffb87a", shade: "#bd5d28", muzzle: "#fff4e6", iris: "#8f4722" },
  ],
  hairs: [
    { id: 0, name: "내추럴 숏컷" },
    { id: 1, name: "포근 단발뱅" },
    { id: 2, name: "롱 웨이브" },
    { id: 3, name: "트윈 만두머리" },
    { id: 4, name: "삐죽 숏컷" },
    { id: 5, name: "코지 비니" },
    { id: 6, name: "리본 반묶음" },
  ],
  hairColors: [
    { id: 0, name: "코코아 브라운", base: "#784f44", hi: "#a67563", sh: "#52322d" },
    { id: 1, name: "에스프레소 블랙", base: "#43323b", hi: "#6b525e", sh: "#291d24" },
    { id: 2, name: "밀크 카라멜", base: "#c97a49", hi: "#eba26e", sh: "#8f4e2b" },
    { id: 3, name: "허니 블론드", base: "#f2c663", hi: "#ffebb3", sh: "#c4933b" },
    { id: 4, name: "딸기 로즈", base: "#db6580", hi: "#f79cb3", sh: "#a13b54" },
    { id: 5, name: "말차 민트", base: "#549c79", hi: "#82c4a3", sh: "#376e53" },
  ],
  outfits: [
    { id: 0, name: "세이지 앞치마", body: "#549c79", hi: "#79bf9d", sub: "#376b51", accent: "#fff3e6", tie: "#f7dfc8" },
    { id: 1, name: "오버핏 후드티", body: "#e36d86", hi: "#f59cb0", sub: "#ad475e", accent: "#fff3e6", tie: "#ffdf85" },
    { id: 2, name: "체크 멜빵바지", body: "#5f85ad", hi: "#84a9cf", sub: "#3f5d7d", accent: "#fff5eb", tie: "#f2c663" },
    { id: 3, name: "스트라이프 니트", body: "#f0c360", hi: "#ffe39c", sub: "#bf8c34", accent: "#fff7ec", tie: "#ad475e" },
    { id: 4, name: "바시티 과잠", body: "#628c68", hi: "#86b38b", sub: "#3e5e44", accent: "#fff3e6", tie: "#e36d86" },
    { id: 5, name: "크림 세일러", body: "#fff2e4", hi: "#ffffff", sub: "#d9c2c6", accent: "#5278a3", tie: "#e36d86" },
    { id: 6, name: "데님 자켓", body: "#597aa1", hi: "#7c9fc7", sub: "#3a5473", accent: "#f7e0c8", tie: "#d98f5f" },
    { id: 7, name: "곰돌이 파자마", body: "#f5b8c8", hi: "#ffd9e4", sub: "#cc8699", accent: "#fff5f7", tie: "#ffdf85" },
  ],
  headsets: [
    { id: 0, name: "착용 안 함", color: null },
    { id: 1, name: "게이밍 헤드셋", color: "#549c79", band: "#3b2c33" },
    { id: 2, name: "고양이귀 헤드폰", color: "#e86f8c", band: "#52383e", ears: true },
    { id: 3, name: "딸기 베레모", color: "#d95b6e", band: "#873342", beret: true },
    { id: 4, name: "코지 버킷햇", color: "#e6c9a5", band: "#9c7054", bucket: true },
    { id: 5, name: "미니 왕관", color: "#f5c542", band: "#bd8320", crown: true },
  ],
  accessories: [
    { id: 0, name: "없음" },
    { id: 1, name: "동글 안경" },
    { id: 2, name: "하트 선글라스" },
    { id: 3, name: "포근 목도리" },
    { id: 4, name: "나비넥타이" },
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
const CHEEK = "#f58ea8";

// Plump cute chibi rounded head matrices (20x15) with sparkling 2x3 eyes
const HEAD_FRONT = [
  "......hhhhhhhh......",
  "....hhbbbbbbbbhh....",
  "...hbbbbbbbbbbbbh...",
  "..hbbbbbbbbbbbbbbh..",
  "..bbbbbbbbbbbbbbbb..",
  ".sbbbebbbbbbbbebbbs.",
  ".sbbbebbbbbbbbebbbs.",
  ".sbbbwbbbbbbbbwbbbs.",
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
  ".sbbbbbbbbbbebbbb...",
  ".sbbbbbbbbbbebbbb...",
  ".sbbbbbbbbbbwbbbb...",
  ".sbbbbbbbbbbebbbb...",
  ".sbbbbbbbbccbbmmmb..",
  ".ssbbbbbbbbbbmmmb...",
  "..ssbbbbbbbbbbbbss..",
  "...sssbbbbbbbbss....",
  "......ssssssss......",
];

// Hair matrices positioned relative to head top (origin cx-10, headY)
const HAIR_FRONT = [
  // 0: Natural parted bangs
  [
    ".....HHHHHHHHhh.....",
    "...HHBBBBBBBBBBHH...",
    "..HBBBBBBBBBBBBBBH..",
    "..BBBBBhHBBBBBBBBs..",
    "..BBbs..sBbh..sBBs..",
    ".sBB.....bs....BBs..",
  ],
  // 1: Fluffy cozy bob
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
    "..ss............ss..",
  ],
  // 2: Long gentle waves
  [
    ".....HHHHHHHHhh.....",
    "...HHBBBBBBBBBBHH...",
    "..HBBBBBBBBBBBBBBH..",
    "..BBBhhBBBBBBhhBBB..",
    "..BBBs........sBBB..",
    ".sBBs..........sBBs.",
    ".sBbs..........sbBs.",
    ".sBBs..........sBBs.",
    ".sBbs..........sbBs.",
    ".sBBs..........sBBs.",
    ".sBbs..........sbBs.",
    "..ss............ss..",
  ],
  // 3: Cute Twin Buns (Odango)
  [
    "..sHH..........HHs..",
    ".sHBBs.HHHHHH.sBBHs.",
    "..sBBHHBBBBBBHHBBs..",
    "..HBBBBBBBBBBBBBBH..",
    "..BBBhhBBBBBBhhBBB..",
    ".sBBs..........sBBs.",
    ".sBBs..........sBBs.",
  ],
  // 4: Spiky playful boy cut
  [
    "...H..HHHHHHH..H....",
    "..HBHHBBBBBBBBHBH...",
    "..BBBBBBBBBBBBBBBs..",
    "..BBbs.sBbh.sBs.BBs.",
    ".sBB....b....b..BBs.",
  ],
  // 5: Cozy ribbed beanie
  [
    "......ssssssss......",
    "....ssAAAAAAAAss....",
    "...sAAAAAAAAAAAAss..",
    "..sAAAAHHHHHHAAAAss.",
    "..AAAAAAAAAAAAAAAA..",
    ".sTTTTTTTTTTTTTTTTs.",
    ".sBB............BBs.",
  ],
  // 6: Half-up with cute ribbon clip
  [
    ".....HHHHHHHHhh.....",
    "...HHBBBBBBBBBBHH...",
    "..HBBBBBBBBBBBBBBH..",
    "..BBBhRRBBBBBBhBBB..",
    "..BBbsRR.sBBb..BBs..",
    ".sBBs..........sBBs.",
    ".sBBs..........sBBs.",
    ".sBbs..........sbBs.",
  ],
];

function drawSpeciesBackFeatures(skin, cx, torsoY, side, dir, frame, prect, p) {
  const sway = frame % 2 ? 1 : -1;
  if (skin.species === "cat") {
    prect(cx - (side ? 8 : 2), torsoY + 6, 3, 4, skin.shade);
    prect(cx - (side ? 10 : 3) + (dir === "up" ? sway : 0), torsoY + 2, 2, 5, "#e68553");
  } else if (skin.species === "bear") {
    prect(cx - (side ? 7 : 2), torsoY + 6, 4, 4, skin.base);
    p(cx - (side ? 6 : 1), torsoY + 7, skin.hi);
  } else if (skin.species === "bunny") {
    prect(cx - (side ? 8 : 2), torsoY + 5, 4, 4, "#ffffff");
    p(cx - (side ? 7 : 1), torsoY + 6, "#f7e6ea");
  } else if (skin.species === "mouse") {
    p(cx - (side ? 8 : 1), torsoY + 7, "#e89cb5");
    p(cx - (side ? 10 : 2), torsoY + 6, "#e89cb5");
    p(cx - (side ? 11 : 1) + sway, torsoY + 4, "#e89cb5");
  } else if (skin.species === "giraffe") {
    prect(cx - (side ? 8 : 1), torsoY + 5, 2, 5, skin.base);
    prect(cx - (side ? 9 : 2), torsoY + 9, 3, 2, "#874e2c");
  } else if (skin.species === "tiger") {
    prect(cx - (side ? 9 : 2), torsoY + 6, 3, 5, skin.base);
    p(cx - (side ? 8 : 1), torsoY + 7, "#36221e");
    p(cx - (side ? 10 : 2) + sway, torsoY + 4, "#36221e");
  }
}

function drawSpeciesHeadDetails(skin, cx, headY, side, dir, prect, p) {
  if (skin.species === "cat") {
    // Pointed kitty ears + coral pink inner + calico forehead spot + whiskers
    prect(cx - 9, headY - 4, 4, 5, skin.base);
    prect(cx - 8, headY - 3, 2, 3, "#f296b4");
    prect(cx + 5, headY - 4, 4, 5, "#e68553");
    prect(cx + 6, headY - 3, 2, 3, "#f296b4");
    if (dir !== "up") {
      prect(cx + 4, headY + 1, 4, 3, "#e68553");
      p(cx, headY + 9, "#f07a94");
      p(cx - 8, headY + 9, "#c49c95");
      p(cx + 7, headY + 9, "#c49c95");
    }
  } else if (skin.species === "bear") {
    prect(cx - 10, headY - 3, 5, 5, skin.base);
    prect(cx - 9, headY - 2, 3, 3, "#ffd9b5");
    prect(cx + 5, headY - 3, 5, 5, skin.base);
    prect(cx + 6, headY - 2, 3, 3, "#ffd9b5");
    if (dir !== "up") {
      prect(cx - 3, headY + 8, 6, 4, "#fff1de");
      prect(cx - 1, headY + 8, 2, 2, "#3d2824");
    }
  } else if (skin.species === "bunny") {
    prect(cx - 8, headY - 8, 4, 9, skin.base);
    prect(cx - 7, headY - 7, 2, 6, "#f296b4");
    prect(cx + 4, headY - 8, 4, 9, skin.base);
    prect(cx + 5, headY - 7, 2, 6, "#f296b4");
    if (dir !== "up") p(cx, headY + 9, "#f27ca0");
  } else if (skin.species === "mouse") {
    // Huge adorable saucer mouse ears + tiny pink nose & whiskers
    prect(cx - 11, headY - 5, 6, 6, skin.base);
    prect(cx - 10, headY - 4, 4, 4, "#f7a8c2");
    prect(cx + 5, headY - 5, 6, 6, skin.base);
    prect(cx + 6, headY - 4, 4, 4, "#f7a8c2");
    if (dir !== "up") {
      prect(cx - 1, headY + 9, 2, 2, "#f07a9e");
      p(cx - 8, headY + 8, "#8c7f99");
      p(cx - 8, headY + 10, "#8c7f99");
      p(cx + 7, headY + 8, "#8c7f99");
      p(cx + 7, headY + 10, "#8c7f99");
    }
  } else if (skin.species === "giraffe") {
    // 2 cute brown ossicone horns + small side ears + cocoa spots
    prect(cx - 5, headY - 5, 2, 5, "#9c5e35");
    prect(cx - 6, headY - 6, 4, 2, "#63381f");
    prect(cx + 3, headY - 5, 2, 5, "#9c5e35");
    prect(cx + 2, headY - 6, 4, 2, "#63381f");
    prect(cx - 11, headY + 1, 3, 3, skin.base);
    prect(cx + 8, headY + 1, 3, 3, skin.base);
    if (dir !== "up") {
      prect(cx - 6, headY + 1, 3, 3, "#a86135");
      prect(cx + 4, headY + 3, 2, 2, "#a86135");
      prect(cx - 3, headY + 9, 6, 3, "#fff3d6");
      p(cx - 1, headY + 9, "#784528");
      p(cx + 1, headY + 9, "#784528");
    } else {
      prect(cx - 4, headY + 3, 3, 3, "#a86135");
      prect(cx + 2, headY + 6, 3, 3, "#a86135");
    }
  } else if (skin.species === "tiger") {
    // Rounded tiger ears + iconic "王" forehead stripe + whisker stripes + cream muzzle
    prect(cx - 9, headY - 3, 4, 4, skin.base);
    prect(cx - 8, headY - 2, 2, 2, "#fff2db");
    prect(cx + 5, headY - 3, 4, 4, skin.base);
    prect(cx + 6, headY - 2, 2, 2, "#fff2db");
    if (dir !== "up") {
      // Forehead 王 stripes
      prect(cx - 2, headY + 1, 5, 1, "#3d221c");
      prect(cx - 1, headY + 2, 3, 1, "#3d221c");
      prect(cx - 3, headY + 3, 6, 1, "#3d221c");
      // Side cheek stripes
      prect(cx - 8, headY + 5, 2, 1, "#3d221c");
      prect(cx - 8, headY + 7, 2, 1, "#3d221c");
      prect(cx + 6, headY + 5, 2, 1, "#3d221c");
      prect(cx + 6, headY + 7, 2, 1, "#3d221c");
      prect(cx - 3, headY + 8, 6, 4, "#fff4e6");
      prect(cx - 1, headY + 8, 2, 2, "#2d1f2a");
    }
  }
}

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
  const headY = 11 + bob + sitDrop;
  const torsoY = 25 + bob + sitDrop;
  const legY = 35 + bob + (action === "sit-transition" ? frame : 0);

  const skinMap = {
    h: skin.hi,
    b: skin.base,
    s: skin.shade,
    m: skin.muzzle,
    c: CHEEK,
    e: dir === "up" ? skin.base : OUTLINE,
    w: dir === "up" ? skin.base : skin.iris,
  };

  // Tail behind body for animal characters
  if (dir !== "down" || side) {
    drawSpeciesBackFeatures(skin, cx, torsoY, side, dir, frame, prect, p);
  }

  // Legs & Cozy Sneakers
  if (!isSeated || action === "sit-transition") {
    const legOffsets = walking ? [-2, -1, 1, 2, 1, -1] : [0, 0, 0, 0, 0, 0];
    const lShift = legOffsets[stridePhase];
    const rShift = -lShift;
    const pants = outfit.id === 7 ? outfit.sub : outfit.id === 2 ? outfit.body : "#3f506b";
    const pantsHi = outfit.id === 7 ? outfit.body : outfit.id === 2 ? outfit.hi : "#5c7496";
    if (side) {
      prect(cx - 3 + lShift, legY, 4, 4, pants);
      prect(cx - 3 + lShift, legY, 2, 3, pantsHi);
      prect(cx - 3 + lShift, legY + 4, 5, 2, "#4a3330");
      prect(cx - 3 + lShift, legY + 6, 5, 1, "#f7e8d8");

      prect(cx - 1 + rShift, legY, 4, 4, pants);
      prect(cx - 1 + rShift, legY + 4, 5, 2, "#322325");
      prect(cx - 1 + rShift, legY + 6, 5, 1, "#e6d5c5");
    } else {
      prect(cx - 5, legY + Math.max(0, -lShift), 4, 4, pants);
      prect(cx - 5, legY + Math.max(0, -lShift), 2, 3, pantsHi);
      prect(cx - 5, legY + 4 + Math.max(0, -lShift), 4, 2, "#4a3330");
      prect(cx - 5, legY + 6 + Math.max(0, -lShift), 4, 1, "#f7e8d8");

      prect(cx + 1, legY + Math.max(0, -rShift), 4, 4, pants);
      prect(cx + 1, legY + Math.max(0, -rShift), 2, 3, pantsHi);
      prect(cx + 1, legY + 4 + Math.max(0, -rShift), 4, 2, "#4a3330");
      prect(cx + 1, legY + 6 + Math.max(0, -rShift), 4, 1, "#f7e8d8");
    }
  } else {
    prect(cx - 5, torsoY + 8, 10, 4, "#3f506b");
    prect(cx - 4, torsoY + 8, 8, 2, "#5c7496");
  }

  // Fashion Outfits
  const torW = side ? 10 : 14;
  const torLeft = cx - Math.floor(torW / 2);
  prect(torLeft, torsoY, torW, 10, outfit.body);
  prect(torLeft, torsoY, Math.max(3, torW - 4), 2, outfit.hi);
  prect(torLeft, torsoY + 8, torW, 2, outfit.sub);
  prect(torLeft + torW - 2, torsoY + 2, 2, 6, outfit.sub);

  if (dir !== "up") {
    if (outfit.id === 0) {
      // Cafe Apron
      prect(torLeft + 2, torsoY + 2, torW - 4, 7, outfit.accent);
      prect(cx - 2, torsoY + 5, 4, 3, outfit.tie);
    } else if (outfit.id === 1) {
      // Oversized Hoodie + Kangaroo Pocket + Drawstrings
      prect(cx - 4, torsoY + 5, 8, 3, outfit.sub);
      prect(cx - 2, torsoY + 1, 1, 3, outfit.accent);
      prect(cx + 1, torsoY + 1, 1, 3, outfit.accent);
      p(cx, torsoY + 6, outfit.tie);
    } else if (outfit.id === 2) {
      // Plaid Overall straps + undershirt
      prect(torLeft + 1, torsoY, torW - 2, 3, outfit.accent);
      prect(cx - 3, torsoY, 2, 5, outfit.body);
      prect(cx + 1, torsoY, 2, 5, outfit.body);
      p(cx - 3, torsoY + 3, outfit.tie);
      p(cx + 1, torsoY + 3, outfit.tie);
    } else if (outfit.id === 3) {
      // Pastel Striped Knit Sweater
      prect(torLeft + 1, torsoY + 3, torW - 2, 2, outfit.accent);
      prect(torLeft + 1, torsoY + 6, torW - 2, 2, outfit.tie);
    } else if (outfit.id === 4) {
      // Varsity Jacket with contrasting cream collar/center snaps
      prect(torLeft, torsoY, 3, 8, outfit.accent);
      prect(torLeft + torW - 3, torsoY, 3, 8, outfit.accent);
      p(cx, torsoY + 2, outfit.accent);
      p(cx, torsoY + 5, outfit.accent);
      prect(cx + 2, torsoY + 2, 2, 2, outfit.tie);
    } else if (outfit.id === 5) {
      // Cream Sailor Collar + Cute Ribbon
      prect(torLeft + 1, torsoY, torW - 2, 3, outfit.accent);
      prect(cx - 1, torsoY + 2, 3, 3, outfit.tie);
    } else if (outfit.id === 6) {
      // Denim Jacket + pocket flaps + copper buttons
      prect(cx - 2, torsoY + 1, 4, 8, outfit.accent);
      p(cx - 4, torsoY + 4, outfit.tie);
      p(cx + 3, torsoY + 4, outfit.tie);
    } else if (outfit.id === 7) {
      // Teddy Pajama with lapel piping & golden buttons
      prect(torLeft + 1, torsoY, torW - 2, 2, outfit.accent);
      prect(cx - 1, torsoY + 2, 2, 7, outfit.accent);
      p(cx, torsoY + 3, outfit.tie);
      p(cx, torsoY + 6, outfit.tie);
    }
  }

  // Arms & Action Poses
  const armSwing = walking ? [2, 1, -1, -2, -1, 1][stridePhase] : 0;
  const sleeveColor = outfit.id === 4 ? outfit.accent : outfit.body;
  if (action === "sit" || action === "eat") {
    const keyTap = frame % 2;
    if (side) {
      prect(cx + 4, torsoY + 2 + keyTap, 4, 3, sleeveColor);
      prect(cx + 7, torsoY + 3 - keyTap, 2, 2, skin.base);
    } else {
      prect(cx - 7, torsoY - 2 + keyTap, 3, 4, sleeveColor);
      prect(cx + 4, torsoY - 2 + (1 - keyTap), 3, 4, sleeveColor);
      p(cx - 6, torsoY - 3 + keyTap, skin.base);
      p(cx + 5, torsoY - 3 + (1 - keyTap), skin.base);
    }
  } else if (dir === "down" && (action === "coffee" || action === "candy" || action === "smoke")) {
    prect(torLeft - 2, torsoY + 1, 2, 6, sleeveColor);
    prect(torLeft - 2, torsoY + 7, 2, 2, skin.base);
    prect(torLeft + torW, torsoY + 1, 2, 5, sleeveColor);
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
      prect(cx - 1 + armSwing, torsoY + 1, 3, 6, outfit.id === 4 ? outfit.accent : outfit.hi);
      prect(cx - 1 + armSwing, torsoY + 7, 3, 2, skin.base);
    } else {
      prect(torLeft - 3, torsoY + 1 + Math.max(0, armSwing), 3, 6, sleeveColor);
      prect(torLeft - 3, torsoY + 7 + Math.max(0, armSwing), 2, 2, skin.base);
      prect(torLeft + torW, torsoY + 1 + Math.max(0, -armSwing), 3, 6, outfit.id === 4 ? outfit.accent : outfit.sub);
      prect(torLeft + torW + 1, torsoY + 7 + Math.max(0, -armSwing), 2, 2, skin.shade);
    }
  }

  // Head Stamp + Cute Shiny Eyes
  stamp(cx - 10, headY, side ? HEAD_SIDE : HEAD_FRONT, skinMap);
  if (dir !== "up") {
    if (side) {
      p(px(cx + 2), headY + 5, "#ffffff");
    } else {
      p(px(cx - 6), headY + 5, "#ffffff");
      p(px(cx + 4), headY + 5, "#ffffff");
      if (frame % 2 === 1 && action === "eat") {
        prect(px(cx - 1), headY + 10, 2, 2, "#e0607a");
      }
    }
  }

  // Hair Layer (human gets full hair; animals show subtle cute tuft/bangs on human/bunny/cat or beanie if chosen so animal ears shine!)
  const hMap = {
    H: hairCol.hi,
    h: hairCol.hi,
    B: hairCol.base,
    b: hairCol.base,
    s: hairCol.sh,
    A: outfit.body,
    T: outfit.accent,
    R: "#eb5e7c",
  };
  const showFullHair = skin.species === "human" || cfg.hair === 5 || cfg.hair === 6;
  if (showFullHair) {
    if (dir === "up") {
      prect(cx - 8, headY, 16, 12, hairCol.base);
      prect(cx - 7, headY + 1, 14, 2, hairCol.hi);
      prect(cx - 8, headY + 9, 16, 3, hairCol.sh);
      if (cfg.hair === 2 || cfg.hair === 6) prect(cx - 8, headY + 11, 16, 4, hairCol.base);
      if (cfg.hair === 5) prect(cx - 8, headY - 1, 16, 5, outfit.body);
      if (cfg.hair === 6) prect(cx - 2, headY + 4, 4, 2, "#eb5e7c");
    } else if (side) {
      prect(cx - 8, headY, 13, 4, hairCol.base);
      prect(cx - 8, headY + 3, 7, 8, hairCol.sh);
      prect(cx - 6, headY + 1, 8, 2, hairCol.hi);
      if (cfg.hair === 2 || cfg.hair === 1 || cfg.hair === 6) prect(cx - 9, headY + 7, 5, cfg.hair === 2 ? 9 : 5, hairCol.base);
      if (cfg.hair === 5) prect(cx - 8, headY - 1, 14, 5, outfit.body);
    } else {
      stamp(cx - 10, headY - 1, HAIR_FRONT[cfg.hair] || HAIR_FRONT[0], hMap);
    }
  } else if (dir !== "up" && !side) {
    // Subtle adorable hair tuft on top of animal forehead matching hairColor
    prect(cx - 3, headY, 6, 2, hairCol.base);
    prect(cx - 2, headY, 3, 1, hairCol.hi);
  }

  // Species Ears, Stripes & Features layered cleanly above bangs!
  drawSpeciesHeadDetails(skin, cx, headY, side, dir, prect, p);

  // Stylish Hats & Headsets
  if (headset.color && (dir !== "up" || headset.bucket || headset.crown || headset.beret)) {
    if (headset.beret) {
      prect(cx - 7, headY - 3, 13, 4, headset.color);
      prect(cx - 5, headY - 4, 8, 2, "#f794a4");
      p(cx, headY - 5, "#64a668"); // cute strawberry leaf top
    } else if (headset.bucket) {
      prect(cx - 8, headY - 3, 16, 4, headset.color);
      prect(cx - 10, headY, 20, 2, headset.band);
    } else if (headset.crown) {
      prect(cx - 4, headY - 3, 8, 3, headset.color);
      p(cx - 4, headY - 4, headset.color);
      p(cx, headY - 5, headset.color);
      p(cx + 3, headY - 4, headset.color);
      p(cx, headY - 2, "#e84f6e");
    } else if (dir !== "up") {
      prect(cx - 8, headY - 1, 16, 2, headset.band);
      prect(cx - 10, headY + 4, 3, 6, headset.color);
      prect(cx + 7, headY + 4, 3, 6, headset.color);
      if (headset.ears) {
        prect(cx - 8, headY - 4, 3, 3, headset.color);
        prect(cx + 5, headY - 4, 3, 3, headset.color);
      }
    }
  }

  // Cute Accessories
  if (cfg.accessory === 1 && dir !== "up") {
    prect(cx - 7, headY + 5, 5, 4, "#362529");
    prect(cx - 6, headY + 6, 3, 2, "#d8f2ff");
    prect(cx - 2, headY + 6, 4, 1, "#362529");
    prect(cx + 2, headY + 5, 5, 4, "#362529");
    prect(cx + 3, headY + 6, 3, 2, "#d8f2ff");
  } else if (cfg.accessory === 2 && dir !== "up") {
    // Heart Sunglasses
    prect(cx - 8, headY + 5, 6, 4, "#e35678");
    prect(cx - 7, headY + 6, 4, 2, "#ff8ca8");
    prect(cx - 2, headY + 6, 4, 1, "#e35678");
    prect(cx + 2, headY + 5, 6, 4, "#e35678");
    prect(cx + 3, headY + 6, 4, 2, "#ff8ca8");
  } else if (cfg.accessory === 3) {
    prect(cx - 6, torsoY - 1, 12, 3, "#d45d78");
    prect(cx + 2, torsoY + 1, 3, 5, "#ad3e59");
    p(cx + 3, torsoY + 5, "#fff2f4");
  } else if (cfg.accessory === 4 && dir !== "up") {
    prect(cx - 3, torsoY, 2, 3, "#d94f6d");
    prect(cx + 1, torsoY, 2, 3, "#d94f6d");
    p(cx, torsoY + 1, "#ffdf85");
  }

  // Ground Pixel Shadow
  ctx.fillStyle = "rgba(38, 28, 41, 0.24)";
  ctx.fillRect(ox + cx - 6, oy + 42, 12, 2);

  // Clean 1px Dark Outline Pass
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
