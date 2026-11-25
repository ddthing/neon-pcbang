// Zero-dependency Pixel Art PNG Sprite Sheet & Prop Compiler for Gilmotungi PC Bang
// Unified Cozy Reference Palette (#4c383d warm plum-espresso outlines, #fbe3d3 cream, #b86f4c caramel, #9e7b82 mauve, #569e7c sage, #f6cf73 butter)
import { deflateSync } from "node:zlib";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../public/sprites");
mkdirSync(outDir, { recursive: true });
rmSync(path.join(outDir, "relax-props.png"), { force: true });

const OUTLINE = "#4c383d";

// CRC32 table for valid PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}
function encodePNG(width, height, rgba) {
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function hexToRgba(hex) {
  if (!hex || hex === ".") return [0, 0, 0, 0];
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const a = clean.length === 8 ? parseInt(clean.slice(6, 8), 16) : 255;
  return [r, g, b, a];
}

class PixelSurface {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 4);
  }
  pset(x, y, hex) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const [r, g, b, a] = typeof hex === "string" ? hexToRgba(hex) : hex;
    if (a === 0) return;
    const idx = (y * this.w + x) * 4;
    if (a === 255 || this.data[idx + 3] === 0) {
      this.data[idx] = r;
      this.data[idx + 1] = g;
      this.data[idx + 2] = b;
      this.data[idx + 3] = a;
    } else {
      const sa = a / 255;
      const da = this.data[idx + 3] / 255;
      const outA = sa + da * (1 - sa);
      this.data[idx] = Math.round((r * sa + this.data[idx] * da * (1 - sa)) / outA);
      this.data[idx + 1] = Math.round((g * sa + this.data[idx + 1] * da * (1 - sa)) / outA);
      this.data[idx + 2] = Math.round((b * sa + this.data[idx + 2] * da * (1 - sa)) / outA);
      this.data[idx + 3] = Math.round(outA * 255);
    }
  }
  rect(x, y, w, h, hex) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) this.pset(x + dx, y + dy, hex);
    }
  }
  box(x, y, w, h, fillHex, borderHex = OUTLINE) {
    if (fillHex) this.rect(x + 1, y + 1, w - 2, h - 2, fillHex);
    this.rect(x + 1, y, w - 2, 1, borderHex);
    this.rect(x + 1, y + h - 1, w - 2, 1, borderHex);
    this.rect(x, y + 1, 1, h - 2, borderHex);
    this.rect(x + w - 1, y + 1, 1, h - 2, borderHex);
  }
  circle(cx, cy, r, hex) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r + r * 0.4) this.pset(cx + dx, cy + dy, hex);
      }
    }
  }
  ellipse(cx, cy, rx, ry, hex) {
    for (let dy = -ry; dy <= ry; dy++) {
      for (let dx = -rx; dx <= rx; dx++) {
        if ((dx * dx) / (rx * rx + 0.2) + (dy * dy) / (ry * ry + 0.2) <= 1) {
          this.pset(cx + dx, cy + dy, hex);
        }
      }
    }
  }
  outline(outlineHex = OUTLINE) {
    const copy = Buffer.from(this.data);
    const [or, og, ob, oa] = hexToRgba(outlineHex);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const idx = (y * this.w + x) * 4;
        if (copy[idx + 3] > 20) continue;
        const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
        const touchesSolid = neighbors.some(([nx, ny]) => {
          if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) return false;
          return copy[(ny * this.w + nx) * 4 + 3] > 200;
        });
        if (touchesSolid) {
          this.data[idx] = or;
          this.data[idx + 1] = og;
          this.data[idx + 2] = ob;
          this.data[idx + 3] = oa;
        }
      }
    }
  }
  blit(src, dx, dy, flipX = false) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const sx = flipX ? src.w - 1 - x : x;
        const sIdx = (y * src.w + sx) * 4;
        if (src.data[sIdx + 3] === 0) continue;
        this.pset(dx + x, dy + y, [src.data[sIdx], src.data[sIdx + 1], src.data[sIdx + 2], src.data[sIdx + 3]]);
      }
    }
  }
  save(filename) {
    writeFileSync(path.join(outDir, filename), encodePNG(this.w, this.h, this.data));
  }
}

