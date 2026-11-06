import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { cafeChatSessionId } from "../lib/invite-gate.ts";
import { normalizeCafeChatText } from "../lib/cafe-chat.mjs";
import { presence } from "../lib/cafe-presence.mjs";

const database = new DatabaseSync(":memory:");
let preparedCount = 0;
for (const file of [
  "0000_strange_moira_mactaggert.sql",
  "0001_corner_snacks.sql",
  "0002_invitation_access.sql",
  "0003_invite_form_tokens.sql",
  "0004_invite_code_vault.sql",
  "0005_cafe_delivery.sql",
  "0006_cafe_chat.sql",
]) {
  database.exec(readFileSync(new URL("../drizzle/" + file, import.meta.url), "utf8"));
}

const db = {
  prepare(sql) {
    preparedCount += 1;
    const statement = database.prepare(sql);
    const create = (...values) => ({
      async first() { return statement.get(...values) ?? null; },
      async all() { return { results: statement.all(...values) }; },
      async run() {
        if (sql.trimStart().toUpperCase().startsWith("SELECT")) {
          return { success: true, meta: { changes: 0 }, results: statement.all(...values) };
        }
        const result = statement.run(...values);
        return { success: true, meta: { changes: Number(result.changes) } };
      },
    });
    return {
      ...create(),
      bind: (...values) => create(...values),
    };
  },
  async batch(statements) {
    database.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      database.exec("COMMIT");
      return results;
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  },
};

const origin = "https://pcbang.example.test";
const invitation = "012345-abcdef-012345-abcdef";
const userToken = "u_" + "1234567890abcdef".repeat(4);
const adminToken = "a_" + "abcdef0123456789".repeat(4);
const hashToken = async (token) => {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
};
const inviteHash = await hashToken(invitation);
const sessionId = crypto.randomUUID();
const inviteId = crypto.randomUUID();
const startedAt = Date.now();
database.prepare("INSERT INTO invite_codes (id, code_hash, created_at, expires_at) VALUES (?, ?, ?, ?)")
  .run(inviteId, inviteHash, startedAt, startedAt + 86400_000);
database.prepare("INSERT INTO invite_sessions (id, token_hash, role, invite_id, created_at, expires_at) VALUES (?, ?, 'user', ?, ?, ?)")
  .run(sessionId, await hashToken(userToken), inviteId, startedAt, startedAt + 86400_000);
database.prepare("INSERT INTO invite_sessions (id, token_hash, role, created_at, expires_at) VALUES (?, ?, 'admin', ?, ?)")
  .run(crypto.randomUUID(), await hashToken(adminToken), startedAt, startedAt + 86400_000);

async function resolveSession(cookie) {
  return cafeChatSessionId(new Request(origin + "/api/presence", {
    headers: { Cookie: "cafe_access=" + cookie },
  }), db);
}

function buildPresenceRequest(token, action, details = {}) {
  return new Request(origin + "/api/presence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token, action, name: "단골손님", color: 0, x: 34, y: 82, facing: 1, ...details,
    }),
  });
}

async function post(token, action, now, details = {}, options = {}) {
  const response = await presence(buildPresenceRequest(token, action, details), db, options, now);
  return { response, body: await response.json() };
}

test("chat throttles share a validated invite session across tabs without trusting fake or admin cookies", async () => {
  const first = await resolveSession(userToken);
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(await resolveSession(userToken), first);
  assert.equal(await resolveSession("u_" + "0".repeat(64)), null);
  assert.equal(await resolveSession(adminToken), null);
});

test("chat normalizes safe plain text and rejects links, oversized messages and commonly blocked content", () => {
  assert.deepEqual(normalizeCafeChatText("  안녕하세요\n반가워요! "), {
    text: "안녕하세요 반가워요!",
    filteredText: "안녕하세요반가워요",
  });
  assert.equal(normalizeCafeChatText("  ").error, "chat_invalid");
  assert.equal(normalizeCafeChatText("가".repeat(81)).error, "chat_invalid");
  assert.equal(normalizeCafeChatText("https://example.com").error, "chat_blocked");
  assert.equal(normalizeCafeChatText("ㅅ ㅂ").error, "chat_blocked");
  assert.equal(normalizeCafeChatText("ㅋㅋㅋㅋㅋㅋㅋㅋ").error, "chat_blocked");
  assert.ok(normalizeCafeChatText("아기 새끼 고양이가 매점에 있어요.").text);
});

