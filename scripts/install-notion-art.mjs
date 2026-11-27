import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [downtown, fx, foods] = process.argv.slice(2);
if (!downtown || !fx || !foods) {
  console.error("Usage: node scripts/install-notion-art.mjs <DowntownEats_FREE> <Weather FX folder> <food Icons folder>");
  process.exit(1);
}

const usedFoods = [
  "soda_coke.png", "soda_pepsi.png", "soda_fanta.png", "soda_sprite.png",
  "cake_strawberry.png", "cake_matcha.png", "cake_cheese.png", "cake_chocolate.png",
  "pastry_bread.png", "pastry_croissant.png", "pastry_brioche.png", "pastry_pretzel.png",
  "onigiri_1.png", "onigiri_3.png", "onigiri_5.png",
  "boba_taro.png", "boba_matcha.png", "boba_strawberry.png",
  "coffee_foam.png", "fruit_strawberry.png", "jam_peach.png",
];
if (!existsSync(resolve(foods, "soda_coke.png"))) throw new Error("Pass the food pack's Icons folder.");

const publicAssets = fileURLToPath(new URL("../public/assets/", import.meta.url));
const fileGroups = [
  ["downtown", downtown, [
    "catalog.json", "sprites/objects.png", "sprites/seat_fronts.png",
    "tiles/floors.png", "tiles/wallface.png", "tiles/wallcap.png",
    "anim/window_N.png", "anim/door_N.png", "anim/steam.png", "anim/stove_on_S.png", "anim/neon_open.png",
  ]],
  ["fx", fx, ["overlays/rain_light_strip.png", "overlays/rain_heavy_strip.png", "overlays/snow_strip.png", "overlays/leaves_strip.png"]],
  ["foods", foods, usedFoods],
];

for (const [destination, source, files] of fileGroups) {
  for (const file of files) {
    const target = join(publicAssets, destination, file);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(resolve(source, file), target);
  }
}
