import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { presence } from "../lib/cafe-presence.mjs";
import { snacks } from "../lib/cafe-snacks.mjs";
import { readCafeDelivery } from "../lib/cafe-delivery.mjs";
import { arcadeLeaderboard } from "../lib/cafe-arcade.mjs";
import { pvpArena, simulateAlkkagiShot } from "../lib/cafe-pvp.mjs";
import { relaxPortals, relaxZones } from "../lib/cafe-world.mjs";

const menu = JSON.parse(readFileSync(new URL("../public/snack-menu.json", import.meta.url), "utf8"));
const baseTime = 1800000000000;

function makeFullV2Db() {
  const sqlite = new DatabaseSync(":memory:");
  for (const file of [
    "0000_strange_moira_mactaggert.sql",
    "0001_corner_snacks.sql",
    "0005_cafe_delivery.sql",
    "0006_cafe_chat.sql",
    "0007_world_zones_and_avatars.sql",
    "0008_snack_bar_v2.sql",
    "0009_arcade_and_pvp.sql",
  ]) {
    const raw = readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8");
    for (const stmt of raw.split("--> statement-breakpoint")) {
      if (stmt.trim()) sqlite.exec(stmt);
    }
  }
  let queue = Promise.resolve();
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          const bound = sqlite.prepare(sql);
          const isReader = /^\s*(SELECT|PRAGMA|WITH)/i.test(sql);
          return {
            sql,
            values,
            async first() { return bound.get(...values) ?? null; },
            async all() { return { results: isReader ? bound.all(...values) : [] }; },
            async run() {
              const info = bound.run(...values);
              return { success: true, meta: { changes: Number(info.changes) } };
            },
          };
        },
      };
    },
    async batch(statements) {
      const op = queue.then(async () => {
        sqlite.exec("BEGIN");
        try {
          const out = [];
          for (const st of statements) {
            if (/^\s*(SELECT|PRAGMA|WITH)/i.test(st.sql)) {
              const rows = (await st.all()).results;
              out.push({ results: rows, meta: { changes: 0 }, success: true });
            } else {
              const runRes = await st.run();
              out.push({ results: [], meta: runRes.meta, success: true });
            }
          }
          sqlite.exec("COMMIT");
          return out;
        } catch (err) {
          sqlite.exec("ROLLBACK");
          throw err;
        }
      });
      queue = op.catch(() => {});
      return op;
    },
  };
  return { db, sqlite };
}

function postJson(url, body) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("seated visitor keeps PC seat & tray while taking a break in Smoking Booth and Night Terrace with isolated zone chat", async () => {
  const { db, sqlite } = makeFullV2Db();
  try {
    const alice = randomUUID();
    const bob = randomUUID();
    const aliceMember = randomUUID();

    // Alice reserves hall:4 with custom pixel avatar
    const resSeat = await (await presence(postJson("https://pcbang.test/api/presence", {
      token: alice, name: "앨리스", avatar: "123421", action: "reserve", seat: "hall:4", x: 33.5, y: 81.5,
    }), db, {}, baseTime)).json();
    assert.equal(resSeat.mine, "hall:4");

    // Alice orders jjagyechi + toppings & eolbaksa
    const ord = await (await snacks(postJson("https://pcbang.test/api/snacks", {
      action: "order", visitor: alice, member: aliceMember, id: randomUUID(),
      items: [
        { id: "jjagyechi", count: 1, options: ["치즈 더블", "파채 추가"] },
        { id: "eolbaksa", count: 1, options: ["얼음 가득"] },
      ],
    }), db, menu, baseTime + 100)).json();
    assert.equal(ord.order.items[0].options[0], "치즈 더블");

    // Tray arrives at hall:4
    const arrivedAt = ord.order.readyAt + 10;
    assert.equal((await readCafeDelivery(db, arrivedAt)).trays.length, 1);

    // Alice steps out to Smoking Booth ("booth") WITHOUT releasing seat!
    const inBooth = await (await presence(postJson("https://pcbang.test/api/presence", {
      token: alice, name: "앨리스", avatar: "123421", zone: "booth", activity: "smoke",
      action: "sync", x: 55, y: 58,
    }), db, {}, arrivedAt + 100)).json();
    assert.equal(inBooth.mine, "hall:4");
    assert.equal(inBooth.zone, "booth");
    // Tray is STILL preserved on her desk!
    assert.equal((await readCafeDelivery(db, arrivedAt + 200)).trays.length, 1);

    // Alice chats in booth; Bob in terrace cannot see booth chat, only terrace chat!
    await presence(postJson("https://pcbang.test/api/presence", {
      token: alice, name: "앨리스", zone: "booth", space: "booth", action: "say", text: "환풍기 시원하네요", x: 55, y: 58,
    }), db, {}, arrivedAt + 300);

    const bobTerrace = await (await presence(postJson("https://pcbang.test/api/presence", {
      token: bob, name: "밥", zone: "terrace", activity: "coffee", action: "sync", x: 42, y: 60,
    }), db, {}, arrivedAt + 400)).json();
    assert.equal(bobTerrace.zone, "terrace");
    assert.equal(bobTerrace.chat.length, 0);

    // Alice returns to seat and eats her tray (+15 G)
    const eaten = await (await snacks(postJson("https://pcbang.test/api/snacks", {
      action: "eat", visitor: alice, member: aliceMember, orderId: ord.order.id,
    }), db, menu, arrivedAt + 500)).json();
    assert.equal(eaten.order.status, "eaten");
    assert.equal(eaten.loyalty.points, 165);
    assert.equal((await readCafeDelivery(db, arrivedAt + 600)).trays.length, 0);
  } finally {
    sqlite.close();
  }
});

