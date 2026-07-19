/**
 * ENG-1492 — mobile plan persists the KNOWN `start_date` anchor.
 *
 * `persistPlan` previously re-derived `start_date` from wall-clock + the
 * `startOffset` chip on EVERY save. The chip resets to 0 each session, so a
 * mid-week meal swap silently re-anchored the plan to today — shifting every
 * log-as-planned calendar date (the ENG-1132 hazard; web twin ENG-1491,
 * pinned in `tests/unit/planWeekEyebrowAnchor.test.ts`).
 *
 * Contract pinned here (source pins — repo convention for the planner
 * screen), hardened by an adversarial mutation pass:
 *   - all anchor writes flow through `adoptPlanStartDate` (ref + state in
 *     lockstep, adoption at DISPATCH so concurrent edits read the anchor an
 *     in-flight save is writing);
 *   - edits preserve the anchor; wall-clock+chip only on explicit
 *     `reanchor` (full replacements: plan import, template apply);
 *   - legacy pre-anchor-column plans fall back to plain today (web parity);
 *   - keep-locked partial regen preserves; full regenerate re-anchors;
 *   - the anchor resets on slot switch (no cross-slot leakage) and hydrates
 *     from the cloud row;
 *   - planner.tsx stays the ONLY save_meal_plan call site on mobile.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE_ROOT = resolve(__dirname, "../..");
const PLANNER = readFileSync(
  resolve(MOBILE_ROOT, "app/(tabs)/planner.tsx"),
  "utf8",
);

describe("mobile plan persist — ENG-1492 anchor contract", () => {
  it("persistPlan: edits preserve the known anchor; chip only on reanchor; legacy fallback is plain today (web parity)", () => {
    expect(PLANNER).toMatch(
      /const startDate = opts\?\.reanchor\s*\n?\s*\? startDateForOffset\(new Date\(\), startOffset\)\s*\n?\s*: \(planStartDateRef\.current \?\? startDateForOffset\(new Date\(\), 0\)\);/,
    );
  });

  it("both RPC payloads bind p_start_date to the resolved anchor variable", () => {
    expect((PLANNER.match(/p_start_date: startDate,/g) ?? []).length).toBe(2);
  });

  it("exactly two reanchor callers exist: plan import + template apply", () => {
    expect((PLANNER.match(/\{ reanchor: true \}/g) ?? []).length).toBe(2);
    expect(PLANNER).toMatch(/an imported week is a full replacement: re-anchor/);
    expect(PLANNER).toMatch(/a template apply replaces the whole week: re-anchor/);
  });

  it("keep-locked partial regen preserves the anchor; full regenerate re-anchors", () => {
    expect(PLANNER).toMatch(
      /const startDate = keepLockedActive\s*\n?\s*\? \(planStartDateRef\.current \?\? startDateForOffset\(new Date\(\), startOffset\)\)\s*\n?\s*: startDateForOffset\(new Date\(\), startOffset\);/,
    );
  });

  it("anchor adoption happens at dispatch in both write paths, and nowhere else writes state directly", () => {
    expect((PLANNER.match(/adoptPlanStartDate\(startDate\);/g) ?? []).length).toBe(2);
    // Every write flows through the adopter: the only raw setPlanStartDate
    // call is inside adoptPlanStartDate itself.
    expect((PLANNER.match(/setPlanStartDate\(/g) ?? []).length).toBe(1);
  });

  it("the anchor resets on slot switch and hydrates from the cloud row", () => {
    expect(PLANNER).toMatch(/adoptPlanStartDate\(null\);/);
    expect(PLANNER).toMatch(
      /adoptPlanStartDate\(\s*typeof anchorRaw === "string" && anchorRaw\.length >= 10\s*\? anchorRaw\.slice\(0, 10\)\s*: null,?\s*\);/,
    );
  });

  it("closure-staleness guards: persistPlan and generatePlan dep arrays carry what their write paths read", () => {
    expect(PLANNER).toMatch(/\[userId, startOffset, activePlanSlotId, adoptPlanStartDate\],/);
    // generatePlan's inline persist derives from the chip + slot — both in deps.
    // ENG-1344 appended `toast.showToast` (the flag-gated Alert-to-toast
    // migration's stable dependency) after `adoptPlanStartDate`.
    expect(PLANNER).toMatch(
      /planCalorieFloor, startOffset, activePlanSlotId, adoptPlanStartDate, toast\.showToast\]\);/,
    );
  });

  it("planner.tsx is the ONLY mobile save_meal_plan call site (new call sites must adopt the anchor contract consciously)", () => {
    const files = ["app", "components", "hooks", "lib"].flatMap((dir) =>
      readdirSync(join(MOBILE_ROOT, dir), { recursive: true, withFileTypes: false })
        .map(String)
        .filter((f) => /\.(ts|tsx)$/.test(f))
        .map((f) => join(MOBILE_ROOT, dir, f)),
    );
    const callers = files.filter((f) =>
      /\.rpc\(\s*"save_meal_plan"/.test(readFileSync(f, "utf8")),
    );
    expect(callers.map((f) => f.replace(`${MOBILE_ROOT}/`, ""))).toEqual([
      "app/(tabs)/planner.tsx",
    ]);
  });
});