// ============================================================================
// 1. 24 COZY PIXEL SNACKS ATLAS (6x4 grid of 24x24 icons = 144x96)
// ============================================================================
const snackIds = [
  "jjagyechi", "rabokki", "spammayo", "chickenmayo", "ramyeon", "rice",
  "dumplings", "curry", "skewer", "hotdog", "tornado", "cheeseball",
  "menbosha", "fries", "toast", "bungeoppang", "eolbaksa", "ashatchu",
  "tea", "cola", "misutgaru", "beads", "coffee", "corner-ade",
];

function drawSteam(s, x1, x2, yTop = 2) {
  s.pset(x1, yTop + 2, "#fff5e8aa");
  s.pset(x1 + 1, yTop + 1, "#fff5e8cc");
  s.pset(x1, yTop, "#fff5e888");
  s.pset(x2, yTop + 3, "#fff5e8aa");
  s.pset(x2 - 1, yTop + 1, "#fff5e8cc");
}

function makeSnackIcon(id) {
  const s = new PixelSurface(24, 24);
  s.ellipse(12, 21, 7, 2, "#4c383d44");
  const body = new PixelSurface(24, 24);
  switch (id) {
    case "jjagyechi": {
      body.ellipse(12, 16, 8, 4, "#569e7c");
      body.ellipse(12, 14, 8, 4, "#fbe3d3");
      body.ellipse(12, 14, 7, 3, "#5e3d32");
      body.pset(8, 14, "#7e5548"); body.pset(15, 15, "#7e5548");
      body.rect(9, 12, 6, 4, "#f6cf73");
      body.ellipse(12, 13, 3, 2, "#fff9f2");
      body.rect(11, 12, 2, 2, "#e8983e");
      body.pset(7, 13, "#8ea147"); body.pset(16, 13, "#8ea147");
      break;
    }
    case "rabokki": {
      body.ellipse(12, 16, 8, 4, "#7e5e68");
      body.ellipse(12, 13, 8, 4, "#e8685c");
      body.rect(7, 12, 4, 2, "#fff5eb");
      body.rect(13, 14, 4, 2, "#fff5eb");
      body.rect(9, 14, 4, 2, "#f6cf73");
      body.ellipse(13, 12, 3, 1, "#ffe7a8");
      body.pset(11, 11, "#8ea147");
      break;
    }
    case "spammayo": {
      body.rect(5, 13, 14, 5, "#569e7c");
      body.ellipse(12, 17, 6, 3, "#569e7c");
      body.ellipse(12, 12, 7, 4, "#fff5ea");
      body.rect(7, 10, 4, 3, "#e8748c");
      body.rect(12, 11, 4, 3, "#d9627a");
      body.rect(8, 12, 8, 1, "#ffe7a8");
      body.rect(9, 10, 6, 1, "#f6cf73");
      body.rect(11, 13, 3, 2, "#4c383d");
      break;
    }
    case "chickenmayo": {
      body.rect(5, 13, 14, 5, "#7e5e68");
      body.ellipse(12, 17, 6, 3, "#7e5e68");
      body.ellipse(12, 12, 7, 4, "#ffe7a8");
      body.circle(9, 11, 2, "#dc9666");
      body.circle(13, 11, 2, "#b86f4c");
      body.circle(11, 13, 2, "#ecc28e");
      body.rect(7, 11, 9, 1, "#fff9f0");
      break;
    }
    case "ramyeon": {
      body.rect(6, 10, 12, 9, "#e87468");
      body.rect(5, 9, 14, 2, "#fbe3d3");
      body.rect(7, 13, 10, 3, "#ffe7a8");
      body.rect(8, 14, 8, 1, "#e87468");
      body.ellipse(12, 9, 5, 2, "#f6cf73");
      body.pset(10, 9, "#8ea147"); body.pset(14, 9, "#8ea147");
      break;
    }
    case "rice": {
      body.ellipse(12, 16, 8, 4, "#fbe3d3");
      body.ellipse(12, 13, 6, 4, "#e36d5d");
      body.ellipse(12, 11, 4, 2, "#fff9f2");
      body.rect(11, 10, 2, 2, "#f6cf73");
      body.pset(8, 15, "#8ea147"); body.pset(16, 15, "#8ea147");
      break;
    }
    case "dumplings": {
      body.ellipse(12, 16, 8, 4, "#79a88c");
      body.ellipse(12, 15, 7, 3, "#dfd0d3");
      body.ellipse(8, 13, 3, 2, "#ecc28e");
      body.ellipse(12, 12, 3, 2, "#f6cf73");
      body.ellipse(15, 14, 3, 2, "#e88a78");
      body.rect(7, 14, 3, 1, "#b86f4c");
      body.rect(11, 13, 3, 1, "#b86f4c");
      break;
    }
    case "curry": {
      body.ellipse(12, 15, 8, 5, "#fff5eb");
      body.ellipse(10, 14, 4, 3, "#ffffff");
      body.ellipse(14, 15, 5, 3, "#9c5c3e");
      body.rect(11, 11, 5, 2, "#db635c");
      break;
    }
    case "skewer": {
      body.rect(11, 3, 2, 18, "#ecc28e");
      body.ellipse(12, 7, 4, 2, "#e86e68");
      body.ellipse(12, 10, 4, 2, "#fff5eb");
      body.ellipse(12, 13, 4, 2, "#e86e68");
      body.ellipse(12, 16, 4, 2, "#fff5eb");
      body.pset(12, 7, "#ffe7a8"); body.pset(11, 13, "#ffe7a8");
      break;
    }
    case "hotdog": {
      body.rect(11, 16, 2, 5, "#ecc28e");
      body.ellipse(12, 10, 4, 6, "#dc9666");
      body.ellipse(11, 9, 2, 5, "#ecc28e");
      for (let y = 6; y <= 14; y += 2) {
        body.pset(10 + (y % 4 ? 1 : -1), y, "#e85d56");
        body.pset(11 + (y % 4 ? -1 : 1), y + 1, "#f6cf73");
        body.pset(14, y, "#fff9f0");
      }
      break;
    }
    case "tornado": {
      body.rect(11, 3, 2, 18, "#ecc28e");
      for (let i = 0; i < 5; i++) {
        body.ellipse(12, 6 + i * 2.5, 5 - (i === 0 || i === 4 ? 1 : 0), 1, i % 2 ? "#f6cf73" : "#dc9666");
      }
      break;
    }
    case "cheeseball": {
      body.rect(5, 14, 14, 5, "#dfd0d3");
      body.circle(9, 12, 3, "#dc9666");
      body.circle(15, 12, 3, "#c47d4e");
      body.circle(12, 9, 3, "#f6cf73");
      body.pset(11, 8, "#fff9f0");
      break;
    }
    case "menbosha": {
      body.ellipse(12, 16, 8, 4, "#569e7c");
      body.rect(6, 11, 5, 5, "#ecc28e");
      body.rect(7, 13, 3, 2, "#f5a6b8");
      body.rect(13, 10, 5, 5, "#f6cf73");
      body.rect(14, 12, 3, 2, "#f5a6b8");
      body.circle(12, 16, 2, "#e8635a");
      break;
    }
    case "fries": {
      body.rect(7, 8, 2, 7, "#f6cf73");
      body.rect(10, 6, 2, 9, "#ffe7a8");
      body.rect(13, 7, 2, 8, "#ecc28e");
      body.rect(15, 9, 2, 6, "#f6cf73");
      body.rect(6, 12, 12, 8, "#e06767");
      body.rect(8, 14, 8, 2, "#fbe3d3");
      break;
    }
    case "toast": {
      body.rect(6, 7, 12, 11, "#dc9666");
      body.rect(7, 8, 10, 9, "#f5d8aa");
      body.rect(7, 12, 10, 2, "#e8748c");
      body.rect(8, 11, 8, 1, "#f6cf73");
      body.rect(8, 14, 8, 1, "#8ea147");
      body.rect(6, 14, 12, 5, "#fff5eb");
      break;
    }
    case "bungeoppang": {
      body.ellipse(11, 12, 6, 4, "#dc9666");
      body.ellipse(11, 12, 4, 3, "#f6cf73");
      body.rect(16, 9, 4, 6, "#b86f4c");
      body.pset(19, 12, "#00000000");
      body.pset(8, 11, OUTLINE);
      body.pset(11, 11, "#9e5938"); body.pset(13, 12, "#9e5938");
      body.rect(6, 15, 12, 5, "#f5d3c1");
      break;
    }
    case "eolbaksa": {
      body.rect(14, 3, 2, 7, "#e8748c");
      body.rect(7, 7, 10, 13, "#e4f2f7");
      body.rect(8, 9, 8, 10, "#f6cf73");
      body.rect(8, 9, 8, 3, "#ffe7a8");
      body.rect(9, 10, 2, 2, "#ffffff");
      body.rect(13, 12, 2, 2, "#ffffff");
      break;
    }
    case "ashatchu": {
      body.rect(13, 3, 2, 6, "#569e7c");
      body.rect(7, 7, 10, 13, "#eef4f7");
      body.rect(8, 12, 8, 7, "#dc9666");
      body.rect(8, 9, 8, 4, "#6e463a");
      body.rect(9, 9, 2, 2, "#ffffff");
      break;
    }
    case "tea": {
      body.rect(14, 3, 2, 6, "#f5a6b8");
      body.rect(7, 7, 10, 13, "#eef4f7");
      body.rect(8, 9, 8, 10, "#e5a56c");
      body.rect(9, 10, 2, 2, "#ffffff");
      body.rect(6, 7, 3, 3, "#f5a6b8");
      break;
    }
    case "cola": {
      body.rect(8, 6, 8, 14, "#59434a");
      body.rect(9, 5, 6, 1, "#dfd0d3");
      body.rect(8, 10, 8, 5, "#e06570");
      body.rect(10, 12, 4, 1, "#ffffff");
      break;
    }
    case "misutgaru": {
      body.rect(7, 7, 9, 13, "#fbe3d3");
      body.rect(16, 10, 3, 6, "#ecc28e");
      body.rect(8, 9, 7, 10, "#c9a67e");
      body.rect(9, 8, 5, 2, "#fff5eb");
      break;
    }
    case "beads": {
      body.rect(6, 13, 12, 7, "#89c4e1");
      body.rect(8, 15, 8, 3, "#fff5eb");
      const beadColors = ["#f5a6b8", "#ffe7a8", "#8ea147", "#89c4e1", "#c7aeb3"];
      for (let i = 0; i < 9; i++) {
        body.circle(8 + (i % 3) * 4, 11 - Math.floor(i / 3) * 2, 2, beadColors[i % beadColors.length]);
      }
      break;
    }
    case "coffee": {
      body.rect(13, 3, 2, 6, "#569e7c");
      body.rect(7, 7, 10, 13, "#e4eff2");
      body.rect(8, 9, 8, 10, "#6e463a");
      body.rect(9, 10, 2, 2, "#ffffff");
      body.rect(13, 12, 2, 2, "#ffffff");
      break;
    }
    case "corner-ade": {
      body.rect(14, 3, 2, 6, "#79b898");
      body.rect(7, 7, 10, 13, "#fff5eb");
      body.rect(8, 9, 8, 5, "#f5b8a8");
      body.rect(8, 14, 8, 5, "#e8748c");
      body.rect(6, 6, 3, 3, "#f6cf73");
      break;
    }
  }
  body.outline(OUTLINE);
  s.blit(body, 0, 0);
  if (["jjagyechi", "rabokki", "ramyeon", "rice", "dumplings", "curry", "bungeoppang"].includes(id)) {
    drawSteam(s, 9, 14, 2);
  }
  return s;
}

