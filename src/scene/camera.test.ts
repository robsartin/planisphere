/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it, vi } from "vitest";
import type { Camera } from "cesium";
import { initCamera } from "./camera";

vi.mock("cesium", () => ({
  Cartesian3: { fromDegrees: vi.fn().mockReturnValue({ x: 0, y: 0, z: 0 }) },
  Math: { toRadians: (deg: number) => (deg * Math.PI) / 180 },
}));

function makeCamera(): { mock: Camera; setView: ReturnType<typeof vi.fn> } {
  const setView = vi.fn();
  const mock = { setView } as unknown as Camera;
  return { mock, setView };
}

describe("initCamera", () => {
  it("calls setView with the observer's position looking up", () => {
    const { mock, setView } = makeCamera();
    initCamera(mock, 33.0, -117.0);
    expect(setView).toHaveBeenCalledOnce();
    const [args] = setView.mock.calls[0] as [Record<string, unknown>];
    expect(args).toHaveProperty("destination");
    expect(args).toHaveProperty("orientation");
  });

  it("orientation pitch points upward (negative = looking up in Cesium)", () => {
    const { mock, setView } = makeCamera();
    initCamera(mock, 40.0, -74.0);
    const [args] = setView.mock.calls[0] as [{ orientation: { pitch: number } }];
    expect(args.orientation.pitch).toBeLessThan(0);
  });
});
