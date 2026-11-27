import { mkdir, writeFile } from "node:fs/promises";
import { crc32, deflateSync } from "node:zlib";

const colors = {
  i: "5c4742", d: "6b5b7b", s: "9785aa", v: "c8b6e2", l: "e6d9f0",
  w: "f7efe5", c: "e9d3b8", t: "ba8d70", n: "936c56", b: "784d48",
  y: "f5cd89", o: "d89960", a: "eab293", r: "c67c77", p: "f4c2d7",
  m: "a9cbb9", g: "739b86", e: "cce3d5", u: "9cb8c9",
};
const ink = Object.fromEntries(Object.entries(colors).map(([symbol, hex]) => [symbol, Buffer.from(hex + "ff", "hex")]));

function image(width, height) {
  return { width, height, pixels: Buffer.alloc(width * height * 4) };
}

function stamp(target, x, y, drawing, substitutions = {}) {
  const rows = drawing.trim().split(/\s+/);
  rows.forEach((row, dy) => [...row].forEach((symbol, dx) => {
    if (symbol === ".") return;
    const color = ink[substitutions[symbol] ?? symbol];
    if (!color || x + dx < 0 || x + dx >= target.width || y + dy < 0 || y + dy >= target.height) {
      throw new Error(`Invalid pixel "${symbol}" at ${x + dx},${y + dy}`);
    }
    color.copy(target.pixels, ((y + dy) * target.width + x + dx) * 4);
  }));
}

function chunk(kind, data) {
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length);
  result.write(kind, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(result.subarray(4, -4)), result.length - 4);
  return result;
}

function png({ width, height, pixels }) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const line = width * 4;
  const scanlines = Buffer.alloc((line + 1) * height);
  for (let y = 0; y < height; y++) pixels.copy(scanlines, y * (line + 1) + 1, y * line, (y + 1) * line);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header),
    chunk("IDAT", deflateSync(scanlines)), chunk("IEND", Buffer.alloc(0)),
  ]);
}

const hardware = image(112, 32);
const frontMonitor = `
.iiiiiiiiiiiiiiiii.
ilvvvvvvvvvvvvvvvsi
ilwvvvvvvvvvvvvvvsi
iliiiiiiiiiiiiiivsi
iliuuuuuuuuuuuivvsi
iliuuuuuuuuuuuivvsi
ilituuuuuuuuuuivvsi
ilituuuuuuuuuuivvsi
ilitttuuuuuuuuivvsi
iliiiiiiiiiiiiivvsi
ilvvvvvvvvvvevsvvsi
.iiiiiiiiiiiiiiiii.
......isssssi......
....iivvvvvvvii....
....iiiiiiiiiii....
`;
const mainTower = `
.iiiiii.
ilvvvvsi
ilvvvssi
ilidisii
ilidmsii
ilidisii
ilidmsii
ilidisii
ilvvvvsi
ilwevssi
ilvvvssi
ilvssssi
.iiiiii.
`;
const keyboard = `
.iiiiiiiiiiiiiii.
ilwlwlwlwlwlwlwli
ivvvvvvvvvvvvvvsi
ilwlwlwwwwlwlwlsi
.iiiiiiiiiiiiiii.
`;
const mouse = `
.ii.
iwli
iivi
ilvi
.ii.
`;
stamp(hardware, 1, 3, frontMonitor);
stamp(hardware, 23, 7, mainTower);
stamp(hardware, 2, 21, keyboard);
stamp(hardware, 21, 21, mouse, { l: "p", v: "r" });

// The side view fits a single 16px desk tile. The rendered left view mirrors this face.
stamp(hardware, 32, 1, `
.........iiiii..
........ilvvvsi.
........ilvvsii.
........ilmsiii.
........ilvsiii.
....iiiiilmsiii.
..iivlvvlvvvvsi.
.iviiiiiiivsii..
.iiuuuuuuivi....
.iiuuuuuuivi....
.iiuuuuuuivi....
.iiuuuuuuivi....
.iiuuuuuuivi....
.iiuuuuuuivi....
.iiuuuuuuivi....
.iiiiiiiiivi....
.ivlvvlvvvii....
..iiiiiiiii.....
.....issi.......
....ivvvvi......
....iiiiii......
`);
stamp(hardware, 32, 23, `
......iii.
...iiiwvsi
iiiwwlwvsi
iwlwlwvsi.
ivvvlvsi..
.iiiiii...
`);
stamp(hardware, 43, 24, mouse, { l: "p", v: "r" });

