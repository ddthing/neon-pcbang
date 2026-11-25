// Pure 1px-Grid Kairosoft / Stardew-Style Pixel Art World Compiler (384x256 -> 4x NearestNeighbor 1536x1024)
// Zero AI blur, zero doubled static sprites, 1:1 exact alignment with cafe-screen-shapes.js & cafe-world.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pubDir = path.join(__dirname, "../public");

const INK = "#4c383d";
const WOOD_DARK = "#8c5136";
const WOOD_MID = "#b86f4c";
const WOOD_WARM = "#dc9666";
const WOOD_LIGHT = "#ecc28e";
const PLANK_A = "#cf8b57";
const PLANK_B = "#c27e4b";
const PLANK_SEAM = "#9e6036";
const WALL_PEACH = "#fbe3d3";
const WALL_SHADE = "#ead0bf";
const WALL_CREAM = "#fff5eb";
const MAUVE_LIGHT = "#dfd0d3";
const MAUVE_MID = "#9e7b82";
const MAUVE_DARK = "#7e5e68";
const SAGE = "#569e7c";
const SAGE_DARK = "#3a6e54";
const OLIVE = "#8ea147";
const OLIVE_LIGHT = "#b3c468";
const BUTTER = "#f6cf73";
const BUTTER_HI = "#fff1be";
const BERRY = "#e8748c";
const SKY_BLUE = "#99cce3";

// CRC32 + PNG Encoder (4x NearestNeighbor upscaler built-in)
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
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
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
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 6 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function hexRgba(hex) {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
    clean.length === 8 ? parseInt(clean.slice(6, 8), 16) : 255,
  ];
}

class PixelCanvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 4);
  }
  px(x, y, col) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const [r, g, b, a] = typeof col === "string" ? hexRgba(col) : col;
    if (a === 0) return;
    const idx = (y * this.w + x) * 4;
    if (a === 255 || this.data[idx + 3] === 0) {
      this.data[idx] = r; this.data[idx + 1] = g; this.data[idx + 2] = b; this.data[idx + 3] = a;
    } else {
      const sa = a / 255;
      this.data[idx] = Math.round(r * sa + this.data[idx] * (1 - sa));
      this.data[idx + 1] = Math.round(g * sa + this.data[idx + 1] * (1 - sa));
      this.data[idx + 2] = Math.round(b * sa + this.data[idx + 2] * (1 - sa));
      this.data[idx + 3] = 255;
    }
  }
  rect(x, y, w, h, col) {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.px(x + dx, y + dy, col);
  }
  box(x, y, w, h, fill, border = INK) {
    if (fill) this.rect(x + 1, y + 1, w - 2, h - 2, fill);
    this.rect(x, y, w, 1, border);
    this.rect(x, y + h - 1, w, 1, border);
    this.rect(x, y, 1, h, border);
    this.rect(x + w - 1, y, 1, h, border);
  }
  circle(cx, cy, r, col) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r + r * 0.35) this.px(cx + dx, cy + dy, col);
      }
    }
  }
  woodFloor(x0, y0, w, h) {
    this.rect(x0, y0, w, h, PLANK_A);
    for (let y = y0; y < y0 + h; y += 6) {
      this.rect(x0, y, w, 1, PLANK_SEAM);
      const offset = ((Math.floor(y / 6)) % 2) * 10;
      for (let x = x0 + offset; x < x0 + w; x += 20) {
        this.rect(x, y + 1, 1, 5, PLANK_SEAM);
        if ((x + y) % 12 === 0) this.rect(x + 2, y + 2, 12, 3, PLANK_B);
      }
      this.rect(x0, y + 1, w, 1, "#dda06d55");
    }
  }
  checkerFloor(x0, y0, w, h, size = 8, c1 = MAUVE_LIGHT, c2 = "#cbb8bc") {
    for (let ty = y0; ty < y0 + h; ty += size) {
      for (let tx = x0; tx < x0 + w; tx += size) {
        const alt = ((Math.floor((tx - x0) / size) + Math.floor((ty - y0) / size)) & 1) === 0;
        const cw = Math.min(size, x0 + w - tx);
        const ch = Math.min(size, y0 + h - ty);
        this.rect(tx, ty, cw, ch, alt ? c1 : c2);
        this.rect(tx, ty, cw, 1, "#ffffff26");
      }
    }
  }
  plant(cx, cy, size = "md") {
    if (size === "sm") {
      this.box(cx - 3, cy + 1, 6, 5, WALL_CREAM, INK);
      this.rect(cx - 2, cy + 2, 4, 1, WOOD_WARM);
      this.circle(cx, cy - 1, 3, OLIVE);
      this.circle(cx - 2, cy - 2, 2, SAGE);
      this.circle(cx + 2, cy - 2, 2, OLIVE_LIGHT);
      return;
    }
    this.box(cx - 4, cy + 2, 8, 6, WALL_CREAM, INK);
    this.rect(cx - 3, cy + 3, 6, 1, WOOD_WARM);
    this.circle(cx, cy - 2, 4, SAGE_DARK);
    this.circle(cx - 3, cy - 1, 3, SAGE);
    this.circle(cx + 3, cy - 1, 3, OLIVE);
    this.circle(cx, cy - 4, 3, OLIVE_LIGHT);
    this.px(cx - 1, cy - 5, BUTTER_HI);
  }
  lampGlow(cx, cy, r = 10) {
    this.circle(cx, cy, r, "#ffe7a824");
    this.circle(cx, cy, Math.round(r * 0.6), "#f6cf732e");
  }
  pendantLamp(cx, topY, wireH = 6) {
    this.rect(cx, topY, 1, wireH, INK);
    this.lampGlow(cx, topY + wireH + 4, 12);
    this.box(cx - 4, topY + wireH, 8, 4, BUTTER, INK);
    this.rect(cx - 3, topY + wireH + 1, 3, 1, BUTTER_HI);
    this.rect(cx - 2, topY + wireH + 4, 4, 1, BUTTER_HI);
  }
  hangingVines(x0, y0, w) {
    for (let x = x0; x < x0 + w; x += 6) {
      const len = 4 + ((x * 7) % 6);
      this.rect(x, y0, 1, len, SAGE_DARK);
      for (let dy = 1; dy < len; dy += 2) {
        this.rect(x - 1, y0 + dy, 3, 2, dy % 4 === 1 ? OLIVE : SAGE);
        this.px(x + ((dy & 1) ? 1 : -1), y0 + dy, OLIVE_LIGHT);
      }
    }
  }
  swivelChair(cx, cy, fillCol = "#8db59e") {
    // Cozy chunky top-down office chair
    this.rect(cx - 2, cy + 2, 4, 2, INK);
    this.box(cx - 4, cy - 4, 8, 7, fillCol, INK);
    this.rect(cx - 3, cy - 3, 6, 2, "#ffffff55");
    this.rect(cx - 4, cy + 1, 8, 1, "#4c383d55");
  }
  monitorStation(x, y, face = "up", chairCol = "#8db59e") {
    // Hall side-facing or Room up-facing crisp pixel desk + monitor
    if (face === "left" || face === "right") {
      // Bank station: monitor sits inside (x..x+7, y..y+5) aligned with cafe-screen-shapes.js
      this.box(x, y, 8, 5, "#2b2429", INK);
      this.rect(x + 1, y + 1, 6, 3, "#525e6b");
      this.px(x + 2, y + 1, "#89c4e155");
      // Tiny keyboard beside monitor
      const kx = face === "left" ? x - 3 : x + 8;
      this.box(kx, y + 1, 3, 4, WALL_PEACH, INK);
      // Chair beside desk
      const cx = face === "left" ? x - 6 : x + 13;
      this.swivelChair(cx, y + 2, chairCol);
    }
  }
  drawKoreanSign(x, y, w, h, label) {
    // Crisp 7x8 readable Hangul pixel plaque with 2px inner padding
    this.box(x, y, w, h, WALL_CREAM, INK);
    const glyph = {
      흡: ["0001000", "0111110", "0011100", "0100010", "0011100", "1111111", "1000001", "1111111"],
      연: ["0110001", "1001011", "1001001", "0110011", "0000001", "1000000", "1000000", "1111110"],
      구: ["1111110", "0000010", "0000010", "1111111", "0001000", "0001000", "0001000", "0001000"],
      역: ["0111001", "1000111", "1000101", "0111001", "0000000", "1111111", "0000001", "0000001"],
      테: ["1111001", "1000101", "1110111", "1000101", "1111001", "0000101", "0000001", "0000001"],
      라: ["1110010", "0010010", "1110011", "1000010", "1111010", "0000010", "0000010", "0000010"],
      스: ["0011000", "0100100", "1000010", "0000000", "0000000", "1111111", "0000000", "0000000"],
    };
    const chars = [...label];
    const startX = x + Math.floor((w - chars.length * 8 + 1) / 2);
    const startY = y + Math.floor((h - 8) / 2);
    chars.forEach((ch, idx) => {
      const mat = glyph[ch];
      if (!mat) return;
      for (let r = 0; r < mat.length; r++) {
        for (let c = 0; c < mat[r].length; c++) {
          if (mat[r][c] === "1") this.px(startX + idx * 8 + c, startY + r, INK);
        }
      }
    });
  }
  saveUpscaled(filename, scale = 4) {
    const outW = this.w * scale;
    const outH = this.h * scale;
    const scaled = Buffer.alloc(outW * outH * 4);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const sIdx = (y * this.w + x) * 4;
        const r = this.data[sIdx], g = this.data[sIdx + 1], b = this.data[sIdx + 2], a = this.data[sIdx + 3];
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const dIdx = ((y * scale + sy) * outW + (x * scale + sx)) * 4;
            scaled[dIdx] = r; scaled[dIdx + 1] = g; scaled[dIdx + 2] = b; scaled[dIdx + 3] = a;
          }
        }
      }
    }
    writeFileSync(path.join(pubDir, filename), encodePNG(outW, outH, scaled));
  }
}

