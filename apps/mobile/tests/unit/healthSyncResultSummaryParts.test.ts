/**
 * ENG-1584 — `healthSyncResultSummaryParts` (`lib/healthSync.ts`).
 *
 * Extracted out of `apps/mobile/app/health-sync.tsx`'s `handleSync` so the
 * screen (a legacy `check:screen-budget`, ENG-717, allow-listed offender
 * that may only shrink) didn't grow by another `if (...) parts.push(...)`
 * line for sleep. Behaviour-level test (not just the structural string
 * pins in `healthSyncSleepWiring.test.ts`) — exercises the actual
 * function against every flag combination that matters.
 */
import { describe, expect, it, vi } from "vitest";

// Same import-side-effect guards `healthSyncQueue.test.ts` uses: healthSync.ts
// constructs a Supabase client and reads expo-constants at module-eval time.
vi.mock("@/lib/supabase", () => ({
  supabase: {},
  hasSupabaseConfig: () => false,
}));
vi.mock("../../lib/supabase", () => ({
  supabase: {},
  hasSupabaseConfig: () => false,
}));
vi.mock("expo-constants", () => ({
  default: {
    executionEnvironment: "standalone",
    appOwnership: "standalone",
    expoConfig: { extra: {} },
  },
  ExecutionEnvironment: {
    Standalone: "standalone",
    StoreClient: "storeClient",
    Bare: "bare",
  },
}));

import { healthSyncResultSummaryParts } from "../../lib/healthSync";

const ALL_FALSE = {
  stepsUpdated: false,
  weightUpdated: false,
  bodyFatUpdated: false,
  activeEnergyUpdated: false,
  workoutsUpdated: false,
  basalBurnUpdated: false,
  sleepUpdated: false,
};

describe("healthSyncResultSummaryParts", () => {
  it("returns [] when nothing updated", () => {
    expect(healthSyncResultSummaryParts(ALL_FALSE)).toEqual([]);
  });

  it("returns every label in HealthCategoryRow order when everything updated", () => {
    const all = Object.fromEntries(
      Object.keys(ALL_FALSE).map((k) => [k, true]),
    ) as typeof ALL_FALSE;
    expect(healthSyncResultSummaryParts(all)).toEqual([
      "steps",
      "weight",
      "body fat",
      "active energy",
      "workouts",
      "resting energy",
      "sleep",
    ]);
  });

  it("folds in 'sleep' alone, same shape as the 'body fat' precedent", () => {
    expect(
      healthSyncResultSummaryParts({ ...ALL_FALSE, sleepUpdated: true }),
    ).toEqual(["sleep"]);
    expect(
      healthSyncResultSummaryParts({ ...ALL_FALSE, bodyFatUpdated: true }),
    ).toEqual(["body fat"]);
  });

  it("includes only the flags that are true, in declaration order, for a mixed result", () => {
    expect(
      healthSyncResultSummaryParts({
        ...ALL_FALSE,
        weightUpdated: true,
        workoutsUpdated: true,
        sleepUpdated: true,
      }),
    ).toEqual(["weight", "workouts", "sleep"]);
  });
});
