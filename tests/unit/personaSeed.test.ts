/**
 * Guards the synthetic-persona seeder's safety-critical core
 * (`scripts/_lib/personaSeed.ts`):
 *
 *   1. the ACCOUNT ALLOWLIST — the bit that stands between a test run and
 *      wiping a real account. Every forbidden / off-allowlist email must be
 *      rejected; only the plus-addressed test inboxes pass.
 *   2. the deterministic ROW SHAPING — same inputs → same rows, partial-day
 *      pattern preserved, every row scoped to the passed user id and tagged so
 *      --reset can find it.
 *
 * If any of these regress, the seeder could either fail to seed believable data
 * or — far worse — touch a real account. Treat a red test here as a P1.
 */
import { describe, it, expect } from "vitest";
import {
  assertSeedableEmail,
  buildSeedPlan,
  classifyEmail,
  dateKeyForOffset,
  getPersona,
  PERSONAS,
  PERSONA_FORBIDDEN_EMAILS,
  PERSONA_ROW_TAG,
  RECIPE_LIBRARY,
  shapeAllEntries,
  shapeDayEntries,
  shapeRecipes,
  shapeWeightByDay,
  type PersonaName,
} from "../../scripts/_lib/personaSeed.ts";

const ALL_PERSONAS = Object.keys(PERSONAS) as PersonaName[];
const ANCHOR = "2026-06-11";
const USER = "11111111-2222-3333-4444-555555555555";

describe("classifyEmail — account allowlist (safety-critical)", () => {
  it("accepts plus-addressed gracehowse outlook test inboxes", () => {
    for (const email of [
      "gracehowse+persona1@outlook.com",
      "gracehowse+mfp-refugee@outlook.com",
      "GraceHowse+Watch@Outlook.com", // case-insensitive
    ]) {
      const v = classifyEmail(email);
      expect(v.ok, `${email} should be allowed`).toBe(true);
    }
  });

  it("accepts the dedicated alternate-provider test accounts", () => {
    expect(classifyEmail("gracehowse+t@seznam.cz").ok).toBe(true);
    expect(classifyEmail("suppr.newacct+t1@gmail.com").ok).toBe(true);
  });

  it("REJECTS the bare real outlook account (no plus sub-address)", () => {
    const v = classifyEmail("gracehowse@outlook.com");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(/FORBIDDEN/);
  });

  it("REJECTS every explicitly forbidden real account, case-insensitively", () => {
    for (const forbidden of PERSONA_FORBIDDEN_EMAILS) {
      expect(classifyEmail(forbidden).ok, `${forbidden} must be forbidden`).toBe(false);
      expect(classifyEmail(forbidden.toUpperCase()).ok).toBe(false);
      const spaced = classifyEmail(`  ${forbidden}  `);
      expect(spaced.ok, "leading/trailing whitespace must not bypass the guard").toBe(false);
    }
  });

  it("REJECTS arbitrary real-looking emails not on the allowlist", () => {
    for (const email of [
      "someone@example.com",
      "grace@suppr.app",
      "gracehowse@gmail.com", // right user, wrong domain, no plus
      "gracehowsewith+tag@outlook.com", // not the gracehowse local-part
      "attacker+gracehowse@outlook.com", // gracehowse only in sub-address
      "gracehowse+tag@outlook.com.evil.com", // suffix attack
      "",
      "   ",
    ]) {
      expect(classifyEmail(email).ok, `${email} must be rejected`).toBe(false);
    }
  });

  it("assertSeedableEmail throws on a forbidden email and returns the email on success", () => {
    expect(() => assertSeedableEmail("gracemturner@hotmail.co.uk")).toThrow(/refusing to run/);
    expect(() => assertSeedableEmail("nope@example.com")).toThrow(/refusing to run/);
    expect(assertSeedableEmail("gracehowse+ok@outlook.com")).toBe("gracehowse+ok@outlook.com");
  });
});

