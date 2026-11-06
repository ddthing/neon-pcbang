import { env } from "cloudflare:workers";
import { presence } from "../../../lib/cafe-presence.mjs";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return presence(request, env.DB);
}