// ============================================================================
// 1. MAIN HALL (384x256 -> 1536x1024)
// Exact coords matched to cafe-screen-shapes.js & lib/cafe-world.mjs & app.js
// ============================================================================
const hall = new PixelCanvas(384, 256);
{
  // Outer hall timber floor & bottom outdoor sidewalk tiles
  hall.woodFloor(4, 34, 376, 178);
  hall.checkerFloor(0, 210, 384, 46, 8, "#7e6e72", "#706064");

  // Top & perimeter walls
  hall.rect(0, 0, 384, 11, WALL_PEACH);
  hall.rect(0, 10, 384, 2, WOOD_DARK);
  hall.rect(0, 0, 6, 214, WALL_PEACH);
  hall.rect(5, 0, 2, 214, WOOD_MID);
  hall.rect(378, 0, 6, 214, WALL_PEACH);
  hall.rect(377, 0, 2, 214, WOOD_MID);

  // Top Panoramic Window Sill & Counter (x: 62..322, y: 10..33 matches cafe-glass-hall.png!)
  hall.box(60, 8, 264, 27, WOOD_WARM, INK);
  hall.rect(62, 10, 260, 23, "#a8c7d4"); // window backdrop (masked by live #window-view)
  for (let wx = 78; wx < 320; wx += 18) hall.rect(wx, 10, 2, 23, WOOD_DARK);
  hall.rect(60, 33, 264, 4, WOOD_LIGHT);
  hall.rect(60, 37, 264, 1, INK);
  for (const sx of [76, 88, 134, 146, 216, 228, 240, 284, 296]) {
    hall.box(sx, 36, 7, 5, WOOD_WARM, INK);
  }
  for (const lx of [88, 140, 194, 244, 294]) hall.pendantLamp(lx, 6, 6);

  // Top-Left Indoor Smoking Area Entrance (portal at x: 18.2%, y: 17.5% -> 70, 44)
  hall.box(6, 2, 52, 34, WALL_PEACH, INK);
  hall.box(12, 14, 18, 18, MAUVE_LIGHT, WOOD_MID);
  hall.box(32, 14, 18, 18, MAUVE_LIGHT, WOOD_MID);
  hall.rect(14, 24, 14, 5, MAUVE_MID);
  hall.rect(34, 24, 14, 5, MAUVE_MID);
  hall.px(27, 22, WOOD_LIGHT); hall.px(35, 22, WOOD_LIGHT);
  hall.drawKoreanSign(12, 1, 40, 12, "흡연구역");
  hall.plant(61, 29, "sm");

  // Top-Right Outdoor Terrace Veranda Door (portal at x: 82.2%, y: 17.5% -> 315, 44)
  hall.box(326, 2, 52, 30, WALL_PEACH, INK);
  hall.box(334, 14, 36, 16, SKY_BLUE, WOOD_MID);
  hall.rect(351, 14, 2, 16, WOOD_DARK);
  hall.rect(334, 22, 36, 2, WOOD_DARK);
  for (const lx of [340, 352, 364]) hall.px(lx, 17, BUTTER_HI);
  hall.drawKoreanSign(335, 1, 34, 12, "테라스");
  hall.plant(321, 29, "sm");

  // Left 1P Solo Room (y: 38..84, door at 16.6% = 64)
  hall.box(6, 38, 56, 46, WALL_PEACH, INK);
  hall.woodFloor(9, 43, 50, 38);
  hall.box(28, 56, 20, 11, WOOD_WARM, INK);
  hall.box(32, 58, 11, 6, "#2b2429", INK); // aligns with hall-solo monitor
  hall.rect(33, 59, 9, 4, "#525e6b");
  hall.swivelChair(37, 72, "#94b59c");
  hall.plant(16, 68, "sm");
  hall.pendantLamp(37, 40, 3);
  hall.rect(61, 60, 2, 14, PLANK_A); // door opening

  // Left 2P Duo Room (y: 88..146, door at 16.6% = 64)
  hall.box(6, 88, 56, 58, WALL_PEACH, INK);
  hall.rect(9, 92, 50, 51, "#b4c9a8");
  hall.woodFloor(9, 108, 50, 35);
  hall.box(18, 104, 34, 10, WALL_CREAM, INK);
  hall.box(22, 105, 10, 6, "#2b2429", INK);
  hall.box(37, 105, 10, 6, "#2b2429", INK);
  hall.swivelChair(27, 119, "#94b59c");
  hall.swivelChair(42, 119, "#c4a3b5");
  hall.box(12, 126, 20, 12, "#dfd0d3", INK); // cozy sofa
  hall.pendantLamp(34, 90, 3);
  hall.rect(61, 122, 2, 14, PLANK_A); // door opening

  // Cozy Lounge Sofa Corner between Solo/Duo & PC Columns (matches hallObstacles [16.2,29..23.7,51.6])
  hall.box(65, 80, 22, 42, "#cbb4a0", INK);
  hall.box(71, 86, 10, 30, WALL_CREAM, INK);
  hall.lampGlow(76, 92, 7); hall.lampGlow(76, 110, 7);
  hall.box(74, 90, 4, 4, BUTTER, INK);
  hall.box(74, 108, 4, 4, BUTTER, INK);
  hall.plant(76, 100, "sm");

  // Bottom-Left Open-Kitchen Snack Counter (NO static baked cat so live Cat Clerk renders cleanly!)
  hall.box(6, 150, 68, 56, WALL_PEACH, INK);
  hall.checkerFloor(9, 153, 62, 50, 6, "#7e5e68", "#6b4e57");
  // Back kitchen shelves & menu ramen sign
  hall.box(10, 154, 18, 22, WOOD_DARK, INK);
  hall.rect(12, 159, 14, 2, WOOD_WARM);
  hall.rect(12, 166, 14, 2, WOOD_WARM);
  for (const bx of [13, 17, 21]) {
    hall.box(bx, 155, 3, 4, BERRY, INK);
    hall.box(bx, 162, 3, 4, BUTTER, INK);
  }
  hall.box(30, 154, 22, 14, "#38282b", INK); // Ramen chalkboard sign
  hall.rect(36, 160, 10, 4, BUTTER_HI);
  hall.rect(38, 156, 1, 3, BUTTER); hall.rect(41, 156, 1, 3, BUTTER); hall.rect(44, 156, 1, 3, BUTTER);
  // Cold Drink Fridge
  hall.box(54, 156, 15, 28, "#dbe9f0", INK);
  hall.rect(56, 160, 11, 2, BERRY);
  hall.rect(56, 166, 11, 2, SAGE);
  hall.rect(56, 172, 11, 2, BUTTER);
  hall.rect(56, 178, 11, 2, SKY_BLUE);
  // Open-Kitchen Counter Bar (open center space for Cat Clerk!)
  hall.box(10, 190, 56, 12, WOOD_WARM, INK);
  hall.rect(11, 191, 54, 3, WALL_CREAM);
  hall.box(16, 187, 8, 4, "#3b2d31", INK); // POS monitor
  hall.plant(66, 198, "sm");

  // Right 5P Team Room (y: 34..112, door at 84.5% = 324)
  hall.box(324, 34, 54, 78, WALL_PEACH, INK);
  hall.rect(327, 38, 48, 71, "#bfa5b2");
  hall.woodFloor(327, 40, 26, 68);
  hall.box(352, 38, 18, 68, WOOD_WARM, INK);
  for (let i = 0; i < 5; i++) {
    const sy = 40 + i * 14;
    hall.box(356, sy - 4, 11, 6, "#2b2429", INK);
    hall.swivelChair(344, sy, "#8db59e");
  }
  hall.pendantLamp(346, 36, 3);
  hall.rect(324, 88, 2, 14, PLANK_A);

  // Right 6P Squad Room (y: 118..208, door at 84.5% = 324)
  hall.box(324, 118, 54, 90, WALL_PEACH, INK);
  hall.rect(327, 122, 48, 82, "#aebd9c");
  for (let row = 0; row < 3; row++) {
    const dy = 138 + row * 22;
    hall.box(332, dy, 18, 10, WOOD_WARM, INK);
    hall.box(352, dy, 18, 10, WOOD_WARM, INK);
    hall.box(336, dy + 1, 11, 6, "#2b2429", INK);
    hall.box(356, dy + 1, 11, 6, "#2b2429", INK);
    hall.swivelChair(341, dy + 12, "#8db59e");
    hall.swivelChair(361, dy + 12, "#c4a3b5");
  }
  hall.pendantLamp(351, 120, 3);
  hall.rect(324, 152, 2, 14, PLANK_A);

  // Center 4 Double-Sided PC Desk Banks (Exact coords: hallBanks / 4 & hallRows / 4!)
  const bankXs = [104, 160, 220, 280];
  const rowYs = [47, 59, 71, 83, 95, 107, 119, 131, 143, 155, 167];
  for (const bx of bankXs) {
    // Central wood spine desk dividing left & right seats cleanly
    hall.box(bx + 7, 45, 14, 132, WOOD_MID, INK);
    hall.rect(bx + 13, 46, 2, 130, WOOD_DARK);
    rowYs.forEach((ry, rIdx) => {
      const altCol = rIdx % 2 === 0 ? "#8db59e" : "#c4a3b5";
      const altColR = rIdx % 2 === 0 ? "#c4a3b5" : "#8db59e";
      hall.monitorStation(bx, ry, "left", altCol);
      hall.monitorStation(bx + 20, ry, "right", altColR);
    });
    // Bottom lantern post + potted plants at each bank end
    hall.lampGlow(bx + 14, 182, 9);
    hall.box(bx + 11, 179, 6, 7, BUTTER, INK);
    hall.plant(bx + 4, 182, "sm");
    hall.plant(bx + 24, 182, "sm");
  }

  // Bottom Perimeter Wall + Wooden Kiosk + Double Glass Entrance
  hall.box(6, 206, 144, 12, WALL_PEACH, INK);
  hall.rect(8, 210, 140, 4, WOOD_MID);
  hall.box(232, 206, 146, 12, WALL_PEACH, INK);
  hall.rect(234, 210, 142, 4, WOOD_MID);

  // Cozy Entrance Kiosk (kiosk at 26.3%, 81.5% -> 101, 208)
  hall.box(92, 198, 18, 28, WOOD_LIGHT, INK);
  hall.box(95, 201, 12, 11, SAGE, INK);
  hall.rect(97, 203, 8, 7, "#d4ecd9");
  hall.rect(99, 218, 4, 6, WOOD_DARK);

  // Main Double Glass Entrance Doors (entrance at 49%, 85% -> 188, 218)
  hall.box(148, 202, 12, 22, WALL_PEACH, INK);
  hall.box(222, 202, 12, 22, WALL_PEACH, INK);
  hall.box(151, 207, 6, 10, BUTTER, INK);
  hall.box(225, 207, 6, 10, BUTTER, INK);
  hall.box(160, 204, 62, 20, "#a8c7d4cc", INK);
  hall.rect(190, 204, 2, 20, WOOD_DARK);
  hall.rect(187, 211, 2, 6, WALL_CREAM);
  hall.rect(193, 211, 2, 6, WALL_CREAM);
  hall.box(168, 226, 46, 8, SAGE, INK); // Welcome mat
  hall.plant(140, 218, "md");
  hall.plant(242, 218, "md");
  hall.box(46, 216, 28, 10, WOOD_WARM, INK);
  hall.box(304, 216, 28, 10, WOOD_WARM, INK);
}
hall.saveUpscaled("pcbang-cozy-hall.png", 4);