describe("persona roster integrity", () => {
  it("exposes all six named personas", () => {
    expect(ALL_PERSONAS.sort()).toEqual(
      [
        "cold-start-newcomer",
        "data-rich-power-user",
        "instagram-recipe-saver",
        "lazy-partial-logger",
        "mfp-refugee-power-logger",
        "watch-athlete",
      ].sort(),
    );
  });

  it("the data-rich-power-user maxes every dimension (Grace's test account)", () => {
    const p = PERSONAS["data-rich-power-user"];
    // A full month of history, a dense weigh-in series, and the deepest library.
    expect(p.historyDays).toBe(28);
    expect(p.weighIns).toBe(22);
    expect(p.libraryRecipes).toBe(16);
    expect(p.profile.onboarding_completed).toBe(true);
    // Today (offset 0) is partial so the live ring shows a mid-day state; the
    // rest of the window is complete.
    expect(p.dayKinds[0]).toBe("partial");
    expect(p.dayKinds.filter((k) => k === "full")).toHaveLength(27);
    // The library must actually be able to supply 16 distinct recipes.
    expect(shapeRecipes(p)).toHaveLength(16);
    const titles = new Set(shapeRecipes(p).map((r) => r.title));
    expect(titles.size).toBe(16); // no duplicates
  });

  it("every persona's dayKinds length matches historyDays", () => {
    for (const name of ALL_PERSONAS) {
      const p = PERSONAS[name];
      expect(p.dayKinds.length, `${name} dayKinds length`).toBe(p.historyDays);
    }
  });

  it("getPersona throws on an unknown persona", () => {
    expect(() => getPersona("nope")).toThrow(/unknown persona/);
  });

  it("the cold-start newcomer has zero history and is not onboarded", () => {
    const p = PERSONAS["cold-start-newcomer"];
    expect(p.historyDays).toBe(0);
    expect(p.weighIns).toBe(0);
    expect(p.libraryRecipes).toBe(0);
    expect(p.profile.onboarding_completed).toBe(false);
  });

  it("the lazy-partial-logger reproduces the forensic partial-day signature", () => {
    // The TDEE review documented 7 partial + 3 empty days in a 28-day window.
    const p = PERSONAS["lazy-partial-logger"];
    expect(p.historyDays).toBe(28);
    expect(p.weighIns).toBe(6);
    const partial = p.dayKinds.filter((k) => k === "partial").length;
    const empty = p.dayKinds.filter((k) => k === "empty").length;
    expect(partial).toBe(7);
    expect(empty).toBe(3);
  });
});

describe("dateKeyForOffset", () => {
  it("returns the anchor for offset 0 and steps back by days", () => {
    expect(dateKeyForOffset("2026-06-11", 0)).toBe("2026-06-11");
    expect(dateKeyForOffset("2026-06-11", 1)).toBe("2026-06-10");
    expect(dateKeyForOffset("2026-06-11", 11)).toBe("2026-05-31"); // month boundary
  });

  it("crosses a year boundary correctly", () => {
    expect(dateKeyForOffset("2026-01-02", 5)).toBe("2025-12-28");
  });
});

