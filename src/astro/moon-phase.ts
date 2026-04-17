/* SPDX-License-Identifier: Apache-2.0 */
import { Body, Illumination, MakeTime } from "astronomy-engine";

export type MoonIllumination = {
  readonly fraction: number;
  readonly phaseAngle: number;
};

export function getMoonIllumination(time: Date): MoonIllumination {
  const astroTime = MakeTime(time);
  const illum = Illumination(Body.Moon, astroTime);
  return {
    fraction: illum.phase_fraction,
    phaseAngle: illum.phase_angle,
  };
}