const snacksAtlas = new PixelSurface(24 * 6, 24 * 4);
snackIds.forEach((id, index) => {
  snacksAtlas.blit(makeSnackIcon(id), (index % 6) * 24, Math.floor(index / 6) * 24);
});
snacksAtlas.save("snacks-atlas.png");

// ============================================================================
// 2. COZY CAT CLERK SPRITE SHEET (4x4 of 48x52 = 192x208 PNG, #4c383d outlines)
// ============================================================================
function makeCatFrame(mode, frame) {
  const out = new PixelSurface(48, 52);
  out.ellipse(24, 48, 11, 3, "#4c383d44");

  const c = new PixelSurface(48, 52);
  const bob = (mode === "walk-tray" || mode === "walk-return") ? (frame % 2 === 1 ? -1 : 0) : (frame === 2 ? -1 : 0);
  const stride = (mode === "walk-tray" || mode === "walk-return") ? [-3, 0, 3, 0][frame] : 0;

  const tailSwing = [0, 1, 2, 1][frame];
  c.rect(32 + tailSwing, 33 + bob, 5, 3, "#dc9666");
  c.rect(35 + tailSwing, 29 + bob, 4, 5, "#fbe3d3");
  c.rect(36 + tailSwing, 27 + bob, 3, 2, "#b86f4c");

  if (mode !== "idle" && mode !== "cook") {
    c.rect(17 + stride, 41, 5, 6, "#f5d3c1");
    c.rect(26 - stride, 41, 5, 6, "#ecc28e");
    c.rect(16 + stride, 46, 6, 3, "#6e4c49");
    c.rect(25 - stride, 46, 6, 3, "#6e4c49");
  } else {
    c.rect(18, 41, 5, 6, "#f5d3c1");
    c.rect(25, 41, 5, 6, "#f5d3c1");
    c.rect(17, 46, 6, 3, "#6e4c49");
    c.rect(25, 46, 6, 3, "#6e4c49");
  }

  // Warm cream fur + Cozy Reference Sage Green Apron (#569e7c)
  c.rect(15, 27 + bob, 18, 15, "#fbe3d3");
  c.rect(16, 29 + bob, 16, 13, "#569e7c");
  c.rect(18, 30 + bob, 12, 5, "#77ba99");
  c.rect(26, 31 + bob, 3, 2, "#ffe7a8");
  c.rect(19, 37 + bob, 10, 3, "#3f7a5e");

  const earTwitch = (mode === "idle" && frame === 1) ? 1 : 0;
  c.rect(14, 9 + bob, 6, 6, "#dc9666");
  c.rect(15, 7 + bob, 4, 3, "#b86f4c");
  c.rect(16, 10 + bob, 3, 3, "#f5a6b8");
  c.rect(28, 9 + bob + earTwitch, 6, 6, "#dc9666");
  c.rect(29, 7 + bob + earTwitch, 4, 3, "#b86f4c");
  c.rect(29, 10 + bob + earTwitch, 3, 3, "#f5a6b8");

  c.ellipse(24, 18 + bob, 11, 8, "#fbe3d3");
  c.rect(15, 13 + bob, 18, 4, "#dc9666");
  c.rect(23, 12 + bob, 2, 5, "#b86f4c");
  c.rect(19, 12 + bob, 2, 3, "#b86f4c");
  c.rect(27, 12 + bob, 2, 3, "#b86f4c");

  if (mode === "cook") {
    c.rect(15, 10 + bob, 18, 4, "#fff9f2");
    c.rect(16, 13 + bob, 16, 1, "#e8748c");
  }

  const blink = (mode === "idle" && frame === 3);
  if (blink) {
    c.rect(18, 18 + bob, 3, 1, OUTLINE);
    c.rect(27, 18 + bob, 3, 1, OUTLINE);
  } else {
    c.rect(18, 17 + bob, 3, 3, OUTLINE);
    c.pset(18, 17 + bob, "#ffffff");
    c.rect(27, 17 + bob, 3, 3, OUTLINE);
    c.pset(27, 17 + bob, "#ffffff");
  }
  c.rect(15, 20 + bob, 3, 2, "#f5a6b8");
  c.rect(30, 20 + bob, 3, 2, "#f5a6b8");
  c.rect(23, 19 + bob, 2, 2, "#e8748c");
  c.pset(22, 21 + bob, OUTLINE); c.pset(25, 21 + bob, OUTLINE);

  if (mode === "walk-tray") {
    c.rect(11, 27 + bob, 5, 4, "#fbe3d3");
    c.rect(6, 24 + bob, 16, 2, "#dfd0d3");
    c.rect(8, 20 + bob, 5, 4, "#e87468");
    c.rect(14, 19 + bob, 4, 5, "#f6cf73");
  } else if (mode === "cook") {
    const stir = frame % 2 === 0 ? 0 : 2;
    c.rect(11, 29 + bob, 5, 4, "#fbe3d3");
    c.rect(31, 28 + bob, 6, 4, "#fbe3d3");
    c.rect(14, 34, 14, 6, "#ecc28e");
    c.rect(12, 35, 2, 2, "#b86f4c");
    c.rect(28, 35, 2, 2, "#b86f4c");
    c.rect(16 + stir, 27, 2, 8, "#c7aeb3");
  } else {
    c.rect(12, 29 + bob, 4, 7, "#fbe3d3");
    c.rect(32, 29 + bob, 4, 7, "#fbe3d3");
  }

  c.outline(OUTLINE);
  out.blit(c, 0, 0);
  out.rect(10, 19 + bob, 4, 1, "#7e5e68");
  out.rect(10, 21 + bob, 4, 1, "#7e5e68");
  out.rect(34, 19 + bob, 4, 1, "#7e5e68");
  out.rect(34, 21 + bob, 4, 1, "#7e5e68");
  if (mode === "cook" || mode === "walk-tray") {
    drawSteam(out, mode === "cook" ? 18 : 10, mode === "cook" ? 23 : 14, mode === "cook" ? 24 + (frame % 2) : 14);
  }
  return out;
}

