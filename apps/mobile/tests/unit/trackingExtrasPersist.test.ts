/**
 * Build 41 (TestFlight `AEsaeOW2Qw-BQa29teBp-Ns`, 2026-05-01) —
 * regression pin for the caffeine / alcohol / water quick-add persist
 * path on mobile.
 *
 * Tester report: "Adding alcohol or coffee still not impacting these
 * numbers". Local state appeared to update on chip tap, but on next
 * focus / app relaunch the count reverted to 0.
 *
 * Root cause: the previous (round 3) fix relied on capturing the
 * computed `next` map inside a `setState((prev) => ...)` updater and
 * reading `persisted` on the next line — but React 18 invokes
 * functional updaters lazily during the next commit, so `persisted`
 * was always `null` when the persist branch checked it. The supabase
 * write therefore never fired, the round-3 error path never ran, and
 * the round-3 toast never surfaced. On next focus the local state
 * hydrated from the (still-zero) server row → "reset to 0".
 *
 * Build 41 fix: compute `next` synchronously from the closure-captured
 * map, persist with that value, and use a direct (non-functional)
 * setState call so the value is immediately available outside the
 * updater. This file pins the structural wiring so a future refactor
 * that re-introduces `let persisted = null; setState((prev) => {
 * persisted = next; return next; });` fails CI.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const TODAY_PATH = resolve(__dirname, "../../app/(tabs)/_today/TodayScreen.tsx");
const TODAY_SRC = readFileSync(TODAY_PATH, "utf8");

describe("Build 41 — addCaffeineMg synchronously captures `next` for persist", () => {
  it("computes next from the prev snapshot before calling setState (no updater closure capture)", () => {
    const block = extractFunctionBlock(TODAY_SRC, "const addCaffeineMg = useCallback");
    // Direct prev snapshot — guarantees the value is available outside
    // the React updater for the persist call.
    expect(block).toMatch(/const prev = extraCaffeineByDay;/);
    expect(block).toMatch(/const next = pruneByDay\(\{ \.\.\.prev, \[dayKey\]: \(prev\[dayKey\] \?\? 0\) \+ add \}\);/);
    expect(block).toMatch(/setExtraCaffeineByDay\(next\);/);
  });

  it("persists `next` (the computed map) to profiles.extra_caffeine_by_day, not a closure-captured `persisted`", () => {
    const block = extractFunctionBlock(TODAY_SRC, "const addCaffeineMg = useCallback");
    // Build 41 fix: persist call uses `next` directly. The `let
    // persisted = null` + `if (persisted)` pattern is gone.
    expect(block).toMatch(/\.update\(\{ extra_caffeine_by_day: next \}\)/);
    expect(block).not.toMatch(/let persisted: Record<string, number> \| null = null;/);
    expect(block).not.toMatch(/if \(persisted\) \{/);
  });

  it("rolls back to the captured `prev` directly on persist failure (no functional updater)", () => {
    const block = extractFunctionBlock(TODAY_SRC, "const addCaffeineMg = useCallback");
    expect(block).toMatch(/setExtraCaffeineByDay\(prev\);/);
  });

  it("declares extraCaffeineByDay in the useCallback dep array", () => {
    const block = extractFunctionBlock(TODAY_SRC, "const addCaffeineMg = useCallback");
    expect(block).toMatch(/\[userId, dayKey, extraCaffeineByDay\]/);
  });
});

describe("Build 41 — addAlcoholG synchronously captures `next` for persist", () => {
  it("computes next from the prev snapshot before calling setState", () => {
    const block = extractFunctionBlock(TODAY_SRC, "const addAlcoholG = useCallback");
    expect(block).toMatch(/const prev = extraAlcoholGByDay;/);
    expect(block).toMatch(/const next = pruneByDay\(\{ \.\.\.prev, \[dayKey\]: \(prev\[dayKey\] \?\? 0\) \+ add \}\);/);
    expect(block).toMatch(/setExtraAlcoholGByDay\(next\);/);
  });

  it("persists `next` to profiles.extra_alcohol_g_by_day", () => {
    const block = extractFunctionBlock(TODAY_SRC, "const addAlcoholG = useCallback");
    expect(block).toMatch(/\.update\(\{ extra_alcohol_g_by_day: next \}\)/);
    expect(block).not.toMatch(/let persisted: Record<string, number> \| null = null;/);
  });

  it("rolls back to `prev` on persist failure", () => {
    const block = extractFunctionBlock(TODAY_SRC, "const addAlcoholG = useCallback");
    expect(block).toMatch(/setExtraAlcoholGByDay\(prev\);/);
  });

  it("declares extraAlcoholGByDay in the useCallback dep array", () => {
    const block = extractFunctionBlock(TODAY_SRC, "const addAlcoholG = useCallback");
    expect(block).toMatch(/\[userId, dayKey, extraAlcoholGByDay\]/);
  });
});

describe("Build 41 — addWaterMl uses the same direct-capture pattern", () => {
  it("computes next from prev before setExtraWaterByDay", () => {
    const block = extractFunctionBlock(TODAY_SRC, "const addWaterMl = useCallback");
    expect(block).toMatch(/const prev = extraWaterByDay;/);
    expect(block).toMatch(/const next = pruneByDay\(\{ \.\.\.prev, \[dayKey\]: \(prev\[dayKey\] \?\? 0\) \+ add \}\);/);
    expect(block).toMatch(/setExtraWaterByDay\(next\);/);
  });

  it("persists `next` to profiles.extra_water_by_day", () => {
    const block = extractFunctionBlock(TODAY_SRC, "const addWaterMl = useCallback");
    expect(block).toMatch(/\.update\(\{ extra_water_by_day: next \}\)/);
    expect(block).not.toMatch(/let persisted: Record<string, number> \| null = null;/);
  });
});

describe("Build 41 — resetHydrationStimulantsForDay uses direct-capture too", () => {
  it("computes next from the matching map before calling setState", () => {
    const block = extractFunctionBlock(
      TODAY_SRC,
      "const resetHydrationStimulantsForDay = useCallback",
    );
    expect(block).toMatch(/next = apply\(extraWaterByDay\);/);
    expect(block).toMatch(/next = apply\(extraCaffeineByDay\);/);
    expect(block).toMatch(/next = apply\(extraAlcoholGByDay\);/);
  });

  it("persists `next` to the matching column", () => {
    const block = extractFunctionBlock(
      TODAY_SRC,
      "const resetHydrationStimulantsForDay = useCallback",
    );
    expect(block).toMatch(/\.update\(\{ \[column\]: next \}\)/);
    expect(block).not.toMatch(/let persisted: Record<string, number> \| null = null;/);
  });
});

/**
 * Extract the body of a top-level `const fn = useCallback(...)` declaration.
 *
 * Returns a substring covering enough of the declaration to scope each
 * describe to its function. Cheap-and-cheerful: takes a fixed-size
 * window after the declaration, which is fine because the
 * useCallback bodies in this file are <= ~80 lines each. A previous
 * paren-counting implementation tripped on RegExp literals, template
 * literals, and TS comparison operators.
 */
function extractFunctionBlock(src: string, declaration: string): string {
  const start = src.indexOf(declaration);
  if (start < 0) throw new Error(`Could not find "${declaration}" in source`);
  // 4 KB window comfortably covers any single useCallback in this file.
  return src.slice(start, start + 4_000);
}
