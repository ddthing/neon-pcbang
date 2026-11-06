import { env } from "cloudflare:workers";
import { snacks } from "../../../lib/cafe-snacks.mjs";
import menu from "../../../public/snack-menu.json";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return snacks(request, env.DB, menu);
}
