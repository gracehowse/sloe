/**
 * todayCopyParity — enforces cross-platform canonical copy for the
 * Today / tracker / calorie-balance surfaces.
 *
 * What this test protects:
 *   1. The canonical strings in `src/lib/copy/today.ts` resolve as
 *      expected (function outputs, label values, non-empty).
 *   2. No user-facing surface on **web**, **mobile**, or the
 *      **landing page** ships a forbidden phrasing (retired terms
 *      like "below maint.", "under budget", "Today's meals", etc.).
 *
 * When this test fails:
 *   - If you ADDED new copy that uses one of the forbidden phrases,
 *     change the copy to match the canonical term (usually "deficit"
 *     / "surplus" / "Remaining") or — if the new copy is
 *     intentional — update both the copy module AND this test's
 *     allowlist so the decision is explicit.
 *   - If you RENAMED an existing canonical term, update the constant
 *     in `src/lib/copy/today.ts`; surfaces that imported from it
 *     will pick the new value up automatically.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  RING_LABELS,
  TODAY_RING_OVERLINE,
  TODAY_STAT_LABELS,
  NET_DEFICIT_LABEL,
  NET_SURPLUS_LABEL,
  NET_MAINTENANCE_LABEL,
  MEAL_SLOT_HEADERS,
  FORBIDDEN_TODAY_PHRASES,
  netDetailFromKcal,
  todayRingSuffix,
  todayBalanceHeadline,
  todayGreeting,
  todayLongDateSubline,
  todayPastDayGreetingLines,
  TODAY_DATE_LOCALE,
  todayStatusChip,
  weeklyInsightHeadline,
  weeklyInsightCoachLine,
  todayRoomForMeal,
  figmaSlotSummaryTitle,
  nextUnloggedMealSlot,
  TODAY_ROOM_MIN_KCAL,
  TODAY_MEAL_SLOT_ORDER,
  TODAY_HEALTH_CONNECT_ROUTE,
  todayHealthConnectActiveCaloriesHint,
  todayHealthConnectEnergyEmptyHint,
} from "../../src/lib/copy/today";

/** Absolute path to the repo root — tests run from the repo root via
 *  vitest so `process.cwd()` is reliable here. */
const REPO = process.cwd();

/** Directories scanned for forbidden phrases. The canonical copy
 *  module itself is excluded because it LISTS the forbidden phrases
 *  in a constant — matching there is legitimate. */
const SCAN_ROOTS = [
  join(REPO, "app/(landing)"),
  join(REPO, "src/app/components"),
  join(REPO, "apps/mobile/components"),
  join(REPO, "apps/mobile/app"),
];

const EXCLUDE_PATH_FRAGMENTS = [
  "node_modules",
  ".next",
  "dist",
  "src/lib/copy/today.ts",
  // test files are allowed to reference retired terms in fixtures
  "tests/",
  "/__tests__/",
  ".test.ts",
  ".test.tsx",
];

