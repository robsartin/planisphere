/* SPDX-License-Identifier: Apache-2.0 */
/**
 * Vitest setup file.
 *
 * jsdom 25 does not implement `HTMLCanvasElement.getContext` — calling it
 * logs "Not implemented" to stderr via jsdom's virtual console and returns
 * `undefined`. That return value is already handled correctly by our
 * production code (scene layers bail out when `getContext` returns falsy),
 * but the log spam makes `pnpm test` output unreadable.
 *
 * We replace the method with a Proxy-backed no-op 2D context so nothing
 * logs and calls succeed silently. The stub intentionally does not paint
 * pixels — any test that actually needs canvas output should mock at the
 * component boundary, not here.
 */

function makeMockContext2D(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const gradient = { addColorStop: (): void => {} };
  const pattern = {};
  const state: Record<string | symbol, unknown> = { canvas };
  const defaults: Record<string, unknown> = {
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createConicGradient: () => gradient,
    createPattern: () => pattern,
    getImageData: () => ({ data: new Uint8ClampedArray() }),
    measureText: () => ({ width: 0 }),
    isPointInPath: () => false,
    isPointInStroke: () => false,
  };
  const handler: ProxyHandler<Record<string | symbol, unknown>> = {
    get(_target, prop) {
      if (prop in state) return state[prop];
      if (prop in defaults) return defaults[prop as string];
      // Any other property read — treat as a no-op method. Returning a
      // function is safe because method-style calls discard the value
      // and property reads for things like `fillStyle` are handled by
      // the setter path (set trap writes to `state`).
      return (): void => {};
    },
    set(_target, prop, value) {
      state[prop] = value;
      return true;
    },
  };
  return new Proxy({}, handler) as unknown as CanvasRenderingContext2D;
}

HTMLCanvasElement.prototype.getContext = function getContext(
  this: HTMLCanvasElement,
  contextId: string,
): RenderingContext | null {
  if (contextId === "2d") return makeMockContext2D(this);
  return null;
} as HTMLCanvasElement["getContext"];