stamp(hardware, 48, 2, `
....iiiiiiii....
...ilvvvvvssi...
..ilwlvvvvssdi..
..iviiiiiiisdi..
..iviummmiisdi..
..iviueemiisdi..
..iviummmiisdi..
..iviugmmiisdi..
..iviiiiiiisdi..
..ivvvvvesisdi..
...iiiiiiiiidi..
....ivvvsssdi...
....ivwvsssdi...
....ivwvsssdi...
....ivlvsssdi...
....ivvvsssdi...
....ivpvsisdi...
....ivvvsssdi...
....ivvvsssdi...
....ivlvsssdi...
....ivvvsssdi...
....ivvvsssdi...
...ilvvvvvvvsi..
...iiiiiiiiiii..
`);
stamp(hardware, 64, 1, `
...iiiiiiiiii...
..ilvvvvvvvssi..
.ilwvvvvvvvssdi.
.ivvvvvvvvssdii.
.iviwwwwiiisdii.
.ivilplliuisdii.
.ivirvrwiuisdii.
.iviwwwwiiisdii.
.ivilmlpiuisdii.
.iviggrriuisdii.
.iviwwwwiiisdii.
.ivilylpiuisdii.
.ivirrvoiuisdii.
.iviiiiiiiisdii.
.ivvvvvvemssdii.
.ivvllvvesisdii.
.ivvllllvsisdii.
.ivvvvvvvsisdii.
.iviiiiivsssdii.
.ivissdiisssdii.
.ivissdiisssdii.
.iviiiiivsssdii.
.ivvvvvvvsssdii.
.ivlvvvvvsssdii.
.ivvvvvvvsssdii.
.iiiiiiiiiiiiii.
..ii.......ii...
`);

stamp(hardware, 82, 2, keyboard);
stamp(hardware, 101, 2, mouse);
stamp(hardware, 83, 10, `
.iiiiiiiiiiiiiiiii.
ilvvvvvvvvvvvvvvvsi
ilwwlllllllllllvvsi
ilvvvvvvvvvvvvvvvsi
ilvvssssssssvsvvvsi
ilvvvvvvvvvvvsvvvsi
ilvvssssssssvsvvvsi
ilvvvvvvvvvvvsvvvsi
ilvvvvvvmmvvvsvvvsi
ilvvvvvvvvvvvssvvsi
.iiiiiiiiiiiiiiiii.
.......issi........
....iivvvvsvii.....
....iiiiiiiiii.....
`);
stamp(hardware, 103, 9, mainTower);

const partitions = image(64, 16);
const glass = `
iiiiiiiiiiiiiiii
ivvvvvvvvvvvvvvi
iluuuuuuuuuuuuli
ileeeuuuuwwwuuli
ilueeeuuwwuuuuli
iluueeuwuuuuuuli
iluuuuuuuuuuuuli
iluuuuuuuuuuuuli
iluuuuuuuuuuuuli
ivvvvvvvvvvvvvvi
issssssssssssssi
iiiiiiiiiiiiiiii
................................
`;
const upright = `
.....iiiii......
.....ilvsi......
.....iuusi......
.....iwusi......
.....iuusi......
.....iuusi......
.....iwusi......
.....iuusi......
.....iuusi......
.....iuusi......
.....iuusi......
.....iuusi......
.....ivssi......
.....isssi......
.....iiiii......
`;
stamp(partitions, 0, 0, glass);
stamp(partitions, 16, 0, upright);
stamp(partitions, 32, 0, glass, { u: "c", e: "y", l: "c", w: "w", v: "t", s: "n" });
stamp(partitions, 48, 0, upright, { u: "c", l: "t", v: "t", s: "n" });