// ============================================================================
// 2. 4-ROOM 2x2 GRID (384x256 -> 1536x1024)
// Exact quadrants: 192x128 each, aligned with spaces[].positions & cafe-screen-shapes.js
// ============================================================================
const rooms = new PixelCanvas(384, 256);
{
  const drawRoomBackdrop = (ox, oy, wallCol, rugCol) => {
    rooms.rect(ox, oy, 192, 34, wallCol);
    rooms.rect(ox, oy + 34, 192, 2, WOOD_DARK);
    rooms.checkerFloor(ox, oy + 36, 192, 92, 10, MAUVE_LIGHT, "#cfc0c4");
    // Left angled window matching cafe-glass-rooms.png
    rooms.box(ox, oy + 2, 46, 72, WOOD_WARM, INK);
    rooms.rect(ox + 2, oy + 6, 40, 62, "#a8c7d4");
    rooms.rect(ox + 22, oy + 4, 3, 66, WOOD_DARK);
    rooms.rect(ox + 2, oy + 34, 42, 3, WOOD_DARK);
    rooms.plant(ox + 16, oy + 64, "sm");
    // Cozy area rug
    rooms.box(ox + 34, oy + 66, 124, 44, rugCol, WALL_CREAM);
  };

  // Top-Left: 1P Solo Booth (seat [53.1%, 38.8%] -> monitor at 81..122, 39..60 in 192x128)
  drawRoomBackdrop(0, 0, WALL_PEACH, "#c9a8b2");
  rooms.box(50, 26, 104, 44, WALL_CREAM, INK);
  rooms.box(54, 48, 96, 18, WOOD_WARM, INK);
  rooms.box(80, 37, 44, 24, "#2b2429", INK);
  rooms.rect(82, 39, 40, 20, "#525e6b");
  rooms.box(86, 61, 32, 4, WALL_PEACH, INK);
  rooms.swivelChair(102, 74, "#c4a3b5");
  rooms.pendantLamp(102, 0, 8);
  rooms.hangingVines(58, 2, 86);
  rooms.plant(158, 72, "md");

  // Top-Right: 2P Duo Room (monitors at 54..88 & 108..143, y: 43..60)
  drawRoomBackdrop(192, 0, WALL_PEACH, "#a9bfad");
  rooms.box(192 + 36, 52, 126, 20, "#dce8da", INK);
  rooms.box(192 + 52, 41, 38, 20, "#2b2429", INK);
  rooms.box(192 + 106, 41, 38, 20, "#2b2429", INK);
  rooms.rect(192 + 54, 43, 34, 16, "#525e6b");
  rooms.rect(192 + 108, 43, 34, 16, "#525e6b");
  rooms.swivelChair(192 + 70, 74, "#8db59e");
  rooms.swivelChair(192 + 125, 74, "#8db59e");
  rooms.pendantLamp(192 + 70, 0, 8);
  rooms.pendantLamp(192 + 125, 0, 8);
  rooms.box(192 + 64, 18, 66, 4, WOOD_MID, INK);
  rooms.plant(192 + 170, 72, "md");

  // Bottom-Left: 5P Team Room (5 monitors at x: 32, 62, 92, 122, 152)
  drawRoomBackdrop(0, 128, "#cbb4bf", "#c2adb8");
  rooms.box(22, 128 + 56, 158, 16, WOOD_LIGHT, INK);
  for (let i = 0; i < 5; i++) {
    const mx = 31 + i * 30;
    rooms.box(mx, 128 + 44, 22, 15, "#2b2429", INK);
    rooms.rect(mx + 2, 128 + 46, 18, 11, "#525e6b");
    rooms.swivelChair(mx + 11, 128 + 76, "#a692ab");
  }
  rooms.pendantLamp(54, 128, 7);
  rooms.pendantLamp(100, 128, 7);
  rooms.pendantLamp(146, 128, 7);
  rooms.hangingVines(48, 130, 126);

  // Bottom-Right: 6P Tiered Squad Room (back 3 + front 3)
  drawRoomBackdrop(192, 128, "#b89993", "#95a89d");
  rooms.box(192 + 38, 128 + 32, 134, 14, WOOD_WARM, INK);
  for (let i = 0; i < 3; i++) {
    const mx = 192 + 48 + i * 40;
    rooms.box(mx, 128 + 21, 30, 16, "#2b2429", INK);
    rooms.rect(mx + 2, 128 + 23, 26, 12, "#525e6b");
    rooms.swivelChair(mx + 15, 128 + 43, i === 1 ? "#c4a3b5" : "#8db59e");
  }
  rooms.box(192 + 30, 128 + 66, 148, 18, WOOD_LIGHT, INK);
  for (let i = 0; i < 3; i++) {
    const mx = 192 + 39 + i * 47;
    rooms.box(mx, 128 + 54, 32, 17, "#2b2429", INK);
    rooms.rect(mx + 2, 128 + 56, 28, 13, "#525e6b");
    rooms.swivelChair(mx + 16, 128 + 86, i === 1 ? "#c4a3b5" : "#8db59e");
  }
  rooms.pendantLamp(192 + 62, 128, 6);
  rooms.pendantLamp(192 + 106, 128, 6);
  rooms.pendantLamp(192 + 148, 128, 6);

  // Crisp 2px quadrant dividers
  rooms.rect(191, 0, 2, 256, INK);
  rooms.rect(0, 127, 384, 2, INK);
}
rooms.saveUpscaled("pcbang-rooms-pixel.png", 4);

