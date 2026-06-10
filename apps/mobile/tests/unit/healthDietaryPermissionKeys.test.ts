/**
 * Pins dietary import permission keys to react-native-health's supported set.
 * Unknown keys passed to initHealthKit can crash the native bridge on device.
 */
import { describe, expect, it } from "vitest";
// react-native-health ships no .d.ts for the deep constants path — this is the
// raw runtime JS map of HealthKit permission keys (intentionally imported
// directly so the pin doesn't depend on the native module).
// @ts-expect-error untyped deep import (runtime JS only)
import { Permissions } from "react-native-health/src/constants/Permissions";

import {
  HEALTH_DIETARY_CORE_PERMISSION_KEYS,
  HEALTH_DIETARY_IMPORT_PERMISSION_KEYS,
} from "@/lib/healthDietaryNutrients";

const supported = new Set(Object.values(Permissions));

describe("HEALTH_DIETARY_IMPORT_PERMISSION_KEYS", () => {
  it("only includes keys react-native-health can authorize", () => {
    const unknown = HEALTH_DIETARY_IMPORT_PERMISSION_KEYS.filter((k) => !supported.has(k));
    expect(unknown).toEqual([]);
  });

  it("does not request Chromium (unsupported — caused HS connect crash 2026-06-05)", () => {
    expect(HEALTH_DIETARY_IMPORT_PERMISSION_KEYS).not.toContain("Chromium");
  });

  it("keeps initHealthKit core set small (MFP meal import)", () => {
    expect(HEALTH_DIETARY_CORE_PERMISSION_KEYS.length).toBeLessThanOrEqual(8);
    for (const k of HEALTH_DIETARY_CORE_PERMISSION_KEYS) {
      expect(supported.has(k)).toBe(true);
    }
  });
});
