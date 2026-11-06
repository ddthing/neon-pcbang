// Beta invitation gate and administrator-controlled public launch mode.
type DB = D1Database;
type GateEnv = { DB?: DB; NEON_ADMIN_PASSWORD?: string; ASSETS?: { fetch(request: Request): Promise<Response> } };
const cookieName = "cafe_access";
// The admission record never expires. The browser cookie lasts a year and is renewed on each visit.
const userLife = 365 * 86400_000;
const userSessionExpiry = 253402300799000;
const adminLife = 12 * 3600_000;
const enc = new TextEncoder();

async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return [...new Uint8Array(bytes)].map((n) => n.toString(16).padStart(2, "0")).join("");
}
function equal(a: string, b: string) {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]!));
}

const csrfCookieHttps = "__Host-pcbang_csrf";
const csrfCookieLocal = "pcbang_csrf";
function csrfCookieName(request: Request) {
  return new URL(request.url).protocol === "https:" ? csrfCookieHttps : csrfCookieLocal;
}
function getNamedCookie(request: Request, name: string) {
  const pair = (request.headers.get("Cookie") || "").split(";")
    .map((part) => part.trim()).find((part) => part.startsWith(name + "="));
  return pair?.slice(name.length + 1) || "";
}
function csrfCookieValue(request: Request) {
  return getNamedCookie(request, csrfCookieName(request));
}
function csrfForForm(request: Request) {
  const existing = csrfCookieValue(request);
  if (/^[a-f0-9]{64}$/.test(existing)) return existing;
  return Array.from(crypto.getRandomValues(new Uint8Array(32)),
    (value) => value.toString(16).padStart(2, "0")).join("");
}