// ============================================================================
// 3. INDOOR FROSTED-GLASS SMOKING AREA (384x256 -> 1536x1024)
// Matches relaxZones.booth bounds [11..88.5, 47..67.5] & spots
// ============================================================================
const booth = new PixelCanvas(384, 256);
{
  booth.rect(0, 0, 384, 84, WALL_PEACH);
  booth.rect(0, 18, 384, 4, "#f4ccb4");
  booth.rect(0, 84, 384, 34, WOOD_WARM);
  for (let x = 8; x < 384; x += 12) booth.rect(x, 84, 1, 34, WOOD_MID);
  booth.rect(0, 83, 384, 2, INK);
  booth.rect(0, 118, 384, 2, INK);
  booth.checkerFloor(0, 120, 384, 136, 14, MAUVE_LIGHT, "#be9da6");

  // Ceiling exhaust fans + pendant lamps
  for (const fx of [72, 304]) {
    booth.box(fx - 12, 8, 24, 24, "#dbe0e6", INK);
    booth.circle(fx, 20, 8, MAUVE_DARK);
    booth.rect(fx - 6, 19, 12, 2, WALL_CREAM);
    booth.rect(fx - 1, 14, 2, 12, WALL_CREAM);
  }
  for (const lx of [36, 168, 350]) booth.pendantLamp(lx, 0, 12);

  // Panoramic window + wooden counter ledge (spot: window at 31.5%, 49.2%)
  booth.box(58, 36, 86, 56, WOOD_MID, INK);
  booth.rect(62, 40, 78, 48, SKY_BLUE);
  booth.rect(62, 72, 78, 16, "#95ad78");
  booth.box(54, 92, 94, 10, WOOD_DARK, INK);

  // Wooden "흡연구역" Plaque centered on wall
  booth.drawKoreanSign(198, 44, 72, 22, "흡연구역");

  // Two standing ashtrays (spots: 45.8%, 78.2%) + lush plant
  for (const ax of [174, 300]) {
    booth.box(ax - 5, 114, 10, 4, "#d2ccd4", INK);
    booth.rect(ax - 1, 96, 2, 18, "#8c828a");
    booth.box(ax - 6, 90, 12, 7, "#ebe6ec", INK);
    booth.rect(ax - 4, 92, 8, 3, MAUVE_DARK);
  }
  booth.plant(282, 108, "md");

  // Warm Canned Drink / Candy Vending Machine (spot: 83.5%, 56.5% -> 320, 144)
  booth.box(310, 60, 48, 76, WALL_CREAM, INK);
  booth.box(314, 65, 28, 34, WOOD_DARK, INK);
  booth.box(319, 76, 18, 16, BUTTER_HI, WOOD_WARM); // Warm coffee cup graphic
  booth.rect(344, 68, 10, 28, MAUVE_DARK);
  booth.box(316, 106, 26, 14, "#3b2d31", INK);

  // Bottom Sliding Glass Exit Door (door at 60.5%, 66.5% -> 232, 170)
  booth.box(164, 184, 124, 68, WOOD_MID, INK);
  booth.box(172, 190, 42, 58, WALL_CREAM, WOOD_DARK);
  booth.box(238, 190, 42, 58, WALL_CREAM, WOOD_DARK);
  booth.box(214, 190, 24, 58, WOOD_DARK, INK);
}
booth.saveUpscaled("pcbang-smoking-booth.png", 4);

