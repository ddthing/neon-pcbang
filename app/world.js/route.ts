import source from "../../lib/cafe-world.mjs?raw";

export function GET() {
  return new Response(source, {
    headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
