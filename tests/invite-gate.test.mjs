import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { gate, renewUserCookie } from "../lib/invite-gate.ts";

const origin = "https://pcbang.example.test";
const password = "local-test-admin-password-do-not-use";
const sqlite = new DatabaseSync(":memory:");
sqlite.exec(readFileSync(new URL("../drizzle/0002_invitation_access.sql", import.meta.url), "utf8"));
sqlite.exec(readFileSync(new URL("../drizzle/0003_invite_form_tokens.sql", import.meta.url), "utf8"));
const db = {
  prepare(sql) {
    const statement = sqlite.prepare(sql);
    const bound = (...values) => ({
      async first() { return statement.get(...values) ?? null; },
      async all() { return { results: statement.all(...values) }; },
      async run() {
        const info = statement.run(...values);
        return { success: true, meta: { changes: Number(info.changes) } };
      },
    });
    return { ...bound(), bind: (...values) => bound(...values) };
  },
};
const env = { DB: db, NEON_ADMIN_PASSWORD: password };
let latestCsrf = "";
function captureCsrf(response, body) {
  assert.ok(response.status === 200);
  const matches = body.match(/name="csrf" value="([a-f0-9]{64})"/g) || [];
  assert.ok(matches.length > 0, "HTML forms must include server-issued security token");
  latestCsrf = matches[0].match(/[a-f0-9]{64}/)[0];
  assert.equal(response.headers.get("Set-Cookie"), null, "CSRF should not depend on a browser cookie");
}
function get(path, accessCookie) {
  return new Request(origin + path, { headers: accessCookie ? { Cookie: accessCookie } : {} });
}
function post(path, values, accessCookie, extraHeaders = {}) {
  return new Request(origin + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(accessCookie ? { Cookie: accessCookie } : {}),
      ...extraHeaders,
    },
    body: new URLSearchParams({ csrf: latestCsrf, ...values }).toString(),
  });
}
async function refreshForm(path, cookie) {
  const response = await gate(get(path, cookie), env);
  const body = await response.text();
  captureCsrf(response, body);
  return body;
}
function issuedCookie(response) {
  const set = response.headers.get("Set-Cookie");
  assert.ok(set, "Server must issue a session cookie");
  assert.match(set, /HttpOnly/);
  assert.match(set, /SameSite=Strict/);
  return set.split(";")[0];
}

test("beta invitation and public launch use one-time database-backed form tokens", async () => {
  assert.equal((await gate(get("/"), env)).headers.get("Location"), "/invite");
  assert.equal((await gate(get("/app.js"), env)).headers.get("Location"), "/invite");
  assert.equal((await gate(get("/api/presence"), env)).status, 401);
  assert.equal(await gate(get("/invite-entry.css"), env), null);
  assert.equal(await gate(get("/corner-hall-timber.webp"), env), null);
  const entryHtml = await refreshForm("/invite");
  assert.match(entryHtml, /href="\/invite-entry\.css"/);
  assert.match(entryHtml, /src="\/corner-hall-timber\.webp"/);
  assert.match(entryHtml, /<form method="post" action="\/auth\/redeem">/);
  const retryPage = await gate(post("/auth/redeem", { csrf: "expired", code: "invalid" }), env);
  assert.equal(retryPage.status, 403);
  assert.match(await retryPage.text(), /id="entry-error" role="alert"/);
  const loginHtml = await refreshForm("/admin/login");
  assert.match(loginHtml, /name="csrf"/);

  // Reproduce the real production symptom: a proxy exposes a different Origin
  // than the request URL used by the server. The one-time token must win.
  const wrongPassword = await gate(post("/auth/admin-login", {password:"incorrect"}, null, {
    Origin:"https://motoongpc.com", "Sec-Fetch-Site":"same-site"
  }), env);
  assert.equal(wrongPassword.headers.get("Location"), "/admin/login?error=1");

  const replay = await gate(post("/auth/admin-login", {password}, null, {
    Origin:"https://motoongpc.com"
  }), env);
  assert.equal(replay.status, 403);

  const tokenless = new Request(origin + "/auth/admin-login", {
    method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded","Origin":origin},
    body:new URLSearchParams({password}).toString()
  });
  assert.equal((await gate(tokenless,env)).status,403);
  // Verify a totally different Origin also fails without a valid form token.
  const crossSite = new Request(origin + "/auth/admin-login", {
    method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded","Origin":"https://attacker.example"},
    body:new URLSearchParams({password}).toString()
  });
  assert.equal((await gate(crossSite,env)).status,403);

  await refreshForm("/admin/login");
  const adminLogin = await gate(post("/auth/admin-login",{password},null,{
    Origin:"https://motoongpc.com"
  }),env);
  assert.equal(adminLogin.headers.get("Location"),"/admin");
  const adminCookie=issuedCookie(adminLogin);
  await refreshForm("/admin",adminCookie);
  const created=await gate(post("/auth/invite-create",{label:"Tester A",count:"1",days:"30"},adminCookie),env);
  assert.equal(created.status,200);
  const html=await created.text();
  const code=html.match(/[A-F0-9]{6}(?:-[A-F0-9]{6}){3}/)?.[0];
  assert.ok(code);
  captureCsrf(created,html);

  await refreshForm("/invite");
  const redeemed=await gate(post("/auth/redeem",{code}),env);
  assert.equal(redeemed.headers.get("Location"),"/");
  const userCookie=issuedCookie(redeemed);
  assert.equal(await gate(get("/",userCookie),env),null);
  assert.equal(await gate(get("/api/presence",userCookie),env),null);

  await refreshForm("/invite");
  assert.equal((await gate(post("/auth/redeem",{code}),env)).headers.get("Location"),"/invite?error=1");

  await refreshForm("/admin",adminCookie);
  assert.equal((await gate(post("/auth/access-mode",{mode:"public"},adminCookie),env)).status,400);
  await refreshForm("/admin",adminCookie);
  assert.equal((await gate(post("/auth/access-mode",{mode:"public",confirm:"yes"},adminCookie),env)).headers.get("Location"),"/admin");
  assert.equal(await gate(get("/"),env),null);
  assert.equal((await gate(get("/admin"),env)).headers.get("Location"),"/admin/login");
  await refreshForm("/admin",adminCookie);
  assert.equal((await gate(post("/auth/access-mode",{mode:"invite"},adminCookie),env)).headers.get("Location"),"/admin");

  await refreshForm("/admin",adminCookie);
  const invite=await db.prepare("SELECT id FROM invite_codes LIMIT 1").first();
  await gate(post("/auth/invite-revoke",{id:invite.id},adminCookie),env);
  assert.equal((await gate(get("/",userCookie),env)).headers.get("Location"),"/invite");
  assert.equal((await gate(get("/"),{DB:db})).status,503);
});
