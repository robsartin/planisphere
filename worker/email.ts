/* SPDX-License-Identifier: Apache-2.0 */
/**
 * Email delivery abstraction. For this PR the only implementation is a
 * console-log stub — the magic-link token is visible in the Worker log so
 * a developer can paste it into the callback URL by hand.
 *
 * Swapping in a real provider (Resend / Postmark / SES) is a one-file
 * change: add `ResendEmailSender` (or similar) that implements the
 * `EmailSender` interface, and wire it in `index.ts`'s factory.
 */

export type EmailSender = {
  sendMagicLink(to: string, loginUrl: string): Promise<void>;
};

/** Dev / test stub. Prints a one-line log that's easy to grep for. */
export class ConsoleEmailSender implements EmailSender {
  // eslint-disable-next-line @typescript-eslint/require-await
  async sendMagicLink(to: string, loginUrl: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[auth] magic link for ${to}: ${loginUrl}`);
  }
}

/** Factory used by `index.ts`. In the future this will select based on a
 *  Worker binding (e.g. `env.EMAIL_PROVIDER`). */
export function createEmailSender(): EmailSender {
  return new ConsoleEmailSender();
}
