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

describe("ENG-1506 review round — flag-gated write paths + honest flag-ON states", () => {
  it("both goal-editor hooks pass weightKgByDay into the recompute ONLY behind energy_numbers_v1", () => {
    // Blocker 1: flag-OFF previews AND persisted targets must be
    // byte-identical to the pre-ENG-1506 recompute. The latest-weigh-in
    // baseline only feeds `recomputeTargetsFromProfile` when the flag is
    // ON and the user hasn't explicitly edited weight.
    for (const path of [
      "apps/mobile/components/recap/useGoalPaceEditor.ts",
      "src/app/components/suppr/useGoalPaceEditorDialog.ts",
    ]) {
      const src = read(path);
      expect(src).toMatch(
        /weightKgByDay:\s*\n\s*isFeatureEnabled\(ENERGY_NUMBERS_V1_FLAG\) && editedWeightKg == null\s*\n\s*\? loaded\.weightKgByDay\s*\n\s*: null/,
      );
      // The ungated pass must never come back.
      expect(src).not.toMatch(
        /weightKgByDay:\s*editedWeightKg != null \? null : loaded\.weightKgByDay/,
      );
      // Blocker 2: the past-day backfill's input policy rides the same flag.
      expect(src).toContain(
        "canonicalEnergyInputs: isFeatureEnabled(ENERGY_NUMBERS_V1_FLAG)",
      );
    }
  });

  it("every daily-target snapshot call site threads the host-read flag into canonicalEnergyInputs", () => {
    // Blocker 2: `daily_targets` rows are frozen first-write-wins — a
    // flag-OFF write must use the exact legacy input assembly. The shared
    // writer can't read the flag (netEnergyBalance host-owns-the-flag
    // pattern), so EVERY caller passes it.
    const callers = [
      "apps/mobile/app/(tabs)/_today/TodayScreen.tsx",
      "apps/mobile/app/(tabs)/barcode.tsx",
      "apps/mobile/app/(tabs)/planner.tsx",
      "apps/mobile/app/recipe/[id].tsx",
      "apps/mobile/hooks/useNutritionEntriesSync.ts",
      "src/context/appData/useNutritionJournalState.ts",
    ];
    for (const path of callers) {
      const src = read(path);
      const calls = src.match(/snapshotDailyTargetIfMissing\(supabase,/g) ?? [];
      // The flag read is the constant where the file already imports it,
      // else the registered literal (both resolve identically).
      const gated = src.match(
        /snapshotDailyTargetIfMissing\(supabase, (?:userId|authedUserId), \{ canonicalEnergyInputs: isFeatureEnabled\((?:ENERGY_NUMBERS_V1_FLAG|"energy_numbers_v1")\) \}\)/g,
      ) ?? [];
      expect(calls.length).toBeGreaterThan(0);
      expect(gated.length).toBe(calls.length);
    }
    // Backfill callers thread it too.
    for (const path of [
      "apps/mobile/components/recap/GoalPaceRetuneSheet.tsx",
      "src/app/components/Settings.tsx",
    ]) {
      const src = read(path);
      expect(src).toMatch(
        /canonicalEnergyInputs: isFeatureEnabled\((?:ENERGY_NUMBERS_V1_FLAG|"energy_numbers_v1")\)/,
      );
    }
  });

  it("the shared writers keep the exact legacy assembly in the flag-OFF branch", () => {
    const writer = read("src/lib/nutrition/dailyTargetSnapshot.ts");
    // Canonical path is opt-in…
    expect(writer).toMatch(/canonicalEnergyInputs\s*\n?\s*\? buildMaintenanceInputs\(profile\)/);
    // …and the legacy else-branch survives until flag-collapse.
    expect(writer).toContain('typeof profile.weight_kg === "number" ? profile.weight_kg : null');
    // persistRecomputedTargets passes the host flag through to the backfill.
    const persist = read("src/lib/nutrition/persistRecomputedTargets.ts");
    expect(persist).toContain("canonicalEnergyInputs: input.canonicalEnergyInputs");
  });

  it("the server weekly-recap route stays fully legacy (deferred to flag-collapse)", () => {
    const route = read("app/api/push/weekly-recap/route.ts");
    // No import, no call — the only mention allowed is the deferred-work
    // comment (the route can't read the client flag).
    expect(route).not.toContain("buildMaintenanceInputs(");
    expect(route).not.toMatch(/import[^;]*buildMaintenanceInputs/);
    expect(route).toContain("deferred to flag-collapse: see ENG-1506 review");
  });

  it("flag-ON with a null resolver result never falls back to the rejected raw read (Targets)", () => {
    const mobileTargets = read("apps/mobile/app/targets.tsx");
    // The MAINTENANCE numeral renders an em-dash flag-ON-null…
    expect(mobileTargets).toContain(
      'energyNumbersOn ? (resolvedMaint?.kcal != null ? resolvedMaint.kcal.toLocaleString() : "—") : (adaptiveTdee ?? tdeeKcal).toLocaleString()',
    );
    // …and the old resolver-null → raw fallback is gone.
    expect(mobileTargets).not.toContain("resolvedMaint?.kcal ?? adaptiveTdee ?? tdeeKcal");
    const webTargets = read("src/app/components/Targets.tsx");
    expect(webTargets).toContain(
      "maintenanceTdee={energyNumbersOn ? (resolvedMaint?.kcal ?? null) : maintenanceTdee}",
    );
    expect(webTargets).not.toContain("resolvedMaint ? resolvedMaint.kcal : maintenanceTdee");
  });

  it("mobile Today's WhyThisNumberSheet reads the RESOLVED confidence flag-ON (parity with web + Targets)", () => {
    const src = read("apps/mobile/app/(tabs)/_today/TodayScreen.tsx");
    expect(src).toMatch(
      /confidence=\{[\s\S]{0,700}?isFeatureEnabled\(ENERGY_NUMBERS_V1_FLAG\)\s*\n\s*\? \(resolvedMaintenance\?\.confidence \?\? null\)/,
    );
  });

  it("the WhyThisNumber hosts thread the resolved SOURCE flag-ON only (honest formula wording)", () => {
    for (const [path, pattern] of [
      ["apps/mobile/app/(tabs)/_today/TodayScreen.tsx", /source=\{[\s\S]{0,400}?resolvedMaintenance\?\.source \?\? null/],
      ["apps/mobile/app/targets.tsx", /source=\{energyNumbersOn \? \(resolvedMaint\?\.source \?\? null\) : null\}/],
      ["src/app/components/Targets.tsx", /source=\{energyNumbersOn \? \(resolvedMaint\?\.source \?\? null\) : null\}/],
      ["src/app/components/NutritionTracker.tsx", /source=\{isFeatureEnabled\("energy_numbers_v1"\) \? profileMaintenanceSource : null/],
    ] as const) {
      expect(read(path)).toMatch(pattern);
    }
  });

  it("the trajectory/projection hosts thread normalizeGoalVocabulary from the flag", () => {
    for (const path of [
      "src/app/components/ProgressDashboard.tsx",
      "src/app/components/suppr/today-complete-day-dialog.tsx",
      "src/app/components/suppr/trajectory-card.tsx",
      "app/pricing/PaywallTrajectoryChart.tsx",
      "apps/mobile/app/(tabs)/progress.tsx",
      "apps/mobile/components/today/TodayCompleteDayModal.tsx",
      "apps/mobile/components/progress/TrajectoryCard.tsx",
      "apps/mobile/components/paywall/PaywallTrajectoryChart.tsx",
    ]) {
      expect(read(path)).toContain(
        "normalizeGoalVocabulary: isFeatureEnabled(ENERGY_NUMBERS_V1_FLAG)",
      );
    }
  });
});
