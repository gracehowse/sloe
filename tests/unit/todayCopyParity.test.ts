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
    expect(RING_LABELS.logged).toBe("LOGGED");
    expect(RING_LABELS.remaining).toBe("REMAINING");
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

  for (const phrase of FORBIDDEN_TODAY_PHRASES) {
    it(`no source file contains \`${phrase}\``, () => {
      const offenders: string[] = [];
      for (const file of files) {
        const content = readFileSync(file, "utf8");
        if (content.includes(phrase)) {
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
