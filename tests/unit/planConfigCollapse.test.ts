/**
 * ENG-1092 increment 3 — web Plan config collapse.
 *
 * The always-open Plan-length / Slots / Start chip rows collapse behind ONE
 * "Adjust plan" popover (web parity catch-up to mobile, which already condenses
 * these into chips). Structural change → flag-gated, default-OFF until Grace
 * red-lines, with the legacy inline rows kept alive in the `else`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");

describe("ENG-1092 inc 3 — web Plan config collapse", () => {
  const WEB = read("src/app/components/MealPlanner.tsx");
  const FLAGS = read("src/lib/analytics/track.ts");

  it("gates the collapse on plan_adjust_collapsed_v1 with the legacy rows alive in the else", () => {
    expect(WEB).toMatch(/isFeatureEnabled\("plan_adjust_collapsed_v1"\)/);
    // the collapsed control + its popover
    expect(WEB).toMatch(/planner-adjust-plan/);
    expect(WEB).toMatch(/PopoverTrigger/);
    expect(WEB).toMatch(/PopoverContent/);
    // the legacy inline rows are still rendered when the flag is off
    expect(WEB).toMatch(/if \(!planAdjustCollapsed\) return configRows;/);
    expect(WEB).toMatch(/planner-day-count-row/);
    expect(WEB).toMatch(/planner-slot-toggles-row/);
    expect(WEB).toMatch(/planner-start-date-row/);
  });

  it("is default-OFF — not in REDESIGN_DEFAULT_ON (Grace ramps after red-line)", () => {
    const start = FLAGS.indexOf("REDESIGN_DEFAULT_ON");
    const setBlock = FLAGS.slice(start, FLAGS.indexOf("]);", start));
    expect(setBlock).not.toMatch(/plan_adjust_collapsed_v1/);
  });
});