function fill(target, x, y, width, height, symbol) {
  stamp(target, x, y, Array.from({ length: height }, () => symbol.repeat(width)).join(" "));
}
const skyline = image(256, 64);
for (const [index, dusk] of [false, true].entries()) {
  const x0 = index * 128;
  fill(skyline, x0, 0, 128, 64, dusk ? "d" : "v");
  fill(skyline, x0, 26, 128, 38, dusk ? "s" : "l");
  fill(skyline, x0, 38, 128, 26, dusk ? "v" : "p");
  stamp(skyline, x0 + 49, 10, `
....yyyy....
..yyyyyyyy..
.yyyyyyyyyy.
yyyyyyyyyyyy
yyyyyyyyyyyy
.yyyyyyyyyy.
..yyyyyyyy..
....yyyy....
`, dusk ? { y: "l" } : {});
  for (const [x, top, w, tone] of [[0, 42, 14, "s"], [12, 51, 15, "d"], [25, 33, 18, "d"], [41, 47, 10, "s"], [51, 54, 14, "d"], [63, 40, 16, "s"], [77, 31, 20, "d"], [96, 49, 15, "s"], [110, 37, 18, "d"]]) {
    fill(skyline, x0 + x, top, w, 64 - top, tone);
    for (let y = top + 4; y < 62; y += 6) {
      for (let column = 3; column < w - 3; column += 4) {
        fill(skyline, x0 + x + column, y, 2, 2, dusk && (x + y + column) % 3 ? "y" : "v");
      }
    }
  }
}

