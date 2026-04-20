/* SPDX-License-Identifier: Apache-2.0 */
/**
 * Email delivery. `EmailSender` is the interface every provider implements;
 * `createEmailSender(env)` picks one based on what the Worker has been
 * configured with.
 *
 * - `ResendEmailSender` — production-ish. Calls the Resend HTTP API
 *   (ADR 014). Requires `env.RESEND_API_KEY` + `env.EMAIL_FROM`.
 * - `ConsoleEmailSender` — dev / test fallback. Logs the magic-link URL
 *   to the Worker console for grepping via `wrangler tail`. Selected
 *   automatically when either required Resend env var is missing.
 *
 * No SDK. Resend's REST API is one `fetch` call with a Bearer token — a
 * runtime dep would be pure bloat for the Worker bundle.
 */

export type EmailSender = {
  sendMagicLink(to: string, loginUrl: string): Promise<void>;
};

export type EmailEnv = {
  readonly RESEND_API_KEY?: string;
  readonly EMAIL_FROM?: string;
};

/** Resend's production REST endpoint. Exported so tests can assert
 *  against it without hard-coding the string twice. */
export const RESEND_API_URL = "https://api.resend.com/emails";

/** Dev / test stub. Prints a one-line log that's easy to grep for. */
export class ConsoleEmailSender implements EmailSender {
  // eslint-disable-next-line @typescript-eslint/require-await
  async sendMagicLink(to: string, loginUrl: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[auth] magic link for ${to}: ${loginUrl}`);
  }
}

export type ResendEmailSenderOptions = {
  readonly apiKey: string;
  readonly from: string;
};

export class ResendEmailSender implements EmailSender {
  private readonly apiKey: string;
  private readonly from: string;

  constructor(options: ResendEmailSenderOptions) {
    this.apiKey = options.apiKey;
    this.from = options.from;
  }

  async sendMagicLink(to: string, loginUrl: string): Promise<void> {
    const subject = "Your planisphere sign-in link";
    const text =
      `Click this single-use link to sign in to planisphere:\n\n${loginUrl}\n\n` +
      `If you didn't request this, you can ignore the email.`;
    const html =
      `<p>Click this single-use link to sign in to planisphere:</p>` +
      `<p><a href="${loginUrl}">${loginUrl}</a></p>` +
      `<p>If you didn't request this, you can ignore the email.</p>`;

    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [to],
        subject,
        text,
        html,
      }),
    });

    if (!response.ok) {
      // Surface the status so the top-level handler's catch can log it.
      // We don't swallow — a failed send means the user got no link.
      throw new Error(`Resend ${String(response.status)}: send failed`);
    }
  }
}

/** Picks the implementation based on env. Falls back to the console stub
 *  when any required Resend config is missing — keeps local dev and
 *  Vitest-worker tests running offline. */
export function createEmailSender(env: EmailEnv): EmailSender {
  const apiKey = env.RESEND_API_KEY ?? "";
  const from = env.EMAIL_FROM ?? "";
  if (apiKey.length === 0 || from.length === 0) {
    return new ConsoleEmailSender();
  }
  return new ResendEmailSender({ apiKey, from });
}
