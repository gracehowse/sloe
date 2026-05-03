/**
 * Tracking-extras autoupdate (2026-05-02) — parity pin: every meal-log
 * commit path that may carry caffeine / alcohol micros must route the
 * daily bump through the shared `bumpStimulantsForLoggedMeal` /
 * `bumpStimulantsForLoggedMeals` helper, so a future change to the
 * skip-on-zero or rounding rule lands on every platform's log path
 * in one edit.
 *
 * The pin checks that the load-bearing files import the helper. It
 * does not enforce call-shape — TypeScript already validates that via
 * the helper's signature. This is the same pattern used by
 * `stimulantsAutoTrackParity.test.ts`.
 *
 * Closes the documented gaps from `claude/wine-caffeine-netcarbs-fixes`:
 *   - Mobile `insertClonedRowsIntoDay` did not bump the target day
 *     when duplicating a day that contained an espresso / wine.
 *   - Mobile `commitAiLoggedItems` did not forward optional caffeine /
 *     alcohol from the AI item.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..");
function read(rel: string): string {
  return readFileSync(resolve(REPO, rel), "utf8");
}

const SITES: ReadonlyArray<{
  path: string;
  why: string;
  /** Helper symbols at least one of which must appear in the file. */
  mustImport: ReadonlyArray<
    "bumpStimulantsForLoggedMeal" | "bumpStimulantsForLoggedMeals"
  >;
}> = [
  {
    path: "src/context/appData/useNutritionJournalState.ts",
    why: "Web single-meal commit + bulk-insert paths (canonical seam)",
    mustImport: ["bumpStimulantsForLoggedMeal", "bumpStimulantsForLoggedMeals"],
  },
  {
    path: "apps/mobile/app/(tabs)/index.tsx",
    why: "Mobile food-search / history / planned-meal / clone / AI commit paths",
    mustImport: ["bumpStimulantsForLoggedMeal", "bumpStimulantsForLoggedMeals"],
  },
];

describe("bumpStimulantsForLoggedMeal parity pin (2026-05-02)", () => {
  for (const site of SITES) {
    for (const symbol of site.mustImport) {
      it(`${site.path} imports / calls ${symbol} (${site.why})`, () => {
        const src = read(site.path);
        expect(
          src.includes(symbol),
          `${site.path} must import / call ${symbol} so caffeine + alcohol bumps don't drift between log paths.`,
        ).toBe(true);
      });
    }
  }

  it("AiLoggedItem accepts optional caffeineMg + alcoholG (forward-compat plumbing)", () => {
    const src = read("src/lib/nutrition/aiLogging.ts");
    // Both fields must be declared on the canonical AI item type so
    // future API revisions can flow stimulant data into the commit
    // path without a schema change here. Per CLAUDE.md "no invented
    // values" rule, the AI pipeline still has to source them from a
    // deterministic upstream lookup (e.g. genericBeverages.ts) — the
    // type just makes the slot exist.
    expect(src).toMatch(/caffeineMg\?:\s*number/);
    expect(src).toMatch(/alcoholG\?:\s*number/);
  });

  it("mobile insertClonedRowsIntoDay calls bumpStimulantsForLoggedMeals", () => {
    const src = read("apps/mobile/app/(tabs)/index.tsx");
    // Walk forward from `const insertClonedRowsIntoDay = useCallback(`
    // to its closing `, [userId]);` and assert the body mentions the
    // bulk bump helper. Brace counting would be cleanest, but a
    // bounded slice works because the function is short relative to
    // the file.
    const start = src.indexOf("const insertClonedRowsIntoDay = useCallback(");
    expect(start).toBeGreaterThan(-1);
    const slice = src.slice(start, start + 4000);
    expect(slice).toMatch(/bumpStimulantsForLoggedMeals/);
  });

  it("mobile commitAiLoggedItems forwards caffeineMg + alcoholG to micros", () => {
    const src = read("apps/mobile/app/(tabs)/index.tsx");
    const start = src.indexOf("const commitAiLoggedItems = useCallback(");
    expect(start).toBeGreaterThan(-1);
    const slice = src.slice(start, start + 4000);
    // The function must read item.caffeineMg / item.alcoholG and call
    // the bulk bump helper. Both signals confirm the fix lands.
    expect(slice).toMatch(/caffeineMg/);
    expect(slice).toMatch(/alcoholG/);
    expect(slice).toMatch(/bumpStimulantsForLoggedMeals/);
  });

  it("web commitAiLoggedItems forwards caffeineMg + alcoholG to micros", () => {
    const src = read("src/app/components/NutritionTracker.tsx");
    const start = src.indexOf("const commitAiLoggedItems = useCallback(");
    expect(start).toBeGreaterThan(-1);
    const slice = src.slice(start, start + 4000);
    expect(slice).toMatch(/caffeineMg/);
    expect(slice).toMatch(/alcoholG/);
    expect(slice).toMatch(/micros/);
  });
});