test("seated and lobby visitors see the same short-lived plain-text chat only within their canonical space", async () => {
  const now = Date.now();
  const firstToken = crypto.randomUUID();
  const peerToken = crypto.randomUUID();
  const soloToken = crypto.randomUUID();
  const first = await post(firstToken, "say", now, {
    space: "hall", text: "안녕하세요, 천천히 둘러보고 있어요.",
  });
  assert.equal(first.response.status, 200);
  assert.equal(first.body.chat.length, 1);
  assert.equal(first.body.chat[0].text, "안녕하세요, 천천히 둘러보고 있어요.");
  const plainText = '<img src=x onerror="alert(1)">';
  const markupText = await post(firstToken, "say", now + 2_101, {
    space: "hall", text: plainText,
  });
  assert.equal(markupText.response.status, 200);
  assert.equal(markupText.body.chat.at(-1).text, plainText);
  assert.equal(first.body.chat[0].sender, first.body.id);
  assert.equal(first.body.chat[0].space, "hall");
  assert.equal(first.body.chat[0].expiresAt, now + 15_000);

  const peer = await post(peerToken, "sync", now + 100);
  assert.equal(peer.body.chat[0].text, first.body.chat[0].text);

  const reserved = await post(soloToken, "reserve", now + 101, { seat: "solo:0" });
  assert.equal(reserved.response.status, 200);
  const privateRoom = await post(soloToken, "sync", now + 102, { space: "solo" });
  assert.equal(privateRoom.body.chat.length, 0);

  const changed = await post(soloToken, "say", now + 4_102, {
    space: "hall", text: "이 메시지는 이전 화면에서 썼어요.",
  });
  assert.equal(changed.response.status, 409);
  assert.equal(changed.body.error, "chat_room_changed");

  const updated = await post(firstToken, "say", now + 2_201, {
    space: "hall", text: "아직 객석을 둘러보고 있어요.",
  });
  assert.equal(updated.response.status, 429);
  const afterExpiry = await post(firstToken, "sync", now + 16_000);
  assert.ok(afterExpiry.body.chat.every((message) => message.expiresAt > now + 16_000));
});

test("invite-session throttles limit across visitor tokens and blocked text is not stored", async () => {
  const now = Date.now();
  const chatActor = await resolveSession(userToken);
  const tokens = Array.from({ length: 8 }, () => crypto.randomUUID());
  const send = async (index, time, text) => post(tokens[index], "say", time, {
    space: "hall", text,
  }, { resolveChatActor: async () => chatActor });

  const first = await send(0, now, "첫 인사입니다.");
  assert.equal(first.response.status, 200);

  const second = await send(1, now + 1_000, "다른 탭에서 전송했어요.");
  assert.equal(second.response.status, 429);
  assert.equal(second.body.error, "chat_cooldown");
  assert.ok(second.body.retryAfterMs > 0);
  assert.equal(second.body.chat.at(-1).text, first.body.chat.at(-1).text);

  for (let index = 0; index < 4; index += 1) {
    const allowed = await send(index + 2, now + (index + 1) * 6_001, "인사 " + index);
    assert.equal(allowed.response.status, 200);
  }
  const burst = await send(6, now + 25_001, "여섯 번째입니다.");
  assert.equal(burst.response.status, 429);
  assert.equal(burst.body.error, "chat_cooldown");

  const abusive = await send(7, now + 35_001, "ㅅㅂ");
  assert.equal(abusive.response.status, 400);
  assert.equal(abusive.body.error, "chat_blocked");
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM cafe_chat_messages WHERE text='ㅅㅂ'").get().count, 0);
  const beforeBlocked = preparedCount;
  const invalid = await send(0, now + 40_000, "가".repeat(81));
  assert.equal(invalid.response.status, 400);
  assert.equal(invalid.body.error, "chat_invalid");
  assert.equal(preparedCount, beforeBlocked, "invalid chat is rejected before any D1 query");
});

test("oversized chat presence requests stop reading at the one-kilobyte boundary", async () => {
  const beforePrepared = preparedCount;
  const response = await presence(new Request(origin + "/api/presence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: crypto.randomUUID(), action: "say", space: "hall",
      text: "가".repeat(2_000),
    }),
  }), db);
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error, "size");
  assert.equal(preparedCount, beforePrepared, "oversized bodies are rejected before any D1 query");
});