/** Enumerate source files under a root. */
function listSourceFiles(dir: string): string[] {
  let out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (EXCLUDE_PATH_FRAGMENTS.some((frag) => full.includes(frag))) continue;
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      out = out.concat(listSourceFiles(full));
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("canonical Today copy module", () => {
  it("exposes non-empty ring labels", () => {
    // web ring parity 2026-06-10 (mobile ring wave): the centre overline reads
    // "LEFT" ("REMAINING" arced too long under the number); LOGGED is the
    // goal<=0 fallback only (the Remaining/Consumed toggle is retired).
    expect(RING_LABELS.logged).toBe("LOGGED");
    expect(RING_LABELS.remaining).toBe("LEFT");
    expect(RING_LABELS.over).toBe("OVER");
    expect(TODAY_RING_OVERLINE).toBe(RING_LABELS.remaining);
  });

  it("exposes the 4 stat tile labels used beside the ring", () => {
    expect(TODAY_STAT_LABELS.logged).toBe("Logged");
    expect(TODAY_STAT_LABELS.target).toBe("Target");
    expect(TODAY_STAT_LABELS.burned).toBe("Burned");
    expect(TODAY_STAT_LABELS.net).toBe("Net");
  });

  it("uses 'deficit' / 'surplus' / 'maintenance' for Net detail", () => {
    expect(NET_DEFICIT_LABEL).toBe("deficit");
    expect(NET_SURPLUS_LABEL).toBe("surplus");
    expect(NET_MAINTENANCE_LABEL).toBe("maintenance");
  });

  it("resolves netDetailFromKcal by sign", () => {
    expect(netDetailFromKcal(-500)).toBe(NET_DEFICIT_LABEL);
    expect(netDetailFromKcal(250)).toBe(NET_SURPLUS_LABEL);
    expect(netDetailFromKcal(0)).toBe(NET_MAINTENANCE_LABEL);
  });

  it("includes the kcal unit in the ring subtitle", () => {
    expect(todayRingSuffix(1800)).toBe("of 1,800 kcal");
    expect(todayRingSuffix(2400)).toContain("kcal");
  });

  it("builds a deficit/surplus headline with a number", () => {
    expect(todayBalanceHeadline(480)).toMatch(/480 kcal deficit so far today/);
    expect(todayBalanceHeadline(-120)).toMatch(/120 kcal surplus so far today/);
    expect(todayBalanceHeadline(0)).toBe("On your calorie target so far today");
  });

  it("exposes canonical meal slot headers (not 'Today's meals')", () => {
    expect(MEAL_SLOT_HEADERS.breakfast).toBe("Breakfast");
    expect(MEAL_SLOT_HEADERS.lunch).toBe("Lunch");
    expect(MEAL_SLOT_HEADERS.dinner).toBe("Dinner");
    expect(MEAL_SLOT_HEADERS.snack).toBe("Snack");
  });
});

describe("Sloe Today hero greeting (todayGreeting)", () => {
  it("greets by time-of-day window", () => {
    expect(todayGreeting(8)).toBe("Good morning");
    expect(todayGreeting(13)).toBe("Good afternoon");
    expect(todayGreeting(20)).toBe("Good evening");
  });

  it("includes a first name when provided", () => {
    expect(todayGreeting(8, "Grace")).toBe("Morning, Grace");
    expect(todayGreeting(13, "Grace")).toBe("Afternoon, Grace");
    expect(todayGreeting(20, "Grace")).toBe("Evening, Grace");
  });

  it("falls back to the name-free greeting for empty / whitespace names", () => {
    expect(todayGreeting(8, "")).toBe("Good morning");
    expect(todayGreeting(8, "   ")).toBe("Good morning");
    expect(todayGreeting(8, null)).toBe("Good morning");
  });

  it("uses the morning/afternoon/evening cut points (12 / 18)", () => {
    expect(todayGreeting(0)).toBe("Good morning");
    expect(todayGreeting(11)).toBe("Good morning");
    expect(todayGreeting(12)).toBe("Good afternoon");
    expect(todayGreeting(17)).toBe("Good afternoon");
    expect(todayGreeting(18)).toBe("Good evening");
    expect(todayGreeting(23)).toBe("Good evening");
  });
});

describe("Sloe Today hero dates (todayLongDateSubline / todayPastDayGreetingLines)", () => {
  it("formats the today subline in British English", () => {
    const d = new Date(2026, 5, 4); // 4 June 2026 local
    expect(todayLongDateSubline(d)).toMatch(/June/);
    expect(todayLongDateSubline(d, TODAY_DATE_LOCALE)).toBe(
      d.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    );
  });

  it("uses Yesterday + long date subline for the previous calendar day", () => {
    const now = new Date(2026, 5, 4, 12, 0, 0);
    const yesterday = new Date(2026, 5, 3);
    expect(todayPastDayGreetingLines(yesterday, now)).toEqual({
      headline: "Yesterday",
      subline: todayLongDateSubline(yesterday),
    });
  });

  it("uses a long date headline (no time greeting) for older days", () => {
    const now = new Date(2026, 5, 4, 12, 0, 0);
    const mon = new Date(2026, 5, 1);
    expect(todayPastDayGreetingLines(mon, now)).toEqual({
      headline: todayLongDateSubline(mon),
      subline: null,
    });
  });
});

describe("Today health connect route (ENG-873)", () => {
  it("uses Settings → Connections in shared hints", () => {
    expect(TODAY_HEALTH_CONNECT_ROUTE).toBe("Settings → Connections");
    expect(todayHealthConnectActiveCaloriesHint()).toContain(
      TODAY_HEALTH_CONNECT_ROUTE,
    );
    expect(todayHealthConnectEnergyEmptyHint()).toContain(
      TODAY_HEALTH_CONNECT_ROUTE,
    );
    expect(todayHealthConnectActiveCaloriesHint()).not.toContain("More →");
  });
});

describe("Sloe Today status chip (todayStatusChip) — Figma labels", () => {
  it("uses Fresh start / Under budget / Over budget", () => {
    expect(todayStatusChip("empty")).toBe("Fresh start");
    expect(todayStatusChip("under")).toBe("Under budget");
    expect(todayStatusChip("over", 140)).toBe("Over budget");
  });

  it("chip may use budget bigrams while other surfaces stay forbidden", () => {
    expect(todayStatusChip("under").toLowerCase()).toContain("under budget");
    expect(todayStatusChip("over").toLowerCase()).toContain("over budget");
  });
});

describe("Sloe Weekly-insight copy (TD3) — honest + calm", () => {
  it("starts the week with a calm headline, never the fabricated 'trending' claim", () => {
    expect(weeklyInsightHeadline(0, 0)).toBe("Your week starts here");
    // A single logged day is too little signal to claim a trend.
    expect(weeklyInsightHeadline(1, 1)).toBe("Your week so far");
  });

  it("earns the encouraging headline only when ≥60% of ≥2 logged days are on target", () => {
    expect(weeklyInsightHeadline(4, 3)).toBe("Trending right where you want to be"); // 3/4 ≥ 60%
    expect(weeklyInsightHeadline(5, 3)).toBe("Trending right where you want to be"); // 3/5 = 60%
    expect(weeklyInsightHeadline(5, 2)).toBe("Your week so far"); // 2/5 < 60%
  });

  it("omits the coach line when there's nothing honest to say", () => {
    expect(weeklyInsightCoachLine(0, 0)).toBeNull(); // no logs
    expect(weeklyInsightCoachLine(1, 1)).toBeNull(); // one day, too little signal
    expect(weeklyInsightCoachLine(3, 0)).toBeNull(); // logged but none on target
  });

  it("states the on-target count factually in the coach line", () => {
    expect(weeklyInsightCoachLine(4, 3)).toBe("3 of 4 days landed on target — nice.");
    expect(weeklyInsightCoachLine(5, 2)).toBe("2 of 5 days on target so far.");
  });

  it("never emits a forbidden phrase from the weekly-insight copy", () => {
    const samples = [
      weeklyInsightHeadline(0, 0),
      weeklyInsightHeadline(4, 3),
      weeklyInsightHeadline(5, 1),
      weeklyInsightCoachLine(4, 3) ?? "",
      weeklyInsightCoachLine(5, 2) ?? "",
    ];
    for (const s of samples) {
      const lower = s.toLowerCase();
      for (const phrase of FORBIDDEN_TODAY_PHRASES) {
        expect(lower.includes(phrase.toLowerCase())).toBe(false);
      }
    }
  });
});

describe("Sloe Today under-ring coach line (todayRoomForMeal) — forward + honest", () => {
  it("names the next unlogged slot with the remaining budget when one slot is left (Figma 01)", () => {
    const loggedMostMeals = ["Breakfast", "Lunch", "Snacks"];
    // "Room for dinner — about 620 kcal to play with. No rush."
    expect(todayRoomForMeal(620, "Dinner", loggedMostMeals)).toBe(
      "Room for dinner — about 620 kcal to play with. No rush.",
    );
    // Legacy call without loggedSlots still works for last-meal scenarios.
    expect(todayRoomForMeal(620, "Dinner")).toBe(
      "Room for dinner — about 620 kcal to play with. No rush.",
    );
  });

  it("does not suggest the full-day remainder as a breakfast target (901 kcal case)", () => {
    expect(todayRoomForMeal(901, "Breakfast", [])).toBe(
      "Plan your day — about 901 kcal left. No rush.",
    );
    expect(todayRoomForMeal(901, "Breakfast", [])).not.toContain("901 kcal at breakfast");
  });

  it("suggests a slot-appropriate aim when two meals remain", () => {
    // Breakfast + lunch logged; dinner next. 400 remaining → ~267 kcal dinner share.
    expect(todayRoomForMeal(400, "Dinner", ["Breakfast", "Lunch"])).toBe(
      "Aim for about 267 kcal at dinner. No rush.",
    );
  });

  it("reads 'for a snack' in the aim line for the Snacks slot", () => {
    expect(todayRoomForMeal(180, "Snacks", ["Breakfast", "Lunch", "Dinner"])).toBe(
      "Room for a snack — about 180 kcal to play with. No rush.",
    );
  });

  it("falls back to a slot-free line when every meal is logged but budget remains", () => {
    expect(todayRoomForMeal(240, null)).toBe(
      "About 240 kcal left for today. No rush.",
    );
  });

  it("HONESTY: returns null at / over budget so we never claim room that isn't there", () => {
    expect(todayRoomForMeal(0, "Dinner")).toBeNull();
    expect(todayRoomForMeal(-300, "Dinner")).toBeNull(); // over budget
    expect(todayRoomForMeal(-300, null)).toBeNull();
  });

  it(`HONESTY: returns null below the ${TODAY_ROOM_MIN_KCAL} kcal noise floor`, () => {
    expect(todayRoomForMeal(TODAY_ROOM_MIN_KCAL - 1, "Dinner")).toBeNull();
    expect(todayRoomForMeal(49, null)).toBeNull();
    // ...and renders exactly at the floor.
    expect(todayRoomForMeal(TODAY_ROOM_MIN_KCAL, "Dinner")).toBe(
      "Room for dinner — about 50 kcal to play with. No rush.",
    );
  });

  it("rounds remaining and formats with a thousands separator", () => {
    expect(todayRoomForMeal(1234.6, "Dinner")).toBe(
      "Room for dinner — about 1,235 kcal to play with. No rush.",
    );
    expect(todayRoomForMeal(1200.2, null)).toBe(
      "About 1,200 kcal left for today. No rush.",
    );
  });

  it("never emits a forbidden phrase", () => {
    const samples = [
      todayRoomForMeal(620, "Dinner") ?? "",
      todayRoomForMeal(180, "Snacks") ?? "",
      todayRoomForMeal(240, null) ?? "",
    ];
    for (const s of samples) {
      const lower = s.toLowerCase();
      for (const phrase of FORBIDDEN_TODAY_PHRASES) {
        expect(lower.includes(phrase.toLowerCase())).toBe(false);
      }
    }
  });
});

describe("figmaSlotSummaryTitle — ENG-1058 multi-item slot summary", () => {
  it("shows the food name for a single-item slot", () => {
    expect(figmaSlotSummaryTitle([{ recipeTitle: "Greek yogurt" }])).toBe("Greek yogurt");
  });

  it("shows an aggregate count for multi-item slots", () => {
    expect(
      figmaSlotSummaryTitle([
        { recipeTitle: "good culture" },
        { recipeTitle: "banana" },
      ]),
    ).toBe("2 items");
  });
});

describe("nextUnloggedMealSlot — Breakfast → Lunch → Dinner → Snacks walk", () => {
  it("returns the first slot in order when nothing is logged", () => {
    expect(nextUnloggedMealSlot([])).toBe("Breakfast");
  });

  it("skips logged slots and returns the first gap", () => {
    expect(nextUnloggedMealSlot(["Breakfast"])).toBe("Lunch");
    expect(nextUnloggedMealSlot(["Breakfast", "Lunch"])).toBe("Dinner");
    expect(nextUnloggedMealSlot(["Breakfast", "Lunch", "Dinner"])).toBe(
      "Snacks",
    );
  });

  it("walks in slot order regardless of the order meals were logged", () => {
    // Logged Dinner first (e.g. logged late) — Breakfast is still the
    // first gap in the eating-order walk.
    expect(nextUnloggedMealSlot(["Dinner"])).toBe("Breakfast");
    expect(nextUnloggedMealSlot(["Dinner", "Lunch"])).toBe("Breakfast");
    expect(nextUnloggedMealSlot(["Snacks", "Breakfast"])).toBe("Lunch");
  });

  it("returns null when every slot is logged", () => {
    expect(
      nextUnloggedMealSlot(["Breakfast", "Lunch", "Dinner", "Snacks"]),
    ).toBeNull();
  });

  it("matches slot names case-insensitively and ignores blanks", () => {
    expect(nextUnloggedMealSlot(["breakfast", "LUNCH"])).toBe("Dinner");
    expect(nextUnloggedMealSlot(["", "  ", "Breakfast"])).toBe("Lunch");
  });

  it("ignores non-slot meal names (e.g. legacy 'Other')", () => {
    // An unrecognised slot name doesn't satisfy any canonical slot, so
    // the walk still returns Breakfast as the first real gap.
    expect(nextUnloggedMealSlot(["Other"])).toBe("Breakfast");
  });

  it("slot order matches the canonical eating order", () => {
    expect([...TODAY_MEAL_SLOT_ORDER]).toEqual([
      "Breakfast",
      "Lunch",
      "Dinner",
      "Snacks",
    ]);
  });
});

describe("forbidden Today phrases — web + mobile + landing", () => {
  const files = SCAN_ROOTS.flatMap(listSourceFiles);

  it("scans at least one source file per platform", () => {
    // Sanity check — if we scanned zero files the grep would be
    // silently green. Assert we're actually reading code.
    const landing = files.filter((f) => f.includes("app/(landing)"));
    const web = files.filter((f) => f.includes("src/app/components"));
    const mobile = files.filter((f) => f.includes("apps/mobile"));
    expect(landing.length).toBeGreaterThan(0);
    expect(web.length).toBeGreaterThan(0);
    expect(mobile.length).toBeGreaterThan(0);
  });

  /**
   * Strip `/* … *\/` block comments and `// …` line comments out of a
   * source file before scanning for forbidden phrases.
   *
   * Why: comments routinely reference retired terms ("...replaced
   * the punitive 'over budget' label...") to explain why the term
   * was removed. The case-INSENSITIVE scan added in round 4
   * (2026-04-30) over-matched those documentation traces; the
   * original case-sensitive check coincidentally let them through.
   *
   * The strip is best-effort, not a parser — TS/JSX has true comment
   * grammar (template-literal embedding, regex literals, `/* in
   * strings, etc.) but for our scan-only purpose a simple replace is
   * fine: if a forbidden phrase ever lives inside a `// or /*` that
   * fits the JS comment grammar, it's not user-facing copy.
   */
  function stripComments(src: string): string {
    return src
      // Block comments — non-greedy so adjacent blocks don't collapse.
      .replace(/\/\*[\s\S]*?\*\//g, "")
      // Line comments — `//` to end of line. JSX `// comment` inside a
      // string literal is handled by the comment-grammar caveat above.
      .replace(/(^|[^:\\])\/\/[^\n]*/g, "$1");
  }

  for (const phrase of FORBIDDEN_TODAY_PHRASES) {
    it(`no source file contains \`${phrase}\` (case-insensitive, code only)`, () => {
      // Calm-tone audit (round 4, 2026-04-30): match is case-
      // INSENSITIVE so "Over budget" (capital O) is rejected even
      // when the canonical entry is lower-case. Previously the
      // includes() check let "Over budget" slip past — see the
      // `today-week-view.tsx` finding in the audit notes.
      //
      // Comments are stripped before scanning so docs that reference
      // the retired terms ("...replaced 'over budget' with...") don't
      // trigger a false positive.
      const lowerPhrase = phrase.toLowerCase();
      const offenders: string[] = [];
      for (const file of files) {
        const content = stripComments(readFileSync(file, "utf8"));
        if (content.toLowerCase().includes(lowerPhrase)) {
          offenders.push(file.replace(REPO + "/", ""));
        }
      }
      if (offenders.length > 0) {
        const message =
          `Found forbidden phrase "${phrase}" in ${offenders.length} ` +
          `file(s). Replace with the canonical copy from ` +
          `src/lib/copy/today.ts, or (if intentional) remove the ` +
          `phrase from FORBIDDEN_TODAY_PHRASES and explain why in ` +
          `the copy module header.\n\nOffending files:\n` +
          offenders.map((f) => `  - ${f}`).join("\n");
        throw new Error(message);
      }
    });
  }
});