// ============================================================================
// 4. 2F OUTDOOR VERANDA TERRACE SMOKING AREA (384x256 -> 1536x1024)
// Matches relaxZones.terrace bounds [18..83.5, 54..73.5] & spots
// ============================================================================
const terrace = new PixelCanvas(384, 256);
{
  // Open Sky & Pixel Neighborhood Rooftops
  terrace.rect(0, 0, 384, 134, SKY_BLUE);
  terrace.rect(0, 68, 384, 66, "#bee0ed");
  terrace.circle(90, 48, 14, WALL_CREAM);
  terrace.circle(102, 52, 10, WALL_CREAM);
  terrace.circle(270, 44, 12, WALL_CREAM);
  // Distant cozy cottages & trees
  terrace.circle(72, 118, 22, OLIVE);
  terrace.circle(316, 112, 24, SAGE);
  for (const [hx, hw, roof] of [[104, 40, BERRY], [154, 46, WOOD_WARM], [208, 36, BUTTER], [250, 44, WOOD_MID]]) {
    terrace.box(hx, 94, hw, 38, WALL_PEACH, INK);
    terrace.box(hx - 4, 84, hw + 8, 12, roof, INK);
    terrace.box(hx + 2, 78, hw - 4, 7, roof, INK);
    terrace.box(hx + 8, 102, 8, 9, "#a8c7d4", INK);
    terrace.box(hx + 22, 102, 8, 9, "#a8c7d4", INK);
  }

  // Striped Cafe Awning & Glowing String Bulbs
  for (let ax = 0; ax < 384; ax += 16) {
    const col = ((ax / 16) & 1) === 0 ? WOOD_WARM : WALL_CREAM;
    terrace.rect(ax, 0, 16, 26, col);
    terrace.circle(ax + 8, 26, 6, col);
  }
  terrace.rect(0, 26, 384, 1, INK);
  for (const [bx, by] of [[38, 32], [78, 36], [122, 34], [168, 30], [218, 32], [268, 36], [316, 32], [356, 28]]) {
    terrace.lampGlow(bx, by, 9);
    terrace.circle(bx, by, 3, BUTTER);
    terrace.px(bx, by, BUTTER_HI);
  }

  // Left brick & wood wall
  terrace.box(0, 26, 62, 132, WOOD_MID, INK);
  // Wooden Deck Floor
  terrace.woodFloor(0, 142, 384, 114);
  // Wooden Balustrade Railing
  terrace.box(62, 102, 322, 6, WOOD_WARM, INK);
  terrace.box(62, 134, 322, 5, WOOD_DARK, INK);
  for (let rx = 74; rx < 378; rx += 14) terrace.box(rx, 108, 4, 26, WOOD_MID, INK);

  // Free Milk Coffee Vending Machine (spot: coffee-machine at 21%, 67.5% -> 80, 172)
  terrace.box(28, 66, 50, 96, WALL_CREAM, INK);
  terrace.box(34, 72, 38, 14, "#fbe3d3", INK);
  terrace.drawKoreanSign(36, 73, 34, 12, "테라스");
  terrace.box(34, 92, 24, 38, "#d4e6eb", INK);
  for (let cy = 96; cy < 126; cy += 10) {
    terrace.box(37, cy, 6, 7, WOOD_WARM, INK);
    terrace.box(47, cy, 6, 7, WALL_CREAM, INK);
  }
  terrace.box(34, 136, 32, 14, "#3b2d31", INK);

  // Ashtray + Stools + Potted Flowers
  terrace.box(264, 138, 10, 4, "#d2ccd4", INK);
  terrace.rect(268, 120, 2, 18, "#8c828a");
  terrace.box(263, 114, 12, 7, "#ebe6ec", INK);
  terrace.box(22, 174, 18, 14, WOOD_WARM, INK);
  terrace.box(334, 148, 18, 14, WOOD_WARM, INK);
  terrace.plant(306, 132, "md");
  terrace.plant(18, 224, "md");
  terrace.plant(358, 224, "md");

  // Bottom Exit Glass Double Doors (door at 49.2%, 72.5% -> 189, 185)
  terrace.box(134, 198, 110, 56, WOOD_MID, INK);
  terrace.box(144, 206, 42, 46, "#dfd0d3cc", WOOD_DARK);
  terrace.box(192, 206, 42, 46, "#dfd0d3cc", WOOD_DARK);
  terrace.rect(180, 224, 2, 10, BUTTER);
  terrace.rect(196, 224, 2, 10, BUTTER);
}
terrace.saveUpscaled("pcbang-night-terrace.png", 4);

