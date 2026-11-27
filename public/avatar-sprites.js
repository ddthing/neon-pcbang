// 16×32 pastel chibi animation sheet. Wardrobe codes retain their stored meaning.
// Species: 사람, 고양이, 곰, 토끼, 쥐, 기린, 호랑이 with 4-tone palettes & cute pixel fashion

export const AVATAR_WARDROBE = {
  skins: [
    { id: 0, name: "사람", species: "human", base: "#ffd8be", hi: "#ffefe4", shade: "#e0a587", muzzle: "#ffd8be", iris: "#593b33" },
    { id: 1, name: "고양이", species: "cat", base: "#fff4e8", hi: "#f7efe5", shade: "#dec8c2", muzzle: "#f7efe5", iris: "#4f7c6b" },
    { id: 2, name: "곰", species: "bear", base: "#d99d6a", hi: "#f0be90", shade: "#a86f44", muzzle: "#fff1de", iris: "#3d2824" },
    { id: 3, name: "토끼", species: "bunny", base: "#fff6f6", hi: "#f7efe5", shade: "#ebd0d8", muzzle: "#f7efe5", iris: "#b5526c" },
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
    { id: 5, name: "크림 세일러", body: "#fff2e4", hi: "#f7efe5", sub: "#d9c2c6", accent: "#5278a3", tie: "#e36d86" },
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

const WIDTH = 16;
const HEIGHT = 32;
const OUTLINE = "#5c4742";
const CREAM = "#f7efe5";
const PINK = "#f4c2d7";
const LAVENDER = "#c8b6e2";
const spriteCache = new Map();
const serviceActions = ["idle", "cook", "plate", "lift", "carry", "serve", "walk"];
export const BUILTIN_AVATAR_CODES = new Set(Array.from({ length: 16 }, (_, seed) =>
  encodeAvatarCode(normalizeAvatarCode(null, seed))));
const head = [
  "....oooooooo....",
  "...o########o...",
  "..o##########o..",
  ".o############o.",
  "o##############o",
  "o##############o",
  "o##############o",
  "o##############o",
  "o##############o",
  ".o############o.",
  ".o############o.",
  "..o##########o..",
  "...oooooooooo...",
];

function pastel(hex, cream = .29) {
  const value = parseInt(hex.slice(1), 16);
  const rgb = [value >> 16, (value >> 8) & 255, value & 255];
  return "rgb(" + rgb.map((channel, index) => Math.round(channel * (1 - cream) + [247, 239, 229][index] * cream)).join(",") + ")";
}

function drawChibiFrame(ctx, ox, oy, cfg, dir, action, frame) {
  const skin = AVATAR_WARDROBE.skins[cfg.skin];
  const hair = AVATAR_WARDROBE.hairColors[cfg.hairColor];
  const outfit = AVATAR_WARDROBE.outfits[cfg.outfit];
  const hat = AVATAR_WARDROBE.headsets[cfg.headset];
  const side = dir === "left" || dir === "right";
  const back = dir === "up";
  const sitting = action === "sit" || action === "eat";
  const stride = action === "walk" || action === "carry" ? [0, 1, 2, 0, -1, -2][frame % 6] : 0;
  const drop = sitting ? 4 : action === "sit-transition" ? frame + 1 : 0;
  const top = 3 + drop - Number(Math.abs(stride) === 2);
  const face = pastel(skin.base, .16);
  const hairColor = pastel(hair.base);
  const clothes = pastel(outfit.body, .44);
  const accent = pastel(outfit.accent, .36);
  const point = (x, y, color) => {
    if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
    ctx.fillStyle = color;
    ctx.fillRect(ox + (dir === "left" ? WIDTH - 1 - x : x), oy + y, 1, 1);
  };
  const block = (x, y, w, h, color) => {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) point(x + dx, y + dy, color);
    }
  };

  const hips = 24 + Math.floor(drop / 2);
  for (const [x, step] of [[side ? 5 : 4, stride], [side ? 8 : 9, -stride]]) {
    const shoeY = sitting ? 28 : 29 - Math.max(0, step);
    block(x, hips, 3, shoeY - hips, OUTLINE);
    block(x + 1, hips, 1, shoeY - hips, LAVENDER);
    block(x, shoeY, 4, 2, OUTLINE);
    block(x + 1, shoeY, 2, 1, CREAM);
  }
  block(side ? 4 : 3, top + 12, side ? 8 : 10, 11 - Math.floor(drop / 2), OUTLINE);
  block(side ? 5 : 4, top + 13, side ? 6 : 8, 9 - Math.floor(drop / 2), clothes);
  if (cfg.outfit % 2 === 0) block(6, top + 15, 4, 4, accent);
  else {
    block(6, top + 14, 4, 1, accent);
    block(6, top + 18, 4, 1, accent);
  }

  const handLift = sitting ? frame % 2
    : ["coffee", "candy", "smoke", "carry", "lift"].includes(action) ? 3
    : ["cook", "plate", "serve"].includes(action) ? 2 + frame % 2 : 0;
  for (const x of side ? [9] : [2, 11]) {
    const arm = top + 15 - handLift;
    block(x, arm, 3, 6, OUTLINE);
    block(x + 1, arm + 1, 1, 3, clothes);
    point(x + 1, arm + 4, face);
  }

  head.forEach((row, y) => [...row].forEach((pixel, x) => {
    if (pixel === ".") return;
    const fringe = back || y < 3 || (cfg.hair % 3 === 1 && y === 3 && x < 9)
      || (cfg.hair % 3 === 2 && y < 7 && (x < 4 || (!side && x > 11)));
    point(x, top + y, pixel === "o" ? OUTLINE : skin.species === "human" && fringe ? hairColor : face);
  }));

  if (cfg.skin !== 0) {
    const earHeight = skin.species === "bunny" ? 4 : 3;
    for (const x of [2, 11]) {
      block(x, top - earHeight + 1, 3, earHeight, OUTLINE);
      block(x + 1, top - earHeight + 2, 1, earHeight - 1, PINK);
    }
    if (skin.species === "giraffe") {
      point(6, top - 2, OUTLINE);
      point(9, top - 2, OUTLINE);
    }
    if (skin.species === "tiger" || skin.species === "giraffe") {
      point(6, top + 3, pastel(skin.shade));
      point(9, top + 4, pastel(skin.shade));
    }
    if (skin.species === "mouse" || skin.species === "cat") point(1, top + 18, pastel(skin.shade));
  } else if (cfg.hair >= 3) {
    const x = cfg.hair % 2 ? 2 : 11;
    block(x, top - 1, 3, 3, OUTLINE);
    point(x + 1, top, hairColor);
  }
  if (!back) {
    const eyes = side ? [10] : [5, 10];
    for (const x of eyes) {
      point(x, top + 7, OUTLINE);
      point(x + (x < 8 ? -1 : 1), top + 9, PINK);
      if (cfg.accessory === 1 || cfg.accessory === 2) {
        block(x - 1, top + 6, 3, 1, OUTLINE);
        point(x - 1, top + 7, OUTLINE);
        point(x + 1, top + 7, OUTLINE);
      }
    }
    point(side ? 13 : 8, top + 9, OUTLINE);
  }
  if (cfg.accessory >= 3) block(5, top + 12, 6, 2, PINK);
  if (hat.color) {
    const color = pastel(hat.color, .43);
    if (cfg.headset < 3) {
      block(3, top, 10, 1, color);
      block(1, top + 4, 2, 4, color);
      if (!side) block(13, top + 4, 2, 4, color);
      if (hat.ears) {
        block(3, top - 2, 3, 2, color);
        block(10, top - 2, 3, 2, color);
      }
    } else {
      block(4, top - 1, 8, 2, OUTLINE);
      block(5, top - 1, 6, 2, color);
      block(3, top + 1, 10, 1, color);
    }
  }
}