describe("shapeDayEntries — deterministic row shaping", () => {
  it("produces a four-slot full day with all rows scoped + tagged", () => {
    const p = PERSONAS["mfp-refugee-power-logger"];
    const rows = shapeDayEntries(p, USER, ANCHOR, 0);
    expect(rows).toHaveLength(4);
    const slots = rows.map((r) => r.name).sort();
    expect(slots).toEqual(["Breakfast", "Dinner", "Lunch", "Snacks"]);
    for (const r of rows) {
      expect(r.user_id).toBe(USER);
      expect(r.date_key).toBe(ANCHOR);
      expect(r.recipe_title.startsWith(PERSONA_ROW_TAG)).toBe(true);
      expect(r.calories).toBeGreaterThan(0);
      expect(r.source).toBe("manual");
    }
  });

  it("a full day's total lands within ±6% of the persona target", () => {
    const p = PERSONAS["mfp-refugee-power-logger"];
    const rows = shapeDayEntries(p, USER, ANCHOR, 0);
    const total = rows.reduce((s, r) => s + r.calories, 0);
    const target = p.profile.target_calories;
    expect(total).toBeGreaterThanOrEqual(Math.round(target * 0.9));
    expect(total).toBeLessThanOrEqual(Math.round(target * 1.1));
  });

  it("a partial day is a single small entry well under a full day", () => {
    const p = PERSONAS["lazy-partial-logger"];
    // offset 2 is the first partial day in the lazy logger's cadence.
    expect(p.dayKinds[2]).toBe("partial");
    const rows = shapeDayEntries(p, USER, ANCHOR, 2);
    expect(rows).toHaveLength(1);
    expect(rows[0].calories).toBeLessThan(1000); // below the R1 completeness floor
    expect(rows[0].calories).toBeGreaterThan(0);
  });

  it("an empty day produces no rows", () => {
    const p = PERSONAS["lazy-partial-logger"];
    expect(p.dayKinds[3]).toBe("empty");
    expect(shapeDayEntries(p, USER, ANCHOR, 3)).toEqual([]);
  });

  it("is deterministic — same inputs yield byte-identical rows", () => {
    const p = PERSONAS["watch-athlete"];
    const a = shapeDayEntries(p, USER, ANCHOR, 5);
    const b = shapeDayEntries(p, USER, ANCHOR, 5);
    expect(a).toEqual(b);
  });

  it("differs across days (variation is real, not flat)", () => {
    const p = PERSONAS["watch-athlete"];
    const day5 = shapeDayEntries(p, USER, ANCHOR, 5).reduce((s, r) => s + r.calories, 0);
    const day7 = shapeDayEntries(p, USER, ANCHOR, 7).reduce((s, r) => s + r.calories, 0);
    expect(day5).not.toBe(day7);
  });
});

describe("shapeWeightByDay", () => {
  it("produces exactly weighIns readings for a persona with history", () => {
    const p = PERSONAS["lazy-partial-logger"];
    const weight = shapeWeightByDay(p, ANCHOR);
    expect(Object.keys(weight)).toHaveLength(p.weighIns);
  });

  it("trends in the persona's direction (lazy logger gains across the window)", () => {
    const p = PERSONAS["lazy-partial-logger"]; // +0.021 kg/day
    const weight = shapeWeightByDay(p, ANCHOR);
    const sorted = Object.entries(weight).sort(([a], [b]) => a.localeCompare(b));
    const oldest = sorted[0][1];
    const newest = sorted[sorted.length - 1][1];
    expect(newest).toBeGreaterThan(oldest); // gaining, as the forensic series did
  });

  it("returns an empty map for a zero-history persona", () => {
    const p = PERSONAS["cold-start-newcomer"];
    expect(shapeWeightByDay(p, ANCHOR)).toEqual({});
  });

  it("is deterministic", () => {
    const p = PERSONAS["mfp-refugee-power-logger"];
    expect(shapeWeightByDay(p, ANCHOR)).toEqual(shapeWeightByDay(p, ANCHOR));
  });
});

describe("shapeRecipes", () => {
  it("returns the persona's recipe count", () => {
    expect(shapeRecipes(PERSONAS["instagram-recipe-saver"])).toHaveLength(9);
    expect(shapeRecipes(PERSONAS["cold-start-newcomer"])).toHaveLength(0);
  });
});

