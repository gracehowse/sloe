/**
 * Planner defaults — wave-2 (2026-04-30 audit-vs-competitors) FIX 1.
 *
 * Plan IS a week tool. Defaulting to a 1-day plan hid the "wow" of a
 * planned week behind a tap and made Plan look like Today with extra
 * steps. Wave-2 changes the initial `days` state from 1 to 7 and adds
 * a clamp so free-tier users (who can't generate >1-day plans) are
 * bumped back to 1 once the async tier resolves.
 *
 * Mounting the full Plan screen in vitest is heavy (Supabase / RC /
 * AsyncStorage / expo-haptics). This is a structural source-level
 * check that pins:
 *
 *   1. `useState<1 | 3 | 7>(7)` — Pro-default 7-day plan.
 *   2. The `useEffect` clamp that snaps free-tier users back to 1
 *      when they haven't manually changed the chip yet.
 *   3. The free-tier clamp respects user choice via a ref guard so a
 *      Pro user who tapped "1" doesn't get bumped back to 7.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PLANNER_PATH = resolve(__dirname, "../../app/(tabs)/planner.tsx");
const SRC = readFileSync(PLANNER_PATH, "utf8");

describe("Planner defaults (wave-2 FIX 1)", () => {
  it("defaults the days picker to 7 (week-view-first)", () => {
    expect(SRC).toMatch(/useState<1 \| 3 \| 7>\(7\)/);
  });

  it("does NOT default to 1 (regression guard against the old behaviour)", () => {
    // Catch any future refactor that re-introduces the 1-day default.
    expect(SRC).not.toMatch(/useState<1 \| 3 \| 7>\(1\)/);
  });

  it("declares a userPickedDaysRef to gate the free-tier clamp", () => {
    expect(SRC).toContain("userPickedDaysRef");
    // Default false so the first effect run after isFree resolves can
    // legitimately clamp.
    expect(SRC).toMatch(/userPickedDaysRef\s*=\s*useRef\(false\)/);
  });

  it("clamps days back to 1 for free-tier users when they haven't picked yet", () => {
    expect(SRC).toMatch(/if\s*\(isFree\s*&&\s*!userPickedDaysRef\.current\)\s*{\s*setDays\(1\)/);
  });

  it("marks the ref true on every chip tap so a Pro user who chose 1 isn't bumped back to 7", () => {
    // Both day-picker chip onPress handlers must set the flag.
    const occurrences = SRC.split("userPickedDaysRef.current = true").length - 1;
    // We have two day-pickers: the initial generate UI + the expanded
    // "regenerate setup" UI. Both must mark the ref.
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });
});
