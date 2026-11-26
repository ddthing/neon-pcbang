import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const origin = "https://motoongpc.com";
const password = process.env.NEON_ADMIN_PASSWORD;
assert.ok(password?.length >= 16, "A production admin secret is required");
const request = (path, options = {}) => fetch(new URL(path, origin), {
  redirect: "manual",
  signal: AbortSignal.timeout(12000),
  ...options,
});
const formToken = (html) => html.match(/name="csrf" value="([a-f0-9]{64})"/)?.[1];
const read = await request("/admin/login");
assert.equal(read.status, 200, "Production login page must load");
const csrf = formToken(await read.text());
assert.ok(csrf, "Production login page must have a form token");
const signedIn = await request("/auth/admin-login", {
  method: "POST", headers: { Origin: origin }, body: new URLSearchParams({ csrf, password }),
});
assert.equal(signedIn.status, 303, "Production login should redirect");
assert.equal(signedIn.headers.get("location"), "/admin", "Production login must succeed");
const cookie = signedIn.headers.get("set-cookie")?.match(/(?:^|,\s*)(cafe_access=a_[a-f0-9]{64})(?:;|$)/)?.[1];
assert.ok(cookie, "Production login must issue an admin session");
const headers = { Cookie: cookie, "Cache-Control": "no-cache" };
const hash = (buffer) => createHash("sha256").update(buffer).digest("hex");

try {
  for (let attempt = 0; ; attempt++) {
    try {
      const page = await request("/", { headers });
      assert.equal(page.status, 200, "Authenticated URL must serve the game page");
      assert.match(await page.text(), /src="\.\/cafe-art\.js"/, "Game page must load the renewed renderer");
      await Promise.all([
        "cafe-art.js", "cafe-art.css", "cafe-interface.css", "camera.js",
        "cafe-delivery.js", "sprites/cat-clerk-service.png",
        "renewal-layout.mjs", "renewal-effects.mjs", "renewal-slice-art.mjs",
        "renewal-seat-picker.mjs", "renewal-slice.html", "renewal-slice.js", "walk.js",
        "app.js", "pc.css", "sudoku.js", "solitaire.js", "solitaire-engine.mjs",
        "knit-unravel.js", "knit-unravel-engine.mjs", "cafe-layout.js", "pixel-tiles.js", "avatar-sprites.js", "pvp-ai.mjs", "pvp.js",
        "omok-rules.mjs", "merge.js", "merge-board.js", "sudoku-board.js",
      ].map(async (path) => {
        const expected = await readFile(new URL("../public/" + path, import.meta.url));
        const response = await request("/" + path, { headers });
        assert.equal(response.status, 200, path + " must load");
        assert.equal(hash(Buffer.from(await response.arrayBuffer())), hash(expected), path + " must match this release");
      }));
      break;
    } catch (error) {
      if (attempt === 5) throw error;
      await delay(3000);
    }
  }
  console.log("Production game page, renderer, delivery code and pixel sprite checksums verified.");
} finally {
  const admin = await request("/admin", { headers });
  assert.equal(admin.status, 200, "Admin menu must load for session cleanup");
  const logoutToken = formToken(await admin.text());
  assert.ok(logoutToken, "Admin menu must issue a logout form token");
  const logout = await request("/auth/admin-logout", {
    method: "POST", headers: { ...headers, Origin: origin }, body: new URLSearchParams({ csrf: logoutToken }),
  });
  assert.equal(logout.status, 303, "Smoke test admin session must be closed");
}