export function drawAvatarSheet(canvas, avatarCode) {
  const cfg = normalizeAvatarCode(avatarCode);
  canvas.width = WIDTH * 7;
  canvas.height = HEIGHT * 13;
  const ctx = canvas.getContext("2d");
  const draw = (col, row, dir, action, frame) => drawChibiFrame(ctx, col * WIDTH, row * HEIGHT, cfg, dir, action, frame);

  ["down", "up", "right", "left"].forEach((dir, row) => {
    draw(0, row, dir, "idle", 0);
    for (let frame = 0; frame < 6; frame++) draw(frame + 1, row, dir, "walk", frame);
  });
  ["up", "right", "left"].forEach((dir, index) => {
    for (let frame = 0; frame < 4; frame++) {
      draw(frame, index + 4, dir, "sit", frame);
      draw(frame, index + 8, dir, "eat", frame);
    }
    for (let frame = 0; frame < 3; frame++) draw(frame + 4, index + 4, dir, "sit-transition", frame);
  });
  ["coffee", "candy", "smoke"].forEach((action, index) => {
    for (let frame = 0; frame < 2; frame++) draw(2 * index + frame, 7, "down", action, frame);
  });
  for (let frame = 0; frame < 4; frame++) {
    draw(frame, 11, "down", "sit", frame);
    draw(frame, 12, "down", "eat", frame);
  }
  for (let frame = 0; frame < 3; frame++) draw(frame + 4, 11, "down", "sit-transition", frame);
}