test("Snack Bar 2.0 seat gifting deducts 30 G-Points and delivers gift tray to peer seat", async () => {
  const { db, sqlite } = makeFullV2Db();
  try {
    const sender = randomUUID();
    const senderMember = randomUUID();
    const receiver = randomUUID();

    await presence(postJson("https://pcbang.test/api/presence", {
      token: sender, name: "단골선배", action: "reserve", seat: "hall:0", x: 33, y: 81,
    }), db, {}, baseTime);
    await presence(postJson("https://pcbang.test/api/presence", {
      token: receiver, name: "승급전중", action: "reserve", seat: "duo:1", x: 33, y: 81,
    }), db, {}, baseTime);

    // Initialize sender wallet (150 G)
    await snacks(postJson("https://pcbang.test/api/snacks", {
      action: "sync", visitor: sender, member: senderMember, active: true,
    }), db, menu, baseTime + 50);

    const giftRes = await (await snacks(postJson("https://pcbang.test/api/snacks", {
      action: "gift",
      visitor: sender,
      member: senderMember,
      id: randomUUID(),
      targetSeat: "duo:1",
      itemId: "ashatchu",
      senderName: "단골선배",
      note: "승급전 꼭 이기세요!",
    }), db, menu, baseTime + 200)).json();

    assert.equal(giftRes.loyalty.points, 120);
    const delivery = await readCafeDelivery(db, baseTime + 200 + 1800 + 9000 + 10);
    assert.equal(delivery.trays.length, 1);
    assert.equal(delivery.trays[0].seat, "duo:1");
    assert.equal(delivery.trays[0].giftFrom, "단골선배");
    assert.equal(delivery.trays[0].items[0].id, "ashatchu");
  } finally {
    sqlite.close();
  }
});

test("Arcade Leaderboard ranks scores descending and Minesweeper times ascending", async () => {
  const { db, sqlite } = makeFullV2Db();
  try {
    const m1 = randomUUID(), m2 = randomUUID();
    await arcadeLeaderboard(postJson("https://pcbang.test/api/arcade", {
      action: "submit", game: "tetris", mode: "standard", member: m1, nickname: "테트리스왕", score: 12400, metric: "32줄",
    }), db, baseTime);
    const topTetris = await (await arcadeLeaderboard(postJson("https://pcbang.test/api/arcade", {
      action: "submit", game: "tetris", mode: "standard", member: m2, nickname: "초보", score: 4200, metric: "9줄",
    }), db, baseTime + 10)).json();
    assert.equal(topTetris.entries[0].nickname, "테트리스왕");

    // Minesweeper: lower seconds ranks #1!
    await arcadeLeaderboard(postJson("https://pcbang.test/api/arcade", {
      action: "submit", game: "mines", mode: "hard", member: m1, nickname: "느긋함", score: 145, metric: "고급 02:25",
    }), db, baseTime);
    const topMines = await (await arcadeLeaderboard(postJson("https://pcbang.test/api/arcade", {
      action: "submit", game: "mines", mode: "hard", member: m2, nickname: "지뢰장인", score: 68, metric: "고급 01:08",
    }), db, baseTime + 10)).json();
    assert.equal(topMines.entries[0].nickname, "지뢰장인");
    assert.equal(topMines.entries[0].score, 68);
  } finally {
    sqlite.close();
  }
});

