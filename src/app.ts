/* SPDX-License-Identifier: Apache-2.0 */

export function bootstrap(root: HTMLElement | null): void {
  if (!root) return;
  root.textContent = "Planisphere — foundation online.";
}
