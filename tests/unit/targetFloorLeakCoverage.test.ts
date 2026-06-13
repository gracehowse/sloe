/**
 * ENG-793 floor-leak COVERAGE guard (structural, both platforms).
 *
 * The sex-aware safety floor must clamp EVERY live effective-target read so a
 * stored sub-floor value (e.g. 901) can never reach a user-facing surface. The
 * helper itself is unit-tested in `targetFloorLeakClamp.test.ts`; this spec pins
 * the call SITES — an adversarial nutrition-engine review (2026-06-13) found the
 * mobile Progress tab read `target_calories` raw, bypassing the clamp and
 * breaking web↔mobile parity. These source assertions stop any of the live read
 * paths silently dropping the clamp again.
 *
 * It does NOT assert the clamp on the derive/write layer or on past-day
 * snapshots — those are deliberately UNclamped (soft-warn-not-block + no history
 * rewrite); see `docs/decisions/2026-06-13-target-floor-leak-clamp.md`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

const CALC_TARGETS = read("apps/mobile/lib/calcTargets.ts");
const PROGRESS = read("apps/mobile/app/(tabs)/progress.tsx");
const APP_DATA = read("src/context/AppDataContext.tsx");
const DERIVE = read("src/lib/nutrition/goalPaceRetune.ts");
const SNAPSHOT = read("src/lib/nutrition/dailyTargetRead.ts");

describe("ENG-793 — every live effective-target read clamps to the safety floor", () => {
  it("mobile resolveTargets clamps the explicit stored calories", () => {
    expect(CALC_TARGETS).toMatch(/clampTargetToSafetyFloor\(\s*Math\.round\(cal\)/);
    expect(CALC_TARGETS).toMatch(/from "@suppr\/shared\/onboarding\/targets"/);
  });

  it("mobile Progress tab clamps its raw target_calories read (the gap the review found)", () => {
    expect(PROGRESS).toMatch(/clampTargetToSafetyFloor\(/);
    expect(PROGRESS).toMatch(/coerceSex\(profile\.sex/);
  });

  it("web AppDataContext clamps both DB reads and the local-cache fallbacks", () => {
    // Both DB SELECTs fetch sex.
    expect(APP_DATA.match(/measurement_system, sex, target_calories/g)?.length).toBe(2);
    // DB reads clamp via coerceSex(data.sex); local fallbacks clamp via local.sex.
    expect(APP_DATA).toMatch(/clampTargetToSafetyFloor\(\s*data!\.target_calories/);
    expect(APP_DATA).toMatch(/clampTargetToSafetyFloor\(local\.targets\.calories, local\.sex\)/);
  });
});

describe("ENG-793 — the clamp must NOT touch derive/write or past-day snapshots", () => {
  it("deriveTargets stays unclamped (soft-warn-not-block preserved)", () => {
    expect(DERIVE).not.toMatch(/clampTargetToSafetyFloor/);
  });

  it("the past-day snapshot resolver stays unclamped (no retroactive history rewrite)", () => {
    expect(SNAPSHOT).not.toMatch(/clampTargetToSafetyFloor/);
  });
});
