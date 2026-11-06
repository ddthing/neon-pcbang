import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { gate, renewUserCookie } from "../lib/invite-gate.ts";

const origin = "https://pcbang.example.test";
const password = "local-test-admin-password-do-not-use";
const sqlite = new DatabaseSync(":memory:");
sqlite.exec(readFileSync(new URL("../drizzle/0002_invitation_access.sql", import.meta.url), "utf8"));
const db = {
  prepare(sql) {
    return {
      bind(...values) {
        const statement = sqlite.prepare(sql);
        const apply = () => statement;
        return {
          async first() { return apply().get(...values) ?? null; },
          async all() { return { results: apply().all(...values) }; },
          async run() {
            const info = apply().run(...values);
            return { success: true, meta: { changes: Number(info.changes) } };
          },
        };
      },
    };
  },
};
const env = { DB: db, NEON_ADMIN_PASSWORD: password };
function get(path, accessCookie) {
  return new Request(origin + path, {
    headers: accessCookie ? { Cookie: accessCookie } : {},
  });
}
function post(path, values, accessCookie) {
  return new Request(origin + path, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(accessCookie ? { Cookie: accessCookie } : {}),
    },
    body: new URLSearchParams(values).toString(),
  });
}
function issuedCookie(response) {
  const set = response.headers.get("Set-Cookie");
  assert.ok(set, "Server must issue a session cookie");
  assert.match(set, /HttpOnly/);
  assert.match(set, /SameSite=Strict/);
  return set.split(";")[0];
}

test("beta invitation and public launch work end to end with real SQLite", async () => {
  const anon = await gate(get("/"), env);
  assert.equal(anon.status, 303);
  assert.equal(anon.headers.get("Location"), "/invite");

  const asset = await gate(get("/app.js"), env);
  assert.equal(asset.headers.get("Location"), "/invite");
  const api = await gate(get("/api/presence"), env);
  assert.equal(api.status, 401);

  const invitation = await gate(get("/invite"), env);
  assert.equal(invitation.status, 200);
  assert.match(await invitation.text(), /초대코드/);

  const adminUnauthenticated = await gate(get("/admin"), env);
  assert.equal(adminUnauthenticated.headers.get("Location"), "/admin/login");

  const wrongPassword = await gate(post("/auth/admin-login", { password: "incorrect" }), env);
  assert.equal(wrongPassword.headers.get("Location"), "/admin/login?error=1");

  const adminLogin = await gate(post("/auth/admin-login", { password }), env);
  assert.equal(adminLogin.headers.get("Location"), "/admin");
  const adminCookie = issuedCookie(adminLogin);

  const adminPage = await gate(get("/admin", adminCookie), env);
  assert.equal(adminPage.status, 200);
  assert.match(await adminPage.text(), /베타 초대제/);

  const created = await gate(post("/auth/invite-create", { label: "Tester A", count: "1", days: "30" }, adminCookie), env);
  assert.equal(created.status, 200);
  const createdHtml = await created.text();
  const code = createdHtml.match(/[A-F0-9]{6}(?:-[A-F0-9]{6}){3}/)?.[0];
  assert.ok(code, "A distinct random invite code must be shown to the admin");

  const wrongCode = await gate(post("/auth/redeem", { code: "000000-000000-000000-000000" }), env);
  assert.equal(wrongCode.headers.get("Location"), "/invite?error=1");

  const redeemed = await gate(post("/auth/redeem", { code }), env);
  assert.equal(redeemed.headers.get("Location"), "/");
  const memberCookie = issuedCookie(redeemed);
  assert.match(memberCookie, /^cafe_access=u_/);

  assert.equal(await gate(get("/", memberCookie), env), null);
  assert.equal(await gate(get("/api/presence", memberCookie), env), null);
  assert.equal(await gate(get("/room.png", memberCookie), env), null);
  const renew = renewUserCookie(get("/", memberCookie));
  assert.ok(renew?.includes("Max-Age=31536000"));

  const replay = await gate(post("/auth/redeem", { code }), env);
  assert.equal(replay.headers.get("Location"), "/invite?error=1");

  const declinedPublicSwitch = await gate(post("/auth/access-mode", { mode: "public" }, adminCookie), env);
  assert.equal(declinedPublicSwitch.status, 400);
  assert.equal((await db.prepare("SELECT value FROM invite_settings WHERE key = 'site_access'").bind().first()).value, "invite");

  const publicSwitch = await gate(post("/auth/access-mode", { mode: "public", confirm: "yes" }, adminCookie), env);
  assert.equal(publicSwitch.headers.get("Location"), "/admin");
  assert.equal(await gate(get("/"), env), null);
  assert.equal(await gate(get("/app.js"), env), null);
  assert.equal(await gate(get("/api/presence"), env), null);
  assert.equal((await gate(get("/admin"), env)).headers.get("Location"), "/admin/login");

  const inviteSwitch = await gate(post("/auth/access-mode", { mode: "invite" }, adminCookie), env);
  assert.equal(inviteSwitch.headers.get("Location"), "/admin");
  assert.equal((await gate(get("/"), env)).headers.get("Location"), "/invite");
  assert.equal(await gate(get("/", memberCookie), env), null);

  const row = await db.prepare("SELECT id FROM invite_codes ORDER BY created_at DESC LIMIT 1").bind().first();
  assert.ok(row?.id);
  const revoke = await gate(post("/auth/invite-revoke", { id: row.id }, adminCookie), env);
  assert.equal(revoke.headers.get("Location"), "/admin");
  assert.equal((await gate(get("/", memberCookie), env)).headers.get("Location"), "/invite");

  const forgeAdmin = await gate(post("/auth/access-mode", { mode: "public", confirm: "yes" }, memberCookie), env);
  assert.equal(forgeAdmin.status, 403);

  const noSecret = await gate(get("/"), { DB: db });
  assert.equal(noSecret.status, 503);
  const noDb = await gate(get("/"), { NEON_ADMIN_PASSWORD: password });
  assert.equal(noDb.status, 503);
});
