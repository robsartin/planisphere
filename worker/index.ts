/* SPDX-License-Identifier: Apache-2.0 */
import { deleteExpiredMagicLinks, deleteExpiredSessions } from "./db";
import { createEmailSender } from "./email";
import { handleCallback, handleLogout, handleMe, handleRequestLink } from "./routes/auth";
import {
  handleCreateNotebook,
  handleDeleteNotebook,
  handleGetNotebook,
  handleListNotebooks,
  handleUpdateNotebook,
} from "./routes/notebooks";
import type { Env } from "./types";

/**
 * Entry point for the Phase 2 API Worker. Dispatches `/api/auth/*` and
 * `/api/notebooks[/:id]`. Everything else is a 404. Method-mismatch on a
 * known path returns 405. See `worker/README.md` for the overall shape.
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();
    const emailSender = createEmailSender(env);

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
      if (path === "/api/notebooks") {
        if (method === "GET") return await handleListNotebooks(request, env);
        if (method === "POST") return await handleCreateNotebook(request, env);
        return methodNotAllowed();
      }
      if (path.startsWith("/api/notebooks/")) {
        const idStr = path.slice("/api/notebooks/".length);
        const id = Number(idStr);
        if (!/^\d+$/.test(idStr) || !Number.isInteger(id) || id <= 0) {
          return badRequest();
        }
        if (method === "GET") return await handleGetNotebook(request, env, id);
        if (method === "PUT") return await handleUpdateNotebook(request, env, id);
        if (method === "DELETE") return await handleDeleteNotebook(request, env, id);
        return methodNotAllowed();
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

  /**
   * Cron-triggered cleanup. Runs on the cadence declared by `triggers.crons`
   * in `wrangler.jsonc`. Sweeps expired / used magic_links and expired
   * sessions so the tables don't grow unboundedly.
   */
  async scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    try {
      const links = await deleteExpiredMagicLinks(env.DB);
      const sessions = await deleteExpiredSessions(env.DB);
      // eslint-disable-next-line no-console
      console.log(`[sweep] magic_links=${String(links)} sessions=${String(sessions)}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[sweep] failed", err);
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

function badRequest(): Response {
  return new Response(JSON.stringify({ error: "invalid_payload" }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
}
