import { env } from "cloudflare:workers";
import { cafeBoard } from "../../../lib/cafe-board.mjs";
import { cafeBoardAdmin } from "../../../lib/invite-gate";

export const dynamic = "force-dynamic";

async function handle(request: Request) {
  const admin = await cafeBoardAdmin(request, env.DB);
  return cafeBoard(request, env.DB, admin);
}

export const GET = handle;
export const POST = handle;