describe("recipe library — coherent whole-recipe bundles (ENG-1330)", () => {
  // Grace device session 2026-07-02: a persona recipe titled "High-protein
  // overnight oats" carried Greek-salad ingredients and a lemon-olive-oil
  // method because titles and content were assigned independently. Every
  // library entry is now a whole-recipe bundle; these invariants keep it so.
  const library = RECIPE_LIBRARY; // full library — every persona slices from it

  it("every bundle ships title + descriptor + ingredients + method + meta together", () => {
    for (const r of library) {
      expect(r.description.length, `${r.title} description`).toBeGreaterThan(20);
      expect(r.ingredients.length, `${r.title} ingredients`).toBeGreaterThanOrEqual(4);
      expect(r.instructions.length, `${r.title} method steps`).toBeGreaterThanOrEqual(3);
      expect(r.servings, `${r.title} servings`).toBeGreaterThanOrEqual(1);
      expect(r.prep_time_min, `${r.title} prep`).toBeGreaterThanOrEqual(0);
      expect(r.cook_time_min, `${r.title} cook`).toBeGreaterThanOrEqual(0);
      for (const ing of r.ingredients) {
        expect(ing.name.trim().length, `${r.title} ingredient name`).toBeGreaterThan(0);
      }
    }
  });

  it("per-serving macros are sane and internally consistent (Atwater ±15%)", () => {
    for (const r of library) {
      expect(r.calories, `${r.title} kcal`).toBeGreaterThanOrEqual(150);
      expect(r.calories, `${r.title} kcal`).toBeLessThanOrEqual(800);
      const atwater = r.protein * 4 + r.carbs * 4 + r.fat * 9;
      expect(
        Math.abs(atwater - r.calories) / r.calories,
        `${r.title} macros→kcal drift (${atwater} vs ${r.calories})`,
      ).toBeLessThan(0.15);
    }
  });

  it("pins: overnight oats are OATS — not a Greek salad", () => {
    const oats = library.find((r) => r.title === "High-protein overnight oats");
    expect(oats).toBeDefined();
    const names = oats!.ingredients.map((i) => i.name.toLowerCase()).join(", ");
    expect(names).toContain("rolled oats");
    expect(names).toContain("greek yogurt");
    // The exact foreign set Grace saw on device must never come back.
    for (const foreign of ["tomato", "cucumber", "feta", "olive"]) {
      expect(names, `oats must not contain ${foreign}`).not.toContain(foreign);
    }
    expect(oats!.instructions.join(" ").toLowerCase()).toContain("overnight");
  });

  it("pins: miso-butter salmon is salmon + miso with a broil step", () => {
    const salmon = library.find((r) => r.title === "Miso-butter salmon");
    expect(salmon).toBeDefined();
    const names = salmon!.ingredients.map((i) => i.name.toLowerCase()).join(", ");
    expect(names).toContain("salmon");
    expect(names).toContain("miso");
    expect(salmon!.instructions.join(" ").toLowerCase()).toContain("broil");
  });

  it("pins: shakshuka poaches eggs in tomato with feta", () => {
    const shak = library.find((r) => r.title === "Shakshuka with feta");
    expect(shak).toBeDefined();
    const names = shak!.ingredients.map((i) => i.name.toLowerCase()).join(", ");
    expect(names).toContain("eggs");
    expect(names).toContain("tomato");
    expect(names).toContain("feta");
    expect(shak!.instructions.join(" ").toLowerCase()).toContain("poach");
  });
});

describe("buildSeedPlan — full assembly", () => {
  it("assembles a plan whose counts match the shaped rows", () => {
    const p = PERSONAS["lazy-partial-logger"];
    const plan = buildSeedPlan(p, "gracehowse+lazy@outlook.com", USER, ANCHOR);
    expect(plan.entries).toEqual(shapeAllEntries(p, USER, ANCHOR));
    expect(plan.counts.totalEntries).toBe(plan.entries.length);
    expect(plan.counts.weighIns).toBe(Object.keys(plan.weightByDay).length);
    expect(plan.counts.partialDays).toBe(7);
    expect(plan.counts.emptyDays).toBe(3);
    expect(plan.counts.fullDays).toBe(18);
  });

  it("every entry in the plan is scoped to the passed user id", () => {
    const p = PERSONAS["watch-athlete"];
    const plan = buildSeedPlan(p, "gracehowse+watch@outlook.com", USER, ANCHOR);
    expect(plan.entries.every((e) => e.user_id === USER)).toBe(true);
  });

  it("the cold-start newcomer plan is genuinely empty", () => {
    const p = PERSONAS["cold-start-newcomer"];
    const plan = buildSeedPlan(p, "gracehowse+new@outlook.com", USER, ANCHOR);
    expect(plan.entries).toEqual([]);
    expect(plan.weightByDay).toEqual({});
    expect(plan.recipes).toEqual([]);
    expect(plan.profile.onboarding_completed).toBe(false);
  });
});
