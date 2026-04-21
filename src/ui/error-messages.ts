/* SPDX-License-Identifier: Apache-2.0 */
import type { AuthError } from "../auth";
import type { NotebookError } from "../notebooks";

/**
 * Shared error → user-message mapper for UI surfaces. Both the login
 * modal (for `AuthError`) and the Notebook workspace (for
 * `NotebookError`) previously kept their own switch — with the same
 * `network` / `server` arms word-for-word and subtly different
 * phrasings for the others. One table means one place to edit when a
 * new error kind lands.
 *
 * Copy is deliberately neutral across contexts: the hook is the error
 * kind, not the feature the user was touching. If a surface needs
 * stronger context ("Sign in to open your notebook"), it should render
 * its own leading text and then fall back to this for the second line.
 */

export type ClientError = AuthError | NotebookError;

export function messageFor(error: ClientError): string {
  switch (error.kind) {
    case "invalid_email":
      return "Please enter a valid email address.";
    case "rate_limited":
      return "A login link was already sent. Try again in a moment.";
    case "invalid_token":
      return "That sign-in link didn't work. Request a new one.";
    case "unauthenticated":
      return "Please sign in to continue.";
    case "not_found":
    case "invalid_payload":
    case "server":
      return "Something went wrong on our end. Please try again.";
    case "network":
      return "Couldn't reach the server. Check your connection and try again.";
  }
}
