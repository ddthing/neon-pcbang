const statuses = new Set(["pending", "accepted", "closed", "held"]);
const types = new Set(["suggestion", "bug"]);
const uuid = /^[0-9a-f-]{36}$/i;
const json = (value, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } });

export async function cafeBoard(request, db, admin = false, now = Date.now()) {
  if (!db) return json({ error: "unavailable" }, 503);
  const url = new URL(request.url);
  if (request.method === "GET") {
    const rawStatus = url.searchParams.get("status");
    if (rawStatus && !statuses.has(rawStatus)) return json({ error: "invalid" }, 400);
    const columns = "id, kind, title, detail, status, created_at";
    const rows = rawStatus
      ? await db.prepare(`SELECT ${columns} FROM cafe_board_posts WHERE status = ? ORDER BY created_at DESC LIMIT 40`).bind(rawStatus).all()
      : await db.prepare(`SELECT ${columns} FROM cafe_board_posts ORDER BY created_at DESC LIMIT 40`).bind().all();
    return json({ posts: rows.results ?? [], admin });
  }
  const origin = request.headers.get("origin");
  if (request.method !== "POST") return json({ error: "method" }, 405);
  if ((origin && origin !== url.origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    return json({ error: "origin" }, 403);
  }
  let input;
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "invalid" }, 400);
    const decoder = new TextDecoder();
    let value = "";
    let bytes = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 4096) {
        await reader.cancel();
        return json({ error: "size" }, 413);
      }
      value += decoder.decode(part.value, { stream: true });
    }
    input = JSON.parse(value + decoder.decode());
  } catch {
    return json({ error: "invalid" }, 400);
  }
  if (input?.action === "status") {
    if (!admin) return json({ error: "forbidden" }, 403);
    if (!uuid.test(input.id ?? "") || !statuses.has(input.status)) return json({ error: "invalid" }, 400);
    const result = await db.prepare("UPDATE cafe_board_posts SET status = ? WHERE id = ?").bind(input.status, input.id).run();
    return result.meta.changes ? json({ ok: true }) : json({ error: "missing" }, 404);
  }
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const detail = typeof input?.detail === "string" ? input.detail.trim() : "";
  if (!types.has(input?.kind) || title.length < 2 || title.length > 60 || detail.length < 2 || detail.length > 600) {
    return json({ error: "invalid" }, 400);
  }
  await db.prepare("INSERT INTO cafe_board_posts (id, kind, title, detail, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), input.kind, title, detail, now).run();
  return json({ ok: true }, 201);
}
