/**
 * F-114 follow-up (2026-05-07) — pin that every HealthKit native-
 * callback wrapper in `apps/mobile/lib/healthSync.ts` races a timeout
 * via `withHealthCallbackTimeout`.
 *
 * The native bridge has no abort signal of its own; under sandbox
 * glitches it occasionally never invokes its completion callback.
 * Without the race, the awaiting promise hangs forever and stranded
 * caller spinners. The two intentional exceptions are:
 *   - `isAvailableDetailed` (its own 20s timeout, returns a resolve-
 *     with-result-union shape, never rejects).
 *   - `initHealthKitPromiseWithTimeout` (its own 180s timeout for the
 *     permission-sheet wait).
 *
 * This static-analysis pin asserts there are no `new Promise((resolve,
 * reject) => hk.getX(...))` callsites outside those two named places.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..");
const HEALTH_SYNC = resolve(REPO, "apps/mobile/lib/healthSync.ts");

describe("F-114 — HealthKit native-callback wrappers race a timeout", () => {
  it("withHealthCallbackTimeout helper exists in healthSync.ts", () => {
    const src = readFileSync(HEALTH_SYNC, "utf8");
    expect(src).toMatch(/function\s+withHealthCallbackTimeout\b/);
    // Hard cap should be defined and reasonable (≥10s — too short
    // would false-trigger on slow devices).
    const m = src.match(/HEALTH_SAMPLE_TIMEOUT_MS\s*=\s*([\d_]+)/);
    expect(m).not.toBeNull();
    if (m) expect(Number(m[1].replace(/_/g, ""))).toBeGreaterThanOrEqual(10_000);
  });

  it("every hk.getX(...) callback wrapper goes through withHealthCallbackTimeout", () => {
    const src = readFileSync(HEALTH_SYNC, "utf8");
    // Strip block + line comments so doc references don't trip the pin.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    // Allowed: the helper itself + the two named exceptions. The
    // initHealthKit wrapper has its own 180s timeout; isAvailableDetailed
    // has its own 20s timeout. Both are visible via their named
    // *_TIMEOUT_MS constants in the surrounding ~200 chars.
    const allowedPositions = [
      /isAvailableDetailed/,
      /initHealthKitPromiseWithTimeout/,
      /HEALTH_PERMISSION_INIT_TIMEOUT_MS/,
      /HEALTH_IS_AVAILABLE_TIMEOUT_MS/,
    ];
    // Any `new Promise((resolve` form should be inside one of those
    // allowed contexts. Find every `new Promise((resolve` and check
    // the surrounding 200 chars for the allowed labels.
    const re = /new Promise\(\(resolve[^)]*\)/g;
    const offending: string[] = [];
    for (const m of code.matchAll(re)) {
      const start = Math.max(0, m.index! - 200);
      const end = Math.min(code.length, m.index! + 200);
      const ctx = code.slice(start, end);
      const allowed = allowedPositions.some((re) => re.test(ctx));
      if (!allowed) {
        offending.push(ctx.slice(160, 280));
      }
    }
    expect(offending, `Found ${offending.length} bare new Promise((resolve...)) outside allowed contexts:\n${offending.join("\n---\n")}`).toEqual([]);
  });

  it("at least 10 wrappers go through withHealthCallbackTimeout (the dietary cluster)", () => {
    const src = readFileSync(HEALTH_SYNC, "utf8");
    const calls = (src.match(/withHealthCallbackTimeout\s*\(/g) ?? []).length;
    // 14 sample wrappers + saveFoodSample + getFoodCorrelation +
    // getDietaryQuantitySamplesForPermission = 16+ helper definition.
    expect(calls).toBeGreaterThanOrEqual(15);
  });
});
