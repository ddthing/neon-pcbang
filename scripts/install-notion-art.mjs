import { copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [downtown, fx, foods] = process.argv.slice(2);
if (!downtown || !fx || !foods) {
  console.error("Usage: node scripts/install-notion-art.mjs <DowntownEats_FREE> <Weather FX folder> <food Icons folder>");
  process.exit(1);
}

const publicAssets = fileURLToPath(new URL("../public/assets/", import.meta.url));
const fileGroups = [
  ["downtown", downtown, [
    "catalog.json", "sprites/objects.png", "sprites/seat_fronts.png",
    "tiles/floors.png", "tiles/wallface.png", "tiles/wallcap.png",
    "anim/window_N.png", "anim/door_N.png", "anim/steam.png", "anim/stove_on_S.png", "anim/neon_open.png",
  ]],
  ["fx", fx, ["overlays/rain_light_strip.png", "overlays/rain_heavy_strip.png", "overlays/snow_strip.png", "overlays/leaves_strip.png"]],
  ["foods", foods, (await readdir(foods)).filter((name) => name.endsWith(".png"))],
];
if (!fileGroups.at(-1)[2].includes("soda_coke.png")) throw new Error("Pass the food pack's Icons folder.");

for (const [destination, source, files] of fileGroups) {
  for (const file of files) {
    const target = join(publicAssets, destination, file);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(resolve(source, file), target);
  }
}
