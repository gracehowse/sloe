/**
 * ENG-1540 — "today" must be seeded from the LOCAL calendar day, not UTC.
 *
 * `nutrition_entries.date_key` / `household_meals.date_key` are written from
 * the user's LOCAL day (`dateKeyFromDate(new Date())`). Three readers seeded
 * "today" with `new Date().toISOString().slice(0, 10)` / the UTC persistence
 * `dateKey`, which is the UTC calendar day — so for users behind UTC in the
 * evening it selected the wrong day (Americas-evening regression):
 *   - src/context/AppDataContext.tsx        (selectedDateKey seed)
 *   - src/app/components/HouseholdPanel.tsx  (household today/upcoming filter)
 *   - apps/mobile/components/HouseholdCard.tsx (mobile twin — parity)
 *
 * This pins the fix AND bans the anti-pattern from re-appearing.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(resolve(ROOT, rel), "utf8");

/** The precise anti-pattern: slicing a *fresh* `new Date()`'s ISO string to a
 *  day = "today from UTC". This does NOT match:
 *   - full-timestamp writes (`new Date().toISOString()` with no `.slice`),
 *   - the deliberate UTC persistence helper (`d.toISOString().slice(...)`,
 *     a parameter — see src/context/appData/persistence.ts, kept on purpose),
 *   - comments referencing the pattern (no `new Date().` immediately before). */
const UTC_TODAY_KEY = /new Date\(\)\.toISOString\(\)\.slice\(/;

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) acc.push(full);
  }
  return acc;
}

describe("ENG-1540 local date-key regression", () => {
  it("the three fixed sites seed today via the LOCAL dateKeyFromDate helper", () => {
    const appData = read("src/context/AppDataContext.tsx");
    expect(appData).toMatch(/from ["']@\/lib\/datetime\/dateKey["']/);
    expect(appData).toContain("dateKeyFromDate(new Date())");

    const panel = read("src/app/components/HouseholdPanel.tsx");
    expect(panel).toMatch(/from ["']\.\.\/\.\.\/lib\/datetime\/dateKey["']/);
    expect(panel).toContain("dateKeyFromDate(new Date())");

    const card = read("apps/mobile/components/HouseholdCard.tsx");
    expect(card).toMatch(/from ["']@suppr\/shared\/datetime\/dateKey["']/);
    expect(card).toContain("dateKeyFromDate(new Date())");
  });

  it("bans `new Date().toISOString().slice(` (UTC today-key) in src/context + src/app/components", () => {
    const dirs = ["src/context", "src/app/components"];
    const offenders: string[] = [];
    for (const dir of dirs) {
      for (const file of walk(resolve(ROOT, dir))) {
        if (UTC_TODAY_KEY.test(readFileSync(file, "utf8"))) {
          offenders.push(file.slice(ROOT.length + 1));
        }
      }
    }
    expect(offenders, `UTC today-key anti-pattern found in: ${offenders.join(", ")}`).toEqual([]);
  });
});
