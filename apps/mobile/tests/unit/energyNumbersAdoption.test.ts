import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * ENG-1506 adoption pins (parity-of-import style, per
 * `resolveMaintenanceAdoption.test.ts` / `weightChartRangeFilter.test.ts`).
 *
 * The 2026-07-11 audit's root cause was INPUT drift: surfaces called the
 * shared resolver with hand-assembled, divergent inputs (snapshot weight
 * vs latest weigh-in; strict vs defaulted basics). These pins require
 * every maintenance surface to import `selectMaintenance` from the
 * canonical energyNumbers module (mobile via `@suppr/nutrition-core`),
 * so a future PR that re-rolls local input assembly fails loudly.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");

function read(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), "utf8");
}

const MOBILE_SURFACES = [
  "apps/mobile/app/(tabs)/_today/TodayScreen.tsx",
  "apps/mobile/app/(tabs)/progress.tsx",
  "apps/mobile/app/targets.tsx",
  "apps/mobile/app/burn-detail.tsx",
];

const WEB_SURFACES = [
  "src/lib/nutrition/useNutritionTrackerProfile.ts",
  "src/app/components/ProgressDashboard.tsx",
  "src/app/components/Targets.tsx",
];

describe("energyNumbers adoption (ENG-1506 parity pins)", () => {
  it.each(MOBILE_SURFACES)("%s imports selectMaintenance from @suppr/nutrition-core/energyNumbers", (path) => {
    const src = read(path);
    expect(src).toMatch(/from ["']@suppr\/nutrition-core\/energyNumbers["']/);
    expect(src).toContain("selectMaintenance");
    expect(src).toContain("ENERGY_NUMBERS_V1_FLAG");
  });

  it.each(WEB_SURFACES)("%s imports selectMaintenance from the shared energyNumbers module", (path) => {
    const src = read(path);
    expect(src).toMatch(/from ["'][^"']*energyNumbers(?:\.ts)?["']/);
    expect(src).toContain("selectMaintenance");
    expect(src).toContain("ENERGY_NUMBERS_V1_FLAG");
  });

  it("both Progress screens feed the Expenditure card from the resolved maintenance", () => {
    for (const path of ["apps/mobile/app/(tabs)/progress.tsx", "src/app/components/ProgressDashboard.tsx"]) {
      const src = read(path);
      expect(src).toContain("expenditureFromResolved(recapMaintenance, adaptiveUpdatedAt)");
    }
  });

  it("both Progress Maintenance cards reuse recapMaintenance (no second inline resolve)", () => {
    for (const path of ["apps/mobile/app/(tabs)/progress.tsx", "src/app/components/ProgressDashboard.tsx"]) {
      const src = read(path);
      expect(src).toContain("const resolved = recapMaintenance;");
    }
  });

  it("the nutrition-core mirrors exist so Metro resolves the shared modules", () => {
    expect(read("src/lib/nutrition-core/energyNumbers.ts")).toContain(
      'export * from "../nutrition/energyNumbers"',
    );
    expect(read("src/lib/nutrition-core/goalVocabulary.ts")).toContain(
      'export * from "../nutrition/goalVocabulary"',
    );
  });

  it("energy_numbers_v1 is registered DEFAULT-OFF on both platforms", () => {
    const webFlags = read("src/lib/analytics/track.ts");
    const mobileFlags = read("apps/mobile/lib/analytics.ts");
    for (const src of [webFlags, mobileFlags]) {
      expect(src).toMatch(
        /KNOWN_DEFAULT_OFF_FLAGS = \[[\s\S]*?"energy_numbers_v1"[\s\S]*?\] as const;/,
      );
      // Never in the default-ON set — the rollout is PostHog-ramped.
      const onBlock = src.slice(
        src.indexOf("REDESIGN_DEFAULT_ON = new Set<string>(["),
        src.indexOf("]);", src.indexOf("REDESIGN_DEFAULT_ON = new Set<string>([")),
      );
      expect(onBlock).not.toContain("energy_numbers_v1");
    }
  });

  it("the four WhyThisNumber hosts route goals through the shared normaliser", () => {
    for (const path of [
      "apps/mobile/app/(tabs)/_today/TodayScreen.tsx",
      "apps/mobile/app/targets.tsx",
      "src/app/components/NutritionTracker.tsx",
      "src/app/components/Targets.tsx",
    ]) {
      const src = read(path);
      expect(src).toContain("whyThisNumberGoalFromDb(");
      // The old inline unknown→"lose" collapse must be gone.
      expect(src).not.toMatch(/\? "maintain"\s*\n?\s*: "lose"/);
    }
  });
});
