import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeAdaptiveDataProgressFromMeals } from "@suppr/shared/nutrition/adaptiveDataProgress";

/**
 * ENG-1189 parity pin. The Progress Maintenance card showed
 * `Weigh-ins 10/7` + `Logging days 21/21` ("full") yet still read
 * "Formula estimate · will activate once enough data accumulates" — because
 * the bars counted lifetime any-entry days against the high-confidence /7 + /21
 * tier, while adaptive only engages at MEDIUM confidence over gated full days
 * in the trailing window.
 *
 * Both Progress surfaces must now read the honest gate from the shared
 * `adaptiveDataProgress` helper, and the contradictory copy must be gone. This
 * suite fails loudly if either platform reintroduces the lie or rolls its own
 * inline count.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");

function read(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), "utf8");
}

describe("adaptiveDataProgress adoption (ENG-1189 parity pin)", () => {
  it("web Progress imports + calls the shared honest-progress helper", () => {
    const src = read("src/app/components/ProgressDashboard.tsx");
    expect(src).toMatch(/from ["'][^"']*adaptiveDataProgress(?:\.ts)?["']/);
    expect(src).toContain("computeAdaptiveDataProgressFromMeals(");
  });

  it("mobile Progress imports + calls the shared honest-progress helper", () => {
    const src = read("apps/mobile/app/(tabs)/progress.tsx");
    expect(src).toMatch(/from ["'][^"']*adaptiveDataProgress["']/);
    expect(src).toContain("computeAdaptiveDataProgressFromMeals(");
  });

  it("the contradictory 'once enough data accumulates' copy is gone (both surfaces)", () => {
    expect(read("src/app/components/ProgressDashboard.tsx")).not.toMatch(
      /will activate once enough data accumulates/i,
    );
    expect(read("apps/mobile/app/(tabs)/progress.tsx")).not.toMatch(
      /will activate once enough data accumulates/i,
    );
  });

  it("the hardcoded high-confidence /7 + /21 denominators are gone on web", () => {
    const src = read("src/app/components/ProgressDashboard.tsx");
    // The old literal denominators rendered as `}/7` and `}/21` next to the
    // count expressions. The new path reads `adaptiveProgress.*Target`.
    expect(src).not.toContain("Object.keys(weightKgByDay).length}/7");
    expect(src).not.toMatch(/length}\/21/);
    expect(src).toContain("adaptiveProgress.weighInsTarget");
    expect(src).toContain("adaptiveProgress.loggingDaysTarget");
  });
});

describe("adaptiveDataProgress runs in the mobile runtime (cross-platform consistency)", () => {
  function recentDays(count: number): string[] {
    const days: string[] = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      days.push(`${y}-${m}-${day}`);
    }
    return days;
  }

  it("engages at the medium-confidence bar (14 full days + 5 weigh-ins)", () => {
    const mealsByDay: Record<string, { calories: number }[]> = {};
    recentDays(14).forEach((d) => {
      mealsByDay[d] = [{ calories: 700 }, { calories: 700 }, { calories: 700 }];
    });
    const weightByDay: Record<string, number> = {};
    recentDays(5).forEach((d) => (weightByDay[d] = 80));

    const p = computeAdaptiveDataProgressFromMeals({
      mealsByDay,
      weightByDay,
      sex: "female",
      weightKg: 60,
      heightCm: 165,
      age: 30,
    });
    expect(p.loggingDaysTarget).toBe(14);
    expect(p.weighInsTarget).toBe(5);
    expect(p.ready).toBe(true);
  });
});
