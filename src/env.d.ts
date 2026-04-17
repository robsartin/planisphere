/* SPDX-License-Identifier: Apache-2.0 */
/// <reference types="vite/client" />

declare module "*.txt?raw" {
  const content: string;
  export default content;
}
