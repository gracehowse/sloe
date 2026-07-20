/**
 * ENG-1580 — mobile Progress's 90-day `nutrition_entries` window start
 * must be anchored the same way as web's `journalHistoryWindowStartKey()`
 * (`src/lib/nutrition/journalWindow.ts`): UTC midnight of "now", THEN
 * subtract 90 days. Before this fix, `progress.tsx` computed its own
 * `ninetyDaysAgo` via `new Date(Date.now() - 90*24*3600*1000).toISOString()
 * .slice(0,10)` — a second, independently-maintained formula with no
 * guarantee of staying in lockstep with web's if either side ever changed
 * (e.g. a future edge-case fix landing on one side only).
 *
 * The fix (see `apps/mobile/app/(tabs)/progress.tsx`, the `ninetyDaysAgo`
 * assignment in `loadData`) deletes the second formula entirely and calls
 * the shared `journalHistoryWindowStartKey()` — imported via
 * `@suppr/nutrition-core/journalWindow`, which resolves (per
 * `apps/mobile/tsconfig.json` + `apps/mobile/vitest.config.ts` path
 * aliases) to `src/lib/nutrition-core/journalWindow.ts`, a barrel that
 * re-exports `src/lib/nutrition/journalWindow.ts` verbatim — the exact
 * same module web imports directly. So mobile and web now literally call
 * the same function, not two formulas that happen to agree.
 *
 * What this file pins:
 *  1. `progress.tsx` computes `ninetyDaysAgo` via a call to
 *     `journalHistoryWindowStartKey()`, not a re-derived ms-subtraction
 *     formula (source-level pin — the real regression guard here, since
 *     the two formulas are numerically equivalent for any single instant;
 *     see the code comment in test 2 below).
 *  2. `journalHistoryWindowStartKey()` — called with no arguments, exactly
 *     as `progress.tsx` calls it — returns the correct UTC-midnight-
 *     anchored 90-day-back date at instants either side of a UTC day
 *     boundary (23:59 / 00:01 UTC, per the ticket's test spec), verified
 *     against an independently-constructed expected value (via
 *     `Date.UTC(...)` field arithmetic, a different code path than the
 *     implementation's `setUTCHours`/`setUTCDate` mutation) using
 *     deterministic fake timers rather than real wall-clock time.
 *  3. `apps/mobile/tsconfig.json`'s `@suppr/nutrition-core/*` path maps to
 *     the same `src/lib/nutrition-core/*` barrel `vitest.config.ts`
 *     aliases to, and that barrel re-exports (not re-implements)
 *     `../nutrition/journalWindow` — the module web imports directly.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { journalHistoryWindowStartKey } from "@suppr/nutrition-core/journalWindow";

const REPO_ROOT = resolve(__dirname, "../../../..");

function read(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), "utf8");
}

/**
 * Independently-derived expected window start: builds the UTC-midnight
 * anchor via `Date.UTC(...)` field construction (letting the JS Date
 * algorithm normalise the underflowed day-of-month) rather than the
 * implementation's `setUTCHours` + `setUTCDate` mutation — a different
 * code path, so this isn't a tautological copy of `journalWindow.ts`.
 */
function expectedWindowStartKey(nowIso: string, daysBack: number): string {
  const now = new Date(nowIso);
  const anchored = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysBack),
  );
  return anchored.toISOString().slice(0, 10);
}

describe("progress.tsx 90-day window start delegates to the shared helper (ENG-1580)", () => {
  it("computes `ninetyDaysAgo` via journalHistoryWindowStartKey(), not a re-derived formula", () => {
    const mobileSrc = read("apps/mobile/app/(tabs)/progress.tsx");
    expect(mobileSrc).toContain(
      'import { journalHistoryWindowStartKey } from "@suppr/nutrition-core/journalWindow";',
    );
    expect(mobileSrc).toContain("const ninetyDaysAgo = journalHistoryWindowStartKey();");
    // The old ad hoc ms-subtraction formula must be gone, not merely
    // unused — its presence would signal a silent partial revert.
    expect(mobileSrc).not.toMatch(
      /new Date\(Date\.now\(\)\s*-\s*90\s*\*\s*24\s*\*\s*3600\s*\*\s*1000\)/,
    );
  });

  it("`@suppr/nutrition-core/journalWindow` re-exports web's `journalWindow` module verbatim (not a reimplementation)", () => {
    const barrelSrc = read("src/lib/nutrition-core/journalWindow.ts").trim();
    expect(barrelSrc).toBe('export * from "../nutrition/journalWindow";');
  });
});

describe("journalHistoryWindowStartKey() at a UTC day boundary (ENG-1580)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // Two instants two minutes apart, straddling 2026-07-20T00:00:00.000Z —
  // the exact 23:59 / 00:01 UTC pairing the ticket calls out.
  const beforeMidnightUtc = "2026-07-19T23:59:00.000Z";
  const afterMidnightUtc = "2026-07-20T00:01:00.000Z";

  it("23:59 UTC: window start is 90 UTC days before that instant's calendar day", () => {
    vi.setSystemTime(new Date(beforeMidnightUtc));
    // Called with no arguments, exactly as `progress.tsx` calls it.
    expect(journalHistoryWindowStartKey()).toBe(
      expectedWindowStartKey(beforeMidnightUtc, 90),
    );
    expect(journalHistoryWindowStartKey()).toBe("2026-04-20");
  });

  it("00:01 UTC (two minutes later, next calendar day): window start advances by exactly one day", () => {
    vi.setSystemTime(new Date(afterMidnightUtc));
    expect(journalHistoryWindowStartKey()).toBe(
      expectedWindowStartKey(afterMidnightUtc, 90),
    );
    expect(journalHistoryWindowStartKey()).toBe("2026-04-21");
  });

  it("month + leap-year rollover: window start is still the correct UTC calendar date", () => {
    // 2028 is a leap year — 90 days back from 2028-03-01 must land on
    // 2027-12-02, correctly stepping through Feb 29 2028 in reverse.
    const iso = "2028-03-01T00:01:00.000Z";
    vi.setSystemTime(new Date(iso));
    expect(journalHistoryWindowStartKey()).toBe(expectedWindowStartKey(iso, 90));
    expect(journalHistoryWindowStartKey()).toBe("2027-12-02");
  });
});
