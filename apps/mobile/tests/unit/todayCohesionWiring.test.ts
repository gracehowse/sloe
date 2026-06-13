import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ENG-1065 (TF57 F-158 / F-159 / F-178 / F-179) — Today-cohesion source pins.
 *
 * The Today screen (`app/(tabs)/index.tsx`) is far too large to mount in a unit
 * test, so the host-side wiring of the three founder fixes is pinned by reading
 * the source. These break if a future edit unwires the section rhythm, the
 * empty-state flag gate, or the Complete-Day extraction.
 */
const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");

describe("Today cohesion — index.tsx host wiring", () => {
  const src = read("../../app/(tabs)/index.tsx");

  it("F-159: every page-ground section break uses Layout.todaySectionBreak (one rhythm)", () => {
    // Meals, Weekly insight, Planned, Activity, Hydration all introduce on the
    // same 32pt cadence. No section uses a bare Spacing.* margin for its break.
    const breaks = src.match(/marginTop:\s*Layout\.todaySectionBreak/g) ?? [];
    // 5 page-ground sections (Meals / Weekly insight / Planned / Activity /
    // Hydration). The Complete-Day section break lives in its extracted
    // component (TodayCompleteDayButton), not here.
    expect(breaks.length).toBeGreaterThanOrEqual(5);
  });

  it("F-178/F-179: Planned card mounts when populated OR the empty-state flag is on", () => {
    expect(src).toMatch(/plannedMeals\.length > 0 \|\| isFeatureEnabled\("today_planned_empty_state"\)/);
    // The Planned section sits on the standard section break (no longer bare gap).
    expect(src).toMatch(/Section break is the standard `Layout\.todaySectionBreak`/);
  });

  it("F-158: Complete-Day is the extracted <TodayCompleteDayButton>, not an inline floating Pressable", () => {
    expect(src).toMatch(/import \{ TodayCompleteDayButton \}/);
    expect(src).toMatch(/<TodayCompleteDayButton/);
    // The old off-rhythm inline marginTop on the complete-day button is gone.
    expect(src).not.toMatch(/Complete Day<\/Text>\s*<\/Pressable>/);
  });
});

describe("Today cohesion — TodayCompleteDayButton component", () => {
  const src = read("../../components/today/TodayCompleteDayButton.tsx");

  it("F-158: anchors the CTA in a section wrapper on the standard rhythm", () => {
    expect(src).toMatch(/marginTop:\s*Layout\.todaySectionBreak/);
  });

  it("is a SOLID primary CTA via SupprButton (ENG-1079 — was outline)", () => {
    expect(src).toMatch(/<SupprButton[\s\S]{0,120}variant="primary"/);
    expect(src).not.toMatch(/backgroundColor:\s*"transparent"[\s\S]{0,120}borderColor:\s*accent\.primarySolid/);
  });

  it("preserves the HealthKit nutrition auto-export side-effect on press", () => {
    expect(src).toMatch(/isHealthSyncAvailable\(\)/);
    expect(src).toMatch(/exportDayToHealth\(userId, dk\)/);
  });
});
