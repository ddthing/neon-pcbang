// Beta invitation gate and administrator-controlled public launch mode.
type DB = D1Database;
type GateEnv = { DB?: DB; NEON_ADMIN_PASSWORD?: string; NEON_INVITE_VAULT_KEY?: string };
const cookieName = "cafe_access";
// The admission record never expires. The browser cookie lasts a year and is renewed on each visit.
const userLife = 365 * 86400_000;
const userSessionExpiry = 253402300799000;
const adminLife = 12 * 3600_000;
const enc = new TextEncoder();
const entryStylesheet = "/invite-entry.css";
const entryBackdrop = "/corner-hall-timber.webp";

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

function secureRandomHex() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)),
    (value) => value.toString(16).padStart(2, "0")).join("");
}

async function pageWithForm(
  db: DB, title: string, html: string, status = 200,
  render: (title: string, body: string, status: number) => Response = page,
) {
  const now = Date.now();
  const token = secureRandomHex();
  // Keep an unguessable, single-use token on the server, not in a browser cookie.
  // A cross-origin attacker cannot read the HTML containing the token.
  await db.prepare("DELETE FROM invite_form_tokens WHERE expires_at <= ?").bind(now).run();
  await db.prepare("INSERT INTO invite_form_tokens (token_hash, expires_at) VALUES (?, ?)")
    .bind(await digest(token), now + 30 * 60_000).run();
  const safeHtml = html.replace(/(<form\b[^>]*>)/gi,
    '$1<input type="hidden" name="csrf" value="' + token + '">');
  return render(title, safeHtml, status);
}

function htmlResponse(document: string, status: number, assets = "") {
  const headers = new Headers({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; " +
      (assets || "style-src 'unsafe-inline'") });
  return new Response(document, { status, headers });
}