// ============================================================================
// 5. COZY STARDEW-STYLE DESKTOP WALLPAPER (418x235 -> 1672x940)
// ============================================================================
const wall = new PixelCanvas(418, 235);
{
  wall.rect(0, 0, 418, 70, "#b8dced");
  wall.rect(0, 70, 418, 60, "#f5dec9");
  wall.rect(0, 130, 418, 105, "#8db07c");
  // Rolling cozy sage-olive hills
  for (let x = 0; x < 418; x++) {
    const h1 = 124 + Math.round(Math.sin(x * 0.018) * 14);
    const h2 = 148 + Math.round(Math.cos(x * 0.022 + 1.2) * 10);
    wall.rect(x, h1, 1, 235 - h1, "#7ca36c");
    wall.rect(x, h2, 1, 235 - h2, "#97b87d");
  }
  // Fluffy pixel clouds
  for (const [cx, cy] of [[86, 44], [218, 34], [344, 48]]) {
    wall.circle(cx, cy, 12, WALL_CREAM);
    wall.circle(cx - 12, cy + 4, 8, WALL_CREAM);
    wall.circle(cx + 12, cy + 4, 9, WALL_CREAM);
  }
  // Cozy hilltop cafe cottages with pitched roofs & flowers
  for (const [hx, hy, roof] of [[52, 118, BERRY], [266, 114, WOOD_MID], [326, 108, WOOD_WARM]]) {
    wall.box(hx, hy + 14, 36, 22, WALL_CREAM, INK);
    wall.box(hx - 4, hy + 6, 44, 9, roof, INK);
    wall.box(hx + 4, hy, 28, 7, roof, INK);
    wall.box(hx + 8, hy + 20, 8, 8, SKY_BLUE, INK);
    wall.box(hx + 20, hy + 20, 8, 16, WOOD_DARK, INK);
  }
  for (const [fx, fy, col] of [[118, 164, BERRY], [190, 174, BUTTER], [242, 162, WALL_CREAM], [360, 178, BERRY]]) {
    wall.px(fx, fy, col); wall.px(fx + 1, fy, BUTTER_HI); wall.px(fx, fy + 1, OLIVE);
  }
  // Foreground balcony railing
  wall.woodFloor(0, 206, 418, 29);
  wall.box(0, 186, 210, 6, WOOD_WARM, INK);
  for (let rx = 12; rx < 204; rx += 18) wall.box(rx, 192, 4, 18, WOOD_MID, INK);
  wall.plant(24, 196, "sm");
  wall.plant(158, 196, "sm");
}
wall.saveUpscaled("pc-wallpaper-cozy.png", 4);

console.log("Compiled all 5 pure 1px-grid Kairosoft/Stardew pixel-art worlds cleanly!");
