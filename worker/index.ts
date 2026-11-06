import handler from "vinext/server/fetch-handler";
import { gate, renewUserCookie } from "../lib/invite-gate";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

const worker = {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    const access = await gate(request, env);
    if (access) return access;
    // When Worker-first static asset routing is enabled, explicitly forward assets.
    const pathname = new URL(request.url).pathname;
    if (pathname !== "/" && !pathname.startsWith("/api/") && /\.[a-z0-9]+$/i.test(pathname) && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    const response = await runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
    // Refresh the long-lived admission cookie when the member actually visits the PC bang.
    // The session remains revocable in D1; cookie renewal does not extend a revoked session.
    if (request.method === "GET" && pathname === "/" && response.status === 200) {
      const renewed = renewUserCookie(request);
      if (renewed) {
        const headers = new Headers(response.headers);
        headers.append("Set-Cookie", renewed);
        headers.set("Cache-Control", "private, no-store");
        return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
      }
    }
    return response;
  },
};

export default worker;