const catSheet = new PixelSurface(48 * 4, 52 * 4);
["idle", "cook", "walk-tray", "walk-return"].forEach((mode, row) => {
  for (let frame = 0; frame < 4; frame++) {
    catSheet.blit(makeCatFrame(mode, frame), frame * 48, row * 52);
  }
});
catSheet.save("cat-clerk-sheet.png");

// ============================================================================
// 3. COZY HALL FACADE PROPS (Warm Timber & Mauve-Cream Glass, Zero Neon)
// ============================================================================
// 3A. Cozy Frosted-Glass Smoking Area Facade for Hall Top-Left
const boothFacade = new PixelSurface(180, 112);
{
  boothFacade.box(4, 6, 172, 102, "#7e5e68ee", OUTLINE);
  boothFacade.rect(6, 8, 168, 12, "#b86f4c"); // warm caramel timber beam
  boothFacade.rect(10, 20, 160, 3, "#ffe7a8"); // soft warm butter cove light
  const panes = [[10, 26, 48, 76], [62, 26, 54, 76], [120, 26, 50, 76]];
  for (const [px, py, pw, ph] of panes) {
    boothFacade.box(px, py, pw, ph, "#dfd0d3cc", "#6e4e56");
    for (let i = 0; i < 20; i++) {
      boothFacade.pset(px + 6 + i, py + 8 + i, "#fff5eb77");
      boothFacade.pset(px + 18 + i, py + 32 + i, "#fff5eb55");
    }
    boothFacade.rect(px + 2, py + ph - 24, pw - 4, 22, "#9e7b82dd");
  }
  boothFacade.rect(112, 56, 3, 16, "#fbe3d3");
  for (const fx of [32, 138]) {
    boothFacade.circle(fx, 14, 5, "#6e4e56");
    boothFacade.pset(fx - 2, 14, "#fbe3d3");
    boothFacade.pset(fx + 2, 14, "#fbe3d3");
    boothFacade.pset(fx, 12, "#fbe3d3");
    boothFacade.pset(fx, 16, "#fbe3d3");
  }
  // Cozy wooden plaque header
  boothFacade.box(62, 9, 56, 10, "#5c3f43", "#ecc28e");
  for (let x = 68; x < 112; x += 4) boothFacade.rect(x, 13, 2, 3, "#ffe7a8");
}
boothFacade.save("hall-smoking-booth.png");