export function getAvatarSheetUrl(avatarCode, fallbackColor = 0) {
  const key = encodeAvatarCode(normalizeAvatarCode(avatarCode, fallbackColor));
  if (BUILTIN_AVATAR_CODES.has(key)) return "./assets/chars/" + key + ".png";
  if (!spriteCache.has(key)) {
    const canvas = document.createElement("canvas");
    drawAvatarSheet(canvas, key);
    spriteCache.set(key, canvas.toDataURL("image/png"));
  }
  return spriteCache.get(key);
}

export function drawClerkSheet(canvas) {
  canvas.width = WIDTH * 4;
  canvas.height = HEIGHT * serviceActions.length;
  const ctx = canvas.getContext("2d");
  const clerk = normalizeAvatarCode("100040");
  serviceActions.forEach((pose, row) => {
    for (let frame = 0; frame < 4; frame++) {
      drawChibiFrame(ctx, frame * WIDTH, row * HEIGHT, clerk, pose === "idle" ? "down" : "left", pose, frame);
    }
  });
}

export function createClerkSprite(action = "idle") {
  const sprite = document.createElement("span");
  sprite.className = "cafe-clerk-sprite";
  sprite.setAttribute("aria-hidden", "true");
  sprite.style.setProperty("--clerk-art", 'url("./assets/chars/clerk.png")');
  sprite.style.setProperty("--clerk-pose", (Math.max(0, serviceActions.indexOf(action)) / (serviceActions.length - 1) * 100) + "%");
  return sprite;
}

function renderAvatar(canvas, avatarCode, action, frame, dir, height) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  const source = document.createElement("canvas");
  source.width = WIDTH;
  source.height = HEIGHT;
  drawChibiFrame(source.getContext("2d"), 0, 0, normalizeAvatarCode(avatarCode), dir, action, frame);
  const scale = Math.max(1, Math.floor(Math.min(canvas.width / WIDTH, canvas.height / height)));
  const x = Math.floor((canvas.width - WIDTH * scale) / 2);
  const y = Math.floor((canvas.height - height * scale) / 2);
  ctx.drawImage(source, 0, 0, WIDTH, height, x, y, WIDTH * scale, height * scale);
}

export function renderAvatarPreview(canvas, avatarCode, action = "idle", frame = 0, dir = "down") {
  renderAvatar(canvas, avatarCode, action, frame, dir, HEIGHT);
}

export function renderAvatarPortrait(canvas, avatarCode) {
  renderAvatar(canvas, avatarCode, "idle", 0, "down", 16);
}
