import { env } from "cloudflare:workers";
import { arcadeLeaderboard } from "../../../lib/cafe-arcade.mjs";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return arcadeLeaderboard(request, env.DB);
}