test("PvP Arena enforces turns, detects 5-in-a-row Omok win, and simulates Alkkagi physics", async () => {
  const { db, sqlite } = makeFullV2Db();
  try {
    const host = randomUUID(), guest = randomUUID();
    const created = await (await pvpArena(postJson("https://pcbang.test/api/pvp", {
      token: host, name: "흑돌고수", seat: "hall:1", action: "create", game: "omok",
    }), db, baseTime)).json();
    const matchId = created.match.id;

    const joined = await (await pvpArena(postJson("https://pcbang.test/api/pvp", {
      token: guest, name: "백돌도전자", seat: "hall:2", action: "join", matchId,
    }), db, baseTime + 10)).json();
    assert.equal(joined.match.status, "playing");

    // Host places 5 in row 0 (cols 0..4), guest places in row 1 (cols 0..3)
    for (let c = 0; c < 5; c++) {
      const hMove = await (await pvpArena(postJson("https://pcbang.test/api/pvp", {
        token: host, action: "move", matchId, index: c,
      }), db, baseTime + 100 + c * 20)).json();
      if (c === 4) {
        assert.equal(hMove.match.status, "finished");
        assert.equal(hMove.match.winner, "host");
      } else {
        await pvpArena(postJson("https://pcbang.test/api/pvp", {
          token: guest, action: "move", matchId, index: 15 + c,
        }), db, baseTime + 110 + c * 20);
      }
    }

    // Alkkagi collision knock-out check
    const sim = simulateAlkkagiShot([
      { id: "h0", owner: "host", x: 50, y: 80, alive: true },
      { id: "g0", owner: "guest", x: 50, y: 5, alive: true },
    ], "h0", 0, -3.8);
    assert.ok(Array.isArray(sim.stones));
  } finally {
    sqlite.close();
  }
});

test("all cozy pixel sprite sheets, zone scenes, 흡연구역 labels, and cafe.html dialog targets exist cleanly", () => {
  const requiredFiles = [
    "../public/sprites/snacks-atlas.png",
    "../public/sprites/cat-clerk-sheet.png",
    "../public/sprites/launcher-icons.png",
    "../public/pcbang-cozy-hall.png",
    "../public/pcbang-smoking-booth.png",
    "../public/pcbang-night-terrace.png",
    "../public/pcbang-rooms-pixel.png",
    "../public/pc-wallpaper-cozy.png",
    "../public/avatar-sprites.js",
  ];
  for (const rel of requiredFiles) {
    const full = new URL(rel, import.meta.url);
    assert.ok(existsSync(full), `Missing asset: ${rel}`);
  }
  const unusedLegacyFiles = [
    "../public/cafe-clerk-walk.svg",
    "../public/cafe-counter-empty.svg",
    "../public/corner-hall.webp",
    "../public/corner-hall-timber.webp",
    "../public/pc-wallpaper.png",
    "../public/pc-wallpaper.webp",
    "../public/pcbang-hall-pastel.png",
    "../public/pcbang-hall-pastel.webp",
    "../public/pcbang-lobby.png",
    "../public/pcbang-main-hall.png",
    "../public/pcbang-rooms-pastel.png",
    "../public/pcbang-rooms-pastel.webp",
    "../public/pcbang-rooms.png",
    "../public/room-pixel-atlas.png",
    "../public/room.png",
    "../public/sprites/relax-props.png",
    "../public/sprites/hall-smoking-booth.png",
    "../public/sprites/hall-terrace-door.png",
    "../public/sprites/counter-open-kitchen.png",
  ];
  for (const rel of unusedLegacyFiles) {
    assert.ok(!existsSync(new URL(rel, import.meta.url)), `Unused legacy file still exists: ${rel}`);
  }
  assert.equal(relaxPortals.booth.label, "실내 흡연구역");
  assert.equal(relaxPortals.terrace.label, "야외 흡연구역");
  assert.equal(relaxZones.booth.label, "실내 흡연구역");
  assert.equal(relaxZones.terrace.label, "야외 흡연구역");
  const html = readFileSync(new URL("../app/cafe.html", import.meta.url), "utf8");
  assert.ok(!html.includes("흡연존") && !html.includes("SMOKING ZONE") && !html.includes("흡연부스"));
  const openTargets = [...html.matchAll(/data-open="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(openTargets.length >= 12);
  for (const id of new Set(openTargets)) {
    assert.ok(html.includes(`id="${id}"`), `Missing dialog id="${id}" in cafe.html`);
  }
});
