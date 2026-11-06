import assert from "node:assert/strict";

const base = "https://neon-pcbang.ddinngdoong.workers.dev";
const login = await fetch(base + "/admin/login", { redirect: "manual", headers: { "Cache-Control": "no-cache" } });
assert.equal(login.status, 200, "Live admin login page must load");
const html = await login.text();
const csrf = html.match(/name="csrf" value="([a-f0-9]{64})"/)?.[1];
assert.ok(csrf, "Server-issued single-use token must be rendered in the form");

// A distinct external origin reproduces the user-reported failure, but the
// server token must allow reaching password verification instead of ORIGIN.
const test = await fetch(base + "/auth/admin-login", {
  method: "POST",
  redirect: "manual",
  headers: {
    "Origin": "https://motoongpc.com",
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({ csrf, password: "known-invalid-live-smoke-test-password" }),
});
assert.equal(test.status, 303, "Form should reach password verification, not reject as ORIGIN");
assert.equal(test.headers.get("Location"), "/admin/login?error=1", "Wrong password must produce a password-specific error");

// A stolen form token must not be reusable.
const replay = await fetch(base + "/auth/admin-login", {
  method: "POST",
  redirect: "manual",
  headers: { "Origin": "https://motoongpc.com", "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ csrf, password: "known-invalid-live-smoke-test-password" }),
});
assert.equal(replay.status, 403, "A consumed form token must be rejected");
console.log("Live login smoke test passed: mismatched Origin reaches password verification and replay is blocked.");
