import { env } from "cloudflare:workers";
import { cafeChatSessionId } from "../../../lib/invite-gate";
import { presence } from "../../../lib/cafe-presence.mjs";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return presence(request, env.DB, {
    resolveChatActor: () => cafeChatSessionId(request, env.DB),
  });
}