const bowl = `
...iiiiiiiiii...
.iiddddddddddii.
ilvvvvvvvvvvvlsi
ilvvvvvvvvvvvlsi
.ivvvvvvvvvvvsi.
.ivvvvvvvvvvssi.
..ivvvvvvvsssi..
...iiiiiiiiii...
`;
const plate = `
...iiiiiiiiii...
.iillllllllvvii.
ilwwwwwwwwwwvlsi
ilwwwwwwwwwwvlsi
.ivllllllllvvsi.
..iiiiiiiiiiii..
`;
const noodles = `
..tttttt..
.tyyonyyt.
tyonnoyyot
tonyoynoyt
.tyoyoytt.
..tttttt..
`;
const sunnyEgg = `
..ww..
.wyyw.
wyoycw
.wccw.
..ww..
`;
const riceMound = `
..cccccc..
.cwwwwwwc.
cwcwwcwwwc
cwwcwwcwwc
.cccccccc.
`;
const cup = `
...iiiiii....
..iwwwwwwi...
.iwuuuuuuei..
.iwuuuuuwei..
.iwuuuuuuui..
..iwuuuuui...
..iwuuuuei...
..iwuuuuei...
..iwuuuuei...
...iiiiii....
`;
const recipes = {
  jjagyechi: [[0, 7, bowl], [3, 5, noodles, { t: "b", n: "i", o: "n", y: "t" }], [6, 4, sunnyEgg], [3, 7, "yy"]],
  rabokki: [[0, 7, bowl, { v: "p", s: "r" }], [3, 5, noodles, { t: "r", n: "r" }], [4, 6, "cy yy yy"], [9, 7, "yyy .yy"], [5, 9, "m"]],
  spammayo: [[0, 8, bowl, { v: "m", s: "g" }], [3, 6, riceMound], [4, 5, "rr.b rrbb .bb."], [9, 7, "rr r."], [7, 6, "w. .w w."], [6, 9, "g.g"]],
  chickenmayo: [[0, 8, bowl, { v: "c", s: "t" }], [3, 6, riceMound], [4, 5, ".o..y. oyoyoo oy.oya .yoy.o"], [8, 8, "www .w."], [6, 9, "g.m"]],
  ramyeon: [[0, 7, bowl, { v: "y", s: "o", l: "w" }], [3, 5, noodles, { t: "r", n: "n" }], [5, 5, "gg.m .mgg g..g"], [0, 9, "ii i."], [14, 9, "ii .i"]],
  rice: [[0, 9, plate], [3, 6, riceMound, { c: "r", w: "o" }], [8, 5, sunnyEgg], [4, 8, "g..g .g.."]],
  dumplings: [[0, 9, plate], [2, 5, ".iii. icyyi iyyni .iii."], [8, 5, ".iii. iccyi ioryi .iii."], [5, 8, ".iii. ilcyi iyyni .iii."]],
  curry: [[0, 9, plate], [2, 7, riceMound], [6, 6, ".nnnnn. nobonon noboobn .nnnnn."], [8, 5, "riir rprr .rr."], [5, 9, "g"]],
  skewer: [[2, 1, `
.........oii
........ioai
.......ioai.
......iyci..
.....iyci...
....irai....
...irri.....
..iyyi......
.iyyi.......
.iii........
..ti........
.ti.........
ti..........
i...........
`]],
  hotdog: [[2, 1, `
.......iii
......iyoyi
.....iycyai
....iyoyai.
...iycayi..
..iycyai...
.iyoyai....
.iycai.....
..iii......
..ti.......
.ti........
ti.........
i..........
`]],
  tornado: [[4, 1, `
......ti
....iyyi
...iyocy
..iyoyi.
.iyocyi.
iyoyi...
.iycyi..
..iyoyi.
.iyoyi..
iyoyi...
.iii....
.ti.....
ti......
i.......
`]],
  cheeseball: [[0, 9, plate], [2, 4, ".ii. iyoi iyo i"], [10, 4, ".ii. iyoi iyo i"], [4, 8, ".ii. iyoi iyo i"], [8, 8, ".ii. iyoi iyo i"]],
  menbosha: [[0, 9, plate], [2, 5, ".iiiii. iyyyyyi iyacayi inrrtni .iiiii."], [7, 7, ".iiiii. iyyyyyi iyacayi inrrtni .iiiii."]],
  fries: [[3, 2, `
.iy..yi..
.iyiiyiyi
.iyyiiyi.
.iyyiyiyi
iriririri
irpprrrri
irrryrrri
.irrrrri.
.irrrrri.
..iiiii..
`]],
  toast: [[2, 3, `
..iiiiiiii..
.iyyyyyyyyi.
iyccwwccccyi
iycwccccwcyi
iycccyccccyi
itttttttttti
igmgmgpgmggi
irrrrrrrrrri
iyyyyyyyyyyi
.iiiiiiiiii.
`]],
  bungeoppang: [[1, 4, `
..iiiiii.....i
.iyyyyyoi...ii
iycyoyyoyi.iyi
iyicyocyoyiyoi
iyyyoyyoyyyoyi
.iyoyoyyoyiyoi
..ioooooti.iyi
...iiiiii...ii
.............i
`]],
  eolbaksa: [[0, 2, ".iii. ilwli ilvsi ivvsi ivvsi .iii."], [4, 4, cup, { u: "u", e: "w" }], [8, 7, "ww .w w."], [10, 8, "e .w"]],
  ashatchu: [[2, 4, cup, { u: "o", e: "t" }], [6, 2, "iii ia. i.."], [7, 6, "wn .n. bb"]],
  tea: [[1, 4, cup, { u: "a", e: "o" }], [10, 3, ".ii. iaai iyai .ii."], [6, 8, "w.w"], [9, 2, "g"]],
  misutgaru: [[2, 4, cup, { u: "c", e: "t" }], [6, 2, "ii. it. i.."], [7, 10, ".n. n.n"]],
  beads: [[0, 8, plate], [3, 5, "pp..mm ppr.mm .ryy.r tr.yy."], [8, 4, "lv vl ..pp m.pp"], [5, 9, "vv.r mm.."]],
  coffee: [[2, 4, cup, { u: "n", e: "b" }], [6, 2, "ii. i.. i.."], [6, 7, "wc.c .c.w"]],
  "corner-ade": [[2, 4, cup, { u: "a", e: "p" }], [6, 2, "iii ip. i.."], [10, 4, ".gg iaai ipai .ii."], [7, 7, "w.w .e."]],
};

const root = new URL("../public/assets/original/", import.meta.url);
await mkdir(new URL("food/", root), { recursive: true });
await writeFile(new URL("workstations.png", root), png(hardware));
await writeFile(new URL("partitions.png", root), png(partitions));
await writeFile(new URL("skyline.png", root), png(skyline));
for (const [id, layers] of Object.entries(recipes)) {
  const icon = image(16, 16);
  for (const layer of layers) stamp(icon, ...layer);
  await writeFile(new URL("food/" + id + ".png", root), png(icon));
}
