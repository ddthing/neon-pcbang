import { env } from "cloudflare:workers";
import { pvpArena } from "../../../lib/cafe-pvp.mjs";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return pvpArena(request, env.DB);
}