function page(title: string, body: string, status = 200, adminTools = false) {
  return htmlResponse(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · 길모퉁이PC방</title><style>
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
  main.admin{width:min(100%,960px);padding:clamp(15px,4vw,32px)}.admin-header{display:flex;align-items:start;justify-content:space-between;gap:12px;flex-wrap:wrap}
  .admin-header form,.admin td form{margin:0}.admin section{border-top:1px solid #e5d9d7;margin-top:22px;padding-top:17px}
  .admin section h2{margin-top:0}.admin-fields{display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px}
  .admin-fields label{margin-top:0}.admin-nav{display:flex;flex-wrap:wrap;gap:8px 18px;margin:12px 0}
  .admin .quiet{background:#f1e9ed;color:#56475b;border:1px solid #d5c7ce;padding:7px 11px}
  .admin .table-wrap{overflow:auto}.admin table{min-width:580px}.admin .actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}
  .admin td a,.admin summary{cursor:pointer;color:#56475b;text-decoration:underline}.admin summary{white-space:nowrap}
  .admin .danger{color:#8b2838}.admin .danger button{background:#8b3646;padding:7px 11px}
  .admin .code-reveal{padding:13px;background:#f3ecef;border:1px solid #e1d3dc;border-radius:8px}
  .admin .code-reveal .row{align-items:stretch}.admin .code-reveal input{flex:1 1 240px;width:auto;min-width:0;font:700 clamp(12px,2vw,16px) ui-monospace,monospace}
  .admin .copy-status{min-height:1.4em;margin:6px 0 0}.admin .badge{font-weight:750;white-space:nowrap}
  @media(max-width:530px){body{padding:12px}.admin-fields{grid-template-columns:1fr 1fr}.admin-fields>div:first-child{grid-column:1 / -1}}
  </style>${adminTools ? '<script defer src="/invite-admin.js"></script>' : ""}</head><body><main${adminTools ? ' class="admin"' : ""}>${body}</main></body></html>`, status,
    adminTools ? "style-src 'unsafe-inline'; script-src 'self'" : "");
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
async function form(request: Request, db: DB): Promise<FormResult> {
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/x-www-form-urlencoded")) {
    return { error: "CONTENT_TYPE" };
  }
  const input = await request.text();
  if (input.length > 2048) return { error: "SIZE" };
  const params = new URLSearchParams(input);
  const token = params.get("csrf") || "";
  if (!/^[a-f0-9]{64}$/.test(token)) return { error: "FORM_TOKEN" };
  const used = await db.prepare("DELETE FROM invite_form_tokens WHERE token_hash = ? AND expires_at > ?")
    .bind(await digest(token), Date.now()).run();
  if (!used.meta.changes) return { error: "FORM_TOKEN" };
  params.delete("csrf");
  return { params };
}
function entryDocument(title: string, body: string, status: number) {
  return htmlResponse(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#302b25">
  <title>${esc(title)} · 길모퉁이PC방</title>
  <link rel="stylesheet" href="${entryStylesheet}">
</head>
<body>
  <img class="entry-art" src="${entryBackdrop}" width="1536" height="1024" fetchpriority="high" alt="">
  <header class="entry-bar">
    <span class="entry-brand">길모퉁이PC방 <span class="entry-location">PC방 입구</span></span>
    <span class="entry-open"><i aria-hidden="true"></i> 24H OPEN</span>
  </header>
  <main class="entry-layout">${body}</main>
  <footer class="entry-footer"><span>GILMOTUNGI PC BANG</span><span>2F · BETA</span></footer>
</body>
</html>`, status, "style-src 'self'; img-src 'self'; font-src https://cdn.jsdelivr.net");
}

async function invitePage(db: DB, message = "", status = 200) {
  return pageWithForm(db, "초대코드 입장", `
    <section class="entry-sign" aria-labelledby="entry-title">
      <p class="entry-eyebrow">02F <span aria-hidden="true">/</span> BETA ENTRANCE</p>
      <h1 id="entry-title">길모퉁이PC방</h1>
      <p class="entry-welcome">초대받은 손님을 기다리고 있어요.</p>
    </section>
    <section class="entry-kiosk" aria-labelledby="entry-kiosk-title">
      <div class="entry-bezel"><span>길모퉁이PC방</span><span>▦ 키오스크</span></div>
      <div class="entry-screen">
        <p class="entry-eyebrow">01 / ADMISSION</p>
        <h2 id="entry-kiosk-title">초대코드 입장</h2>
        <p class="entry-description" id="entry-help">받은 초대코드를 입력하면 매장으로 들어갈 수 있어요.</p>
        <form method="post" action="/auth/redeem">
          <label for="code">초대코드</label>
          <input id="code" name="code" maxlength="64" autocomplete="one-time-code" autocapitalize="characters"
            spellcheck="false" required placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX"
            aria-describedby="entry-help${message ? " entry-error" : ""}"${message ? ' aria-invalid="true"' : ""}>
          ${message ? `<p class="entry-error" id="entry-error" role="alert">${esc(message)}</p>` : ""}
          <button type="submit">PC방 입장하기 <span aria-hidden="true">→</span></button>
        </form>
      </div>
      <div class="entry-bezel entry-bezel-bottom" aria-hidden="true"><span></span><i></i><span></span></div>
    </section>`, status, entryDocument);
}
async function adminLogin(db: DB, message = "") {
  return pageWithForm(db, "관리자 로그인", `<p class="hint">PRIVATE ACCESS · ADMIN</p><h1>관리자 로그인</h1>
  ${message ? `<p class="error">${esc(message)}</p>` : ""}
  <form method="post" action="/auth/admin-login"><label for="password">관리자 비밀번호</label><input type="password" id="password" name="password" maxlength="256" required autocomplete="current-password"><p><button>로그인</button></p></form>
  <p><a href="/invite">초대코드 입력으로 돌아가기</a></p>`);
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
// Scope chat throttles to a real invitation session across browser tabs.
// Public mode falls back to the visitor token used by cafe-presence.
export async function cafeChatSessionId(request: Request, db: DB | undefined) {
  if (!db) return null;
  const session = await currentSession(db, request);
  if (!session || session.role !== "user") return null;
  return digest("cafe-chat-session:" + session.id);
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
function vaultConfigured(secret?: string): secret is string {
  return typeof secret === "string" && /^[0-9a-f]{64}$/i.test(secret);
}
async function vaultKey(secret: string) {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(secret.slice(i * 2, i * 2 + 2), 16);
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function sealInvite(code: string, id: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: enc.encode(id) }, await vaultKey(secret), enc.encode(code),
  );
  return btoa(String.fromCharCode(...iv, ...new Uint8Array(encrypted)));
}
async function readInvite(sealed: string, id: string, secret: string) {
  const bytes = Uint8Array.from(atob(sealed), (char) => char.charCodeAt(0));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes.slice(0, 12), additionalData: enc.encode(id) }, await vaultKey(secret), bytes.slice(12),
  );
  return new TextDecoder().decode(plain);
}

type InviteRow = {
  id: string; label: string; created_at: number; expires_at: number; max_uses: number;
  uses: number; revoked_at: number | null; recoverable: number;
};
function inviteStatus(item: Pick<InviteRow, "revoked_at" | "expires_at" | "max_uses" | "uses">, now: number) {
  if (item.revoked_at !== null) return "회수됨";
  if (item.expires_at <= now) return "만료됨";
  if (item.uses >= item.max_uses) return "사용 완료";
  return "사용 가능";
}
const seoulDate = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", year: "numeric", month: "numeric", day: "numeric",
});
const inviteIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

async function adminPanel(db: DB, url: URL, secret?: string) {
  const canIssue = vaultConfigured(secret);
  const mode = await accessMode(db);
  const requestedPage = Number(url.searchParams.get("page") || 1);
  const pageNumber = Number.isSafeInteger(requestedPage) ? Math.min(100000, Math.max(1, requestedPage)) : 1;
  const pageSize = 25;
  const selected = url.searchParams.get("code") || "";
  const now = Date.now();
  const { results } = await db.prepare(`SELECT c.id, c.label, c.created_at, c.expires_at, c.max_uses, c.uses, c.revoked_at,
    v.invite_id IS NOT NULL AS recoverable FROM invite_codes c
    LEFT JOIN invite_code_vault v ON v.invite_id = c.id
    ORDER BY c.created_at DESC, c.id LIMIT ? OFFSET ?`)
    .bind(pageSize + 1, (pageNumber - 1) * pageSize).all<InviteRow>();

  let reveal = "";
  if (inviteIdPattern.test(selected)) {
    const item = await db.prepare(`SELECT c.label, c.expires_at, c.max_uses, c.uses, c.revoked_at, v.sealed
      FROM invite_codes c LEFT JOIN invite_code_vault v ON v.invite_id = c.id WHERE c.id = ?`)
      .bind(selected).first<InviteRow & { sealed: string | null }>();
    if (!item) reveal = '<p class="error" role="status">선택한 초대코드를 찾을 수 없어요.</p>';
    else if (!item.sealed) reveal = '<p class="hint" role="status">이전 발급분은 원문을 보관하지 않아 다시 볼 수 없어요.</p>';
    else if (!canIssue) reveal = '<p class="error" role="status">코드 보관 설정을 확인해 주세요.</p>';
    else {
      try {
        const code = await readInvite(item.sealed, selected, secret);
        reveal = `<div class="code-reveal">
          <label for="issued-code">${esc(item.label || "초대코드")} · ${inviteStatus(item, now)}</label>
          <div class="row"><input id="issued-code" value="${esc(code)}" readonly spellcheck="false">
          <button type="button" id="copy-invite">코드 복사</button></div>
          <p class="hint copy-status" id="copy-invite-status" role="status"></p>
        </div>`;
      } catch {
        reveal = '<p class="error" role="status">보관된 코드를 열 수 없어요. 암호화 설정을 확인해 주세요.</p>';
      }
    }
  }

  const rows = results.slice(0, pageSize).map((item) => {
    const status = inviteStatus(item, now);
    const view = item.recoverable
      ? `<a href="/admin?page=${pageNumber}&amp;code=${encodeURIComponent(item.id)}#invite-code">코드 보기</a>`
      : '<span class="muted">이전 발급분 · 원문 없음</span>';
    const revoke = item.revoked_at !== null ? "" : `<details class="danger"><summary>회수</summary>
      <p>이 코드로 이미 입장한 손님도 접속할 수 없게 돼요.</p>
      <form method="post" action="/auth/invite-revoke"><input type="hidden" name="id" value="${esc(item.id)}">
      <button type="submit">코드 회수 확인</button></form></details>`;
    return `<tr><td>${esc(item.label || "초대권")}<br><small class="muted">${seoulDate.format(item.created_at)} 발급</small></td>
      <td class="badge">${status}</td><td>${Math.max(0, item.max_uses - item.uses)}회 남음<br><small class="muted">${item.uses} / ${item.max_uses} 사용</small></td>
      <td>${seoulDate.format(item.expires_at)}</td><td><div class="actions">${view}${revoke}</div></td></tr>`;
  }).join("");
  const accessStatus = mode === "public" ? "정식 공개" : "베타 초대제";
  return pageWithForm(db, "초대코드 관리", `
  <header class="admin-header"><div><p class="hint">길모퉁이PC방 · 관리자</p><h1>초대코드 관리</h1>
  <p>입장 방식 <strong>${accessStatus}</strong></p></div>
  <form method="post" action="/auth/admin-logout"><button class="quiet">로그아웃</button></form></header>
  <nav class="admin-nav" aria-label="관리 메뉴"><a href="#invite-new">코드 발급</a><a href="#invite-list">발급 목록</a>
    <a href="#access-settings">공개 설정</a><a href="/">PC방으로 이동</a></nav>
  ${reveal ? `<section id="invite-code"><h2>초대코드 확인</h2>${reveal}</section>` : ""}
  <section id="invite-new"><h2>새 코드 발급</h2>
  ${canIssue ? `<form method="post" action="/auth/invite-create"><div class="admin-fields">
    <div><label for="label">메모 (선택)</label><input id="label" name="label" maxlength="40" placeholder="예: 친구 초대"></div>
    <div><label for="count">사용 가능 횟수</label><input id="count" name="count" type="number" min="1" max="100" value="1" required></div>
    <div><label for="days">유효 기간 (일)</label><input id="days" name="days" type="number" min="1" max="365" value="30" required></div>
    </div><p><button type="submit">초대코드 발급</button></p></form>`
    : '<p class="error" role="status">코드 보관 설정이 준비되면 새 코드를 발급할 수 있어요.</p>'}
  </section>
  <section id="invite-list"><h2>발급 목록</h2><p class="hint">새로 발급한 코드는 ‘코드 보기’에서 다시 복사할 수 있어요.</p>
  <div class="table-wrap" tabindex="0" role="region" aria-label="초대코드 발급 목록">
    <table><thead><tr><th scope="col">메모</th><th scope="col">상태</th><th scope="col">남은 횟수</th><th scope="col">만료일</th><th scope="col">관리</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5">이 페이지에 표시할 코드가 없어요.</td></tr>'}</tbody></table></div>
  ${pageNumber > 1 || results.length > pageSize ? `<nav class="admin-nav" aria-label="목록 페이지">
    ${pageNumber > 1 ? `<a href="/admin?page=${pageNumber - 1}#invite-list">이전</a>` : ""}
    <span>${pageNumber}페이지</span>
    ${results.length > pageSize ? `<a href="/admin?page=${pageNumber + 1}#invite-list">다음</a>` : ""}
  </nav>` : ""}</section>
  <section id="access-settings"><h2>사이트 공개 설정</h2>
  ${mode === "invite"
    ? `<p class="hint">정식 공개로 전환하면 누구나 초대코드 없이 입장할 수 있어요.</p>
       <form method="post" action="/auth/access-mode"><input type="hidden" name="mode" value="public">
       <label><input type="checkbox" name="confirm" value="yes" required style="width:auto"> 모든 방문자에게 입장을 허용하는 것을 확인했습니다.</label>
       <p><button type="submit" class="quiet">정식 공개로 전환</button></p></form>`
    : `<p class="hint">초대제로 돌아가면 초대 인증을 받은 손님만 입장할 수 있어요.</p>
       <form method="post" action="/auth/access-mode"><input type="hidden" name="mode" value="invite">
       <button type="submit" class="quiet">베타 초대제로 전환</button></form>`}
  </section>`, 200, (title, body, status) => page(title, body, status, true));
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
  // Only the invitation screen's decorative assets are needed before admission.
  if ((request.method === "GET" || request.method === "HEAD") &&
      (path === entryStylesheet || path === entryBackdrop)) return null;
  const isAdminRoute = path === "/admin" || path === "/admin/login" || path === "/invite-admin.js" ||
    path.startsWith("/auth/admin-") || path.startsWith("/auth/invite-");
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
    if (path === "/invite") return mode === "public" || session ? go("/") : invitePage(db, url.searchParams.get("error") ? "초대코드를 다시 확인해 주세요." : "");
    if (path === "/admin/login") return admin ? go("/admin") : adminLogin(db, url.searchParams.get("error") ? "로그인에 실패했습니다." : "");
    if (path === "/admin") return admin ? adminPanel(db, url, env.NEON_INVITE_VAULT_KEY) : go("/admin/login");
    if (path === "/invite-admin.js") return admin ? null : new Response("Forbidden", { status: 403 });
    if (path.startsWith("/auth/")) {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
      const parsed = await form(request, db);
      if (!parsed.params) {
        if (path === "/auth/redeem") {
          return invitePage(db, "입장 요청을 확인하지 못했어요. 초대코드를 다시 입력해 주세요.", 403);
        }
        // Codes indicate which browser request validation failed without
        // printing passwords, tokens, cookies, or other sensitive values.
        const reason = parsed.error || "UNKNOWN";
        return page("요청 확인", `<h1>로그인 요청을 확인할 수 없습니다</h1>
          <p>관리자 비밀번호를 확인하기 전 요청이 거부되었습니다. 로그인 페이지를 새로 열어주세요.</p>
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
        if (await blockedLogin(db, request)) return adminLogin(db, "로그인 시도가 너무 많습니다. 15분 뒤 다시 시도해주세요.");
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
        const secret = env.NEON_INVITE_VAULT_KEY;
        if (!vaultConfigured(secret)) {
          return page("발급 오류", '<h1>코드 보관 설정을 확인해 주세요</h1><p><a href="/admin">관리 화면으로 돌아가기</a></p>', 503);
        }
        const label = (input.get("label") || "").trim().slice(0, 40);
        const count = Number(input.get("count"));
        const days = Number(input.get("days"));
        if (!Number.isInteger(count) || count < 1 || count > 100 || !Number.isInteger(days) || days < 1 || days > 365) {
          return page("입력 오류", '<h1>입력값을 확인해주세요</h1><p><a href="/admin">돌아가기</a></p>', 400);
        }
        const code = generateCode();
        const id = crypto.randomUUID();
        const now = Date.now();
        const [hash, sealed] = await Promise.all([digest(code), sealInvite(code, id, secret)]);
        await db.batch([
          db.prepare(`INSERT INTO invite_codes (id, code_hash, label, created_at, expires_at, max_uses, uses)
            VALUES (?, ?, ?, ?, ?, ?, 0)`).bind(id, hash, label, now, now + days * 86400_000, count),
          db.prepare("INSERT INTO invite_code_vault (invite_id, sealed) VALUES (?, ?)").bind(id, sealed),
        ]);
        return go("/admin?code=" + id + "#invite-code");
      }
      if (path === "/auth/invite-revoke") {
        const id = input.get("id") || "";
        if (!inviteIdPattern.test(id)) return new Response("Bad Request", { status: 400 });
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