function page(title: string, body: string, status = 200, request?: Request) {
  const headers = new Headers({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" });
  if (request && /<form\b/i.test(body)) {
    const token = csrfForForm(request);
    body = body.replace(/(<form\b[^>]*>)/gi, '$1<input type="hidden" name="csrf" value="' + token + '">');
    const secure = new URL(request.url).protocol === "https:";
    headers.set("Set-Cookie", csrfCookieName(request) + "=" + token +
      "; Path=/; HttpOnly; SameSite=Strict; Max-Age=7200" + (secure ? "; Secure" : ""));
  }
  return new Response(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · 길모퉁이PC방</title><style>
  :root{font-family:system-ui,-apple-system,sans-serif;color:#4b4150;background:#f4efed;color-scheme:light}
  *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}
  main{width:min(100%,600px);padding:36px;background:#fffaf6;border:2px solid #e5d9d7;border-radius:22px;box-shadow:0 20px 60px #44372b1a}
  h1{margin:0 0 12px;font-size:25px}h2{font-size:18px;margin:24px 0 10px}p{line-height:1.65}
  label{font-weight:650;display:block;margin:14px 0 6px}input{width:100%;font:inherit;padding:12px;border:1px solid #c8bfc7;border-radius:10px;background:white}
  button,.button{display:inline-block;border:0;background:#574a62;color:#fff;padding:12px 18px;border-radius:10px;font:inherit;cursor:pointer;text-decoration:none}
  button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #a78fdb;outline-offset:3px}
  form{margin:14px 0}.hint{color:#716979;font-size:14px}.error{color:#a02542;font-weight:650}
  .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.row>*{flex-shrink:0}
  table{border-collapse:collapse;width:100%;font-size:13px}th,td{border-bottom:1px solid #e5d9d7;padding:10px 6px;text-align:left;overflow-wrap:anywhere}th{color:#5a5360}
  .muted{color:#7a7380}.code{font-family:ui-monospace,monospace;letter-spacing:1px;overflow-wrap:anywhere;background:#f0eafa;padding:12px;border-radius:8px}
  </style></head><body><main>${body}</main></body></html>`, { status, headers });
}
function go(path: string, cookie?: string) {
  const headers = new Headers({ Location: path, "Cache-Control": "no-store" });
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}
function getCookie(request: Request) {
  const raw = request.headers.get("Cookie") || "";
  return raw.split(";").map((value) => value.trim()).find((p) => p.startsWith(cookieName + "="))?.slice(cookieName.length + 1) || "";
}
function cookie(value: string, request: Request, seconds: number) {
  return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
function clearCookie(request: Request) { return cookie("", request, 0); }
// Called only on authenticated page loads (after gate() has authorized the request).
export function renewUserCookie(request: Request) {
  const token = getCookie(request);
  return /^u_[a-f0-9]{64}$/.test(token) ? cookie(token, request, Math.floor(userLife / 1000)) : null;
}
async function accessMode(db: DB): Promise<"invite" | "public"> {
  const setting = await db.prepare("SELECT value FROM invite_settings WHERE key = 'site_access'")
    .first<{ value: string }>();
  return setting?.value === "public" ? "public" : "invite";
}
type FormResult = { params: URLSearchParams; error?: never } | { params?: never; error: string };
async function form(request: Request): Promise<FormResult> {
  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get("Origin");
  const site = request.headers.get("Sec-Fetch-Site");
  // A browser-generated Origin or Fetch Metadata header is a reliable
  // same-origin signal, even if its separate CSRF cookie was rejected.
  const originMatches = origin === expectedOrigin;
  if (origin && !originMatches) return { error: "ORIGIN" };
  if (site && !["same-origin", "none"].includes(site) &&
      !(site === "same-site" && originMatches)) return { error: "SITE" };
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/x-www-form-urlencoded")) {
    return { error: "CONTENT_TYPE" };
  }
  const input = await request.text();
  if (input.length > 2048) return { error: "SIZE" };
  const params = new URLSearchParams(input);
  const submitted = params.get("csrf") || "";
  const cookie = csrfCookieValue(request);
  const csrfMatches = /^[a-f0-9]{64}$/.test(submitted) && /^[a-f0-9]{64}$/.test(cookie) && equal(submitted, cookie);
  // Keep protecting all POST actions if both browser headers are unavailable:
  // they must then supply the server-issued double-submit cookie and form token.
  if (!csrfMatches && !originMatches && site !== "same-origin") return { error: "FORM_TOKEN" };
  params.delete("csrf");
  return { params };
}
function invitePage(message = "", request?: Request) {
  return page("초대코드 입장", `<p class="hint">GILMOTUNGI PC BANG · PRIVATE ENTRY</p><h1>길모퉁이PC방</h1>
  <p>초대받은 손님만 입장할 수 있어요. 전달받은 초대코드를 입력해주세요.</p>
  ${message ? `<p class="error">${esc(message)}</p>` : ""}
  <form method="post" action="/auth/redeem"><label for="code">초대코드</label><input id="code" name="code" maxlength="64" autocomplete="one-time-code" required placeholder="XXXX-XXXX-XXXX-XXXX"><p><button type="submit">PC방 입장하기</button></p></form>
  <p class="hint">초대코드가 없다면 관리자에게 문의해주세요.</p>`, 200, request);
}
function adminLogin(message = "", request?: Request) {
  return page("관리자 로그인", `<p class="hint">PRIVATE ACCESS · ADMIN</p><h1>관리자 로그인</h1>
  ${message ? `<p class="error">${esc(message)}</p>` : ""}
  <form method="post" action="/auth/admin-login"><label for="password">관리자 비밀번호</label><input type="password" id="password" name="password" maxlength="256" required autocomplete="current-password"><p><button>로그인</button></p></form>
  <p><a href="/invite">초대코드 입력으로 돌아가기</a></p>`, 200, request);
}
async function currentSession(db: DB, request: Request) {
  const token = getCookie(request);
  if (!/^[ua]_[a-f0-9]{64}$/.test(token)) return null;
  const hash = await digest(token);
  const now = Date.now();
  return db.prepare(`SELECT s.id, s.role, s.invite_id FROM invite_sessions s
    LEFT JOIN invite_codes c ON c.id = s.invite_id
    WHERE s.token_hash = ? AND s.expires_at > ?
    AND (s.role = 'admin' OR (s.role = 'user' AND c.id IS NOT NULL AND c.revoked_at IS NULL))
    LIMIT 1`).bind(hash, now).first<{ id: string; role: string; invite_id: string | null }>();
}
async function createSession(db: DB, role: "admin" | "user", inviteId: string | null, request: Request) {
  const token = (role === "user" ? "u_" : "a_") +
    Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) => n.toString(16).padStart(2, "0")).join("");
  const life = role === "admin" ? adminLife : userLife;
  await db.prepare("INSERT INTO invite_sessions (id, token_hash, role, invite_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), await digest(token), role, inviteId, Date.now(),
      role === "user" ? userSessionExpiry : Date.now() + life).run();
  return cookie(token, request, Math.floor(life / 1000));
}
function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const str = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return str.match(/.{1,6}/g)!.join("-");
}
async function adminPanel(db: DB, created = "", request?: Request) {
  const mode = await accessMode(db);
  const { results } = await db.prepare(`SELECT id, label, created_at, expires_at, max_uses, uses, revoked_at
    FROM invite_codes ORDER BY created_at DESC LIMIT 100`).all<{
    id: string; label: string; created_at: number; expires_at: number; max_uses: number; uses: number; revoked_at: number | null;
  }>();
  const now = Date.now();
  const rows = results.map((item) => {
    const status = item.revoked_at ? "회수됨" : item.expires_at < now ? "만료됨" : item.uses >= item.max_uses ? "사용 완료" : "사용 가능";
    return `<tr><td>${esc(item.label || "초대권")}</td><td>${status}</td><td>${item.uses}/${item.max_uses}</td><td>${new Date(item.expires_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}</td><td>${item.revoked_at ? "" : `<form method="post" action="/auth/invite-revoke"><input type="hidden" name="id" value="${esc(item.id)}"><button>회수</button></form>`}</td></tr>`;
  }).join("");
  return page("초대코드 관리", `<p class="hint">GILMOTUNGI PC BANG · ADMIN</p><h1>초대코드 관리</h1>
  <form method="post" action="/auth/admin-logout"><button>관리자 로그아웃</button></form>
  <h2>사이트 공개 설정</h2>
  <p>현재 상태: <strong>${mode === "public" ? "정식 공개 · 초대코드 불필요" : "베타 초대제 · 초대코드 필수"}</strong></p>
  ${mode === "invite"
    ? `<p class="hint">정식 공개로 전환하면 모든 방문자가 초대코드 없이 PC방을 이용할 수 있습니다. 기존 초대코드와 인증 기록은 삭제되지 않습니다.</p>
       <form method="post" action="/auth/access-mode"><input type="hidden" name="mode" value="public">
       <label><input type="checkbox" name="confirm" value="yes" required style="width:auto"> 초대 제한이 모든 사용자에게 해제되는 것을 확인했습니다.</label>
       <p><button type="submit">정식 공개로 전환</button></p></form>`
    : `<p class="hint">누구나 입장할 수 있습니다. 초대제로 돌아가면 기존 초대 인증 사용자만 입장할 수 있습니다.</p>
       <form method="post" action="/auth/access-mode"><input type="hidden" name="mode" value="invite">
       <button type="submit">베타 초대제로 전환</button></form>`}
  ${created ? `<h2>새 초대코드</h2><p class="hint">코드는 지금 한 번만 표시됩니다. 복사해서 초대할 사람에게 전달하세요.</p><p class="code"><strong>${esc(created)}</strong></p>` : ""}
  <h2>새 코드 발급</h2><form method="post" action="/auth/invite-create">
  <label for="label">메모 (선택)</label><input id="label" name="label" maxlength="40" placeholder="예: 친구 초대">
  <label for="count">사용 가능 횟수 (1~100)</label><input id="count" name="count" type="number" min="1" max="100" value="1" required>
  <label for="days">코드 유효 기간 (1~365일)</label><input id="days" name="days" type="number" min="1" max="365" value="30" required>
  <p><button>초대코드 생성</button></p></form>
  <h2>최근 발급 코드</h2><p class="hint">코드 원문은 보안상 저장하지 않습니다. 회수하면 이 코드로 입장한 사용자도 차단됩니다.</p>
  <div style="overflow-x:auto"><table><thead><tr><th>메모</th><th>상태</th><th>사용</th><th>만료일</th><th>관리</th></tr></thead><tbody>${rows || '<tr><td colspan="5">발급된 코드가 없습니다.</td></tr>'}</tbody></table></div>
  <p class="hint">최근 100개까지 표시됩니다.</p><p><a href="/">PC방으로 이동</a></p>`, 200, request);
}
async function rateLimit(db: DB, request: Request, success: boolean) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = await digest("admin-login:" + ip);
  if (success) {
    await db.prepare("DELETE FROM invite_login_attempts WHERE id = ?").bind(key).run();
    return false;
  }
  const now = Date.now();
  await db.prepare(`INSERT INTO invite_login_attempts(id, count, reset_at) VALUES (?, 1, ?)
    ON CONFLICT(id) DO UPDATE SET count = CASE WHEN reset_at < ? THEN 1 ELSE count + 1 END,
    reset_at = CASE WHEN reset_at < ? THEN ? ELSE reset_at END`)
    .bind(key, now + 15 * 60_000, now, now, now + 15 * 60_000).run();
  const record = await db.prepare("SELECT count FROM invite_login_attempts WHERE id = ?").bind(key).first<{ count: number }>();
  return (record?.count ?? 0) >= 5;
}
async function blockedLogin(db: DB, request: Request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = await digest("admin-login:" + ip);
  const record = await db.prepare("SELECT count, reset_at FROM invite_login_attempts WHERE id = ?")
    .bind(key).first<{ count: number; reset_at: number }>();
  return Boolean(record && record.count >= 5 && record.reset_at > Date.now());
}
/** Returns a response for access-controlled routes, or null to continue normal routing. */
export async function gate(request: Request, env: GateEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const isAdminRoute = path === "/admin" || path === "/admin/login" || path.startsWith("/auth/admin-") || path.startsWith("/auth/invite-");
  const isAuthRoute = path === "/invite" || path.startsWith("/auth/") || isAdminRoute;
  const db = env.DB;
  if (!db || !env.NEON_ADMIN_PASSWORD || env.NEON_ADMIN_PASSWORD.length < 16) {
    return page("설정 필요", "<h1>초대 시스템 설정이 필요합니다</h1><p>관리자 비밀번호 또는 D1 연결이 준비되지 않았습니다. 사이트 관리자에게 문의하세요.</p>", 503);
  }
  if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD, POST" } });
  }
  try {
    const mode = await accessMode(db);
    // Public release does not require invitations for pages, assets, or APIs.
    // Administrator authentication and management endpoints remain protected.
    if (mode === "public" && !isAuthRoute) return null;
    const session = await currentSession(db, request);
    const admin = session?.role === "admin";
    if (path === "/invite") return mode === "public" || session ? go("/") : invitePage(url.searchParams.get("error") ? "초대코드를 다시 확인해주세요." : "", request);
    if (path === "/admin/login") return admin ? go("/admin") : adminLogin(url.searchParams.get("error") ? "로그인에 실패했습니다." : "", request);
    if (path === "/admin") return admin ? adminPanel(db, "", request) : go("/admin/login");
    if (path.startsWith("/auth/")) {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
      const parsed = await form(request);
      if (!parsed.params) {
        // Codes indicate which browser request validation failed without
        // printing passwords, tokens, cookies, or other sensitive values.
        const reason = parsed.error || "UNKNOWN";
        return page("요청 확인", `<h1>로그인 요청을 확인할 수 없습니다</h1>
          <p>관리자 비밀번호가 틀렸다는 뜻은 아닙니다. 페이지를 새로 연 뒤 다시 제출해주세요.</p>
          <p class="hint">요청 확인 코드: ${esc(reason)}</p><p><a href="/admin/login">관리자 로그인으로 돌아가기</a></p>`, 403);
      }
      const input = parsed.params;
      if (path === "/auth/redeem") {
        if (mode === "public") return go("/");
        const code = (input.get("code") || "").trim().toUpperCase();
        if (!/^[0-9A-F]{6}(?:-[0-9A-F]{6}){3}$/.test(code)) return go("/invite?error=1");
        const now = Date.now();
        const hash = await digest(code);
        const updated = await db.prepare(`UPDATE invite_codes SET uses = uses + 1
          WHERE code_hash = ? AND revoked_at IS NULL AND expires_at > ? AND uses < max_uses`)
          .bind(hash, now).run();
        if (!updated.meta.changes) return go("/invite?error=1");
        const invite = await db.prepare("SELECT id FROM invite_codes WHERE code_hash = ?").bind(hash).first<{ id: string }>();
        if (!invite) return go("/invite?error=1");
        return go("/", await createSession(db, "user", invite.id, request));
      }
      if (path === "/auth/admin-login") {
        if (await blockedLogin(db, request)) return adminLogin("로그인 시도가 너무 많습니다. 15분 뒤 다시 시도해주세요.", request);
        const pass = input.get("password") || "";
        const valid = equal(await digest(pass), await digest(env.NEON_ADMIN_PASSWORD));
        if (!valid) {
          await rateLimit(db, request, false);
          return go("/admin/login?error=1");
        }
        await rateLimit(db, request, true);
        return go("/admin", await createSession(db, "admin", null, request));
      }
      if (path === "/auth/logout" || path === "/auth/admin-logout") {
        if (session) await db.prepare("DELETE FROM invite_sessions WHERE id = ?").bind(session.id).run();
        return go(path === "/auth/admin-logout" ? "/admin/login" : "/invite", clearCookie(request));
      }
      if (!admin) return new Response("Forbidden", { status: 403 });
      if (path === "/auth/access-mode") {
        const next = input.get("mode");
        if (next !== "public" && next !== "invite") return new Response("Bad Request", { status: 400 });
        if (next === "public" && input.get("confirm") !== "yes") return new Response("Confirmation Required", { status: 400 });
        await db.prepare("UPDATE invite_settings SET value = ? WHERE key = 'site_access'").bind(next).run();
        return go("/admin");
      }
      if (path === "/auth/invite-create") {
        const label = (input.get("label") || "").trim().slice(0, 40);
        const count = Number(input.get("count"));
        const days = Number(input.get("days"));
        if (!Number.isInteger(count) || count < 1 || count > 100 || !Number.isInteger(days) || days < 1 || days > 365) {
          return page("입력 오류", '<h1>입력값을 확인해주세요</h1><p><a href="/admin">돌아가기</a></p>', 400);
        }
        const code = generateCode();
        const now = Date.now();
        await db.prepare(`INSERT INTO invite_codes (id, code_hash, label, created_at, expires_at, max_uses, uses)
          VALUES (?, ?, ?, ?, ?, ?, 0)`).bind(crypto.randomUUID(), await digest(code), label, now, now + days * 86400_000, count).run();
        return adminPanel(db, code, request);
      }
      if (path === "/auth/invite-revoke") {
        const id = input.get("id") || "";
        if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Bad Request", { status: 400 });
        await db.prepare("UPDATE invite_codes SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL").bind(Date.now(), id).run();
        return go("/admin");
      }
      return new Response("Not Found", { status: 404 });
    }
    if (isAuthRoute) return new Response("Not Found", { status: 404 });
    if (!session) {
      if (path.startsWith("/api/")) return Response.json({ error: "invitation_required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
      return go("/invite");
    }
    return null;
  } catch (error) {
    console.error("Invitation access failure", error instanceof Error ? error.message : "D1 error");
    return page("접속 오류", "<h1>접속을 확인할 수 없습니다</h1><p>잠시 후 다시 시도해주세요.</p>", 503);
  }
}
