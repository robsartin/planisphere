/* SPDX-License-Identifier: Apache-2.0 */
import { createEmailSender } from "./email";
import { handleCallback, handleLogout, handleMe, handleRequestLink } from "./routes/auth";
import type { Env } from "./types";

/**
 * Entry point for the Phase 2 API Worker. Dispatches `/api/auth/*` to the
 * auth routes. Everything else is a 404. Method-mismatch on a known path
 * returns 405. See `worker/README.md` for the overall shape.
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();
    const emailSender = createEmailSender();

    try {
      if (path === "/api/auth/request-link") {
        if (method !== "POST") return methodNotAllowed();
        return await handleRequestLink(request, env, emailSender);
      }
      if (path === "/api/auth/callback") {
        if (method !== "GET") return methodNotAllowed();
        return await handleCallback(request, env);
      }
      if (path === "/api/auth/logout") {
        if (method !== "POST") return methodNotAllowed();
        return await handleLogout(request, env);
      }
      if (path === "/api/auth/me") {
        if (method !== "GET") return methodNotAllowed();
        return await handleMe(request, env);
      }
      return notFound();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[worker] unhandled error", err);
      return new Response(JSON.stringify({ error: "server_error" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  },
} satisfies ExportedHandler<Env>;

function methodNotAllowed(): Response {
  return new Response(JSON.stringify({ error: "method_not_allowed" }), {
    status: 405,
    headers: { "content-type": "application/json" },
  });
}

function notFound(): Response {
  return new Response(JSON.stringify({ error: "not_found" }), {
    status: 404,
    headers: { "content-type": "application/json" },
  });
}