// 3B. Cozy 2F Veranda Terrace Door for Hall Top-Right
const terracePortal = new PixelSurface(132, 88);
{
  terracePortal.box(4, 4, 124, 80, "#b86f4c", OUTLINE);
  terracePortal.box(10, 10, 112, 68, "#89c4e1", "#7a4c36");
  for (const [lx, ly] of [[22, 20], [42, 24], [64, 25], [86, 24], [106, 20]]) {
    terracePortal.circle(lx, ly, 2, "#f6cf73");
    terracePortal.pset(lx, ly, "#fffbe6");
  }
  terracePortal.rect(12, 50, 108, 2, "#6e4e56");
  for (let rx = 16; rx < 118; rx += 8) terracePortal.rect(rx, 50, 2, 24, "#6e4e56");
  terracePortal.rect(64, 10, 4, 68, "#7a4c36");
  terracePortal.rect(59, 42, 2, 10, "#ffe7a8");
  terracePortal.rect(71, 42, 2, 10, "#ffe7a8");
  terracePortal.box(38, 2, 56, 9, "#5c3f43", "#ecc28e");
  for (let x = 44; x < 88; x += 4) terracePortal.rect(x, 5, 2, 3, "#ffe7a8");
}
terracePortal.save("hall-terrace-door.png");

// 3C. Cozy Mauve & Caramel Open-Kitchen Counter Base
const openKitchen = new PixelSurface(116, 116);
{
  openKitchen.rect(14, 16, 98, 76, "#7e5e68");
  openKitchen.rect(16, 24, 94, 2, "#dc9666");
  openKitchen.rect(16, 38, 94, 2, "#b86f4c");
  openKitchen.box(22, 28, 7, 10, "#e8748c", OUTLINE);
  openKitchen.box(30, 29, 7, 9, "#f6cf73", OUTLINE);
  openKitchen.box(42, 27, 18, 11, "#9e7b82", OUTLINE);
  openKitchen.rect(45, 30, 9, 5, "#ffe7a8");
  openKitchen.box(66, 29, 14, 9, "#dc9666", OUTLINE);
  openKitchen.rect(20, 84, 72, 2, OUTLINE);
  openKitchen.rect(20, 86, 72, 3, "#ecc28e");
  openKitchen.rect(20, 89, 72, 6, "#9e7b82");
}
openKitchen.save("counter-open-kitchen.png");

// 4. 9 COZY PIXEL LAUNCHER ICONS (9 cols x 1 row of 24x24 = 216x24 PNG)
const gameIcons = new PixelSurface(24 * 9, 24);
{
  const icons = [
    (g) => {
      g.box(3, 3, 18, 18, "#ecc28e", OUTLINE);
      g.rect(11, 5, 1, 14, "#b86f4c"); g.rect(5, 11, 14, 1, "#b86f4c");
      g.circle(8, 8, 3, OUTLINE); g.pset(7, 7, "#9e7b82");
      g.circle(15, 15, 3, "#fff9f2"); g.pset(14, 14, "#ffffff");
      g.pset(15, 7, "#569e7c"); g.pset(8, 15, "#e8748c");
    },
    (g) => {
      g.box(3, 3, 18, 18, "#7e5e68", OUTLINE);
      const blk = (x, y, c) => { g.box(x, y, 5, 5, c, OUTLINE); g.pset(x + 1, y + 1, "#ffffffaa"); };
      blk(7, 6, "#e8748c"); blk(12, 6, "#e8748c"); blk(7, 11, "#e8748c");
      blk(12, 11, "#569e7c"); blk(12, 15, "#569e7c"); blk(7, 15, "#f6cf73");
    },
    (g) => {
      g.box(3, 4, 18, 16, "#7e5e68", OUTLINE);
      g.ellipse(11, 12, 6, 4, "#dc9666");
      g.rect(16, 9, 4, 6, "#b86f4c");
      g.pset(8, 11, OUTLINE);
      g.pset(11, 11, "#ffe7a8");
    },
    (g) => {
      g.box(3, 3, 18, 18, "#569e7c", OUTLINE);
      g.rect(6, 7, 4, 3, "#dc9666"); g.rect(14, 7, 4, 3, "#dc9666");
      g.ellipse(12, 13, 6, 5, "#fbe3d3");
      g.rect(7, 8, 10, 3, "#fff9f2"); g.rect(8, 10, 8, 1, "#e8748c");
      g.pset(9, 13, OUTLINE); g.pset(15, 13, OUTLINE);
      g.rect(11, 14, 2, 1, "#e8748c");
    },
    (g) => {
      g.box(3, 3, 18, 18, "#89c4e1", OUTLINE);
      g.rect(6, 5, 1, 4, "#fff9f2"); g.rect(12, 4, 1, 5, "#e8748c"); g.rect(17, 6, 1, 4, "#fff9f2");
      g.box(6, 11, 12, 8, "#fbe3d3", OUTLINE);
      g.rect(8, 13, 8, 3, "#569e7c");
    },
    (g) => {
      g.box(3, 3, 18, 18, "#c7aeb3", OUTLINE);
      g.circle(11, 13, 5, OUTLINE);
      g.pset(9, 11, "#fbe3d3");
      g.rect(10, 6, 2, 3, "#9e7b82");
      g.rect(12, 5, 4, 3, "#e8748c");
      g.pset(14, 4, "#f6cf73");
    },
    (g) => {
      g.box(3, 3, 18, 18, "#6e525a", OUTLINE);
      g.rect(5, 5, 6, 3, "#e8748c"); g.rect(13, 5, 6, 3, "#89c4e1");
      g.rect(5, 9, 6, 3, "#f6cf73"); g.rect(13, 9, 6, 3, "#8ea147");
      g.circle(13, 14, 2, "#fff9f2");
      g.rect(7, 17, 10, 2, "#fbe3d3");
    },
    (g) => {
      g.box(3, 3, 18, 18, "#dc9666", OUTLINE);
      g.box(5, 5, 14, 14, "#f6cf73", "#b86f4c");
      g.rect(7, 9, 3, 1, OUTLINE); g.rect(9, 10, 1, 2, OUTLINE); g.rect(7, 12, 3, 3, OUTLINE);
      g.rect(12, 9, 4, 6, OUTLINE); g.rect(13, 10, 2, 4, "#f6cf73");
    },
    (g) => {
      g.box(3, 3, 18, 18, "#fbe3d3", OUTLINE);
      g.rect(9, 4, 1, 16, "#9e7b82"); g.rect(14, 4, 1, 16, "#9e7b82");
      g.rect(4, 9, 16, 1, "#9e7b82"); g.rect(4, 14, 16, 1, "#9e7b82");
      g.rect(6, 6, 2, 2, "#569e7c"); g.rect(11, 11, 2, 2, "#e8748c"); g.rect(16, 16, 2, 2, "#569e7c");
    },
  ];
  icons.forEach((fn, idx) => {
    const s = new PixelSurface(24, 24);
    fn(s);
    gameIcons.blit(s, idx * 24, 0);
  });
}
gameIcons.save("launcher-icons.png");

console.log("Compiled Cozy Pixel Reference sprites successfully!");
