/**
 * F-1 (2026-04-19) — `Connect Apple Health` crash on iOS 26.5.
 *
 * ASC feedback ids: `AC0AeyMF3Ehhq0lJ1AXQmyk` (build 10, 2026-04-19 15:01Z),
 * `AHhgUl6i1lax8FBuUU0bprg` (build 9, 01:55Z), `AEXP_nvFy4c7Fde3PhCdK6w`
 * (build 9, 01:55Z). All three: "crashes every time I try to connect
 * Apple Health". Same tester, stale Health data on Today (Steps 4,411 /
 * Active 482 per screenshot `AN8GJ1Dr3M`) consistent with sync aborting
 * mid-run.
 *
 * Structural pin, same style as `keyboardSafeViewAdoption.test.ts` and
 * `createRecipeNormalisationParity.test.ts`. The fix was:
 *   1. Defensive try/catch + safe-fallback branches around every exported
 *      helper in `healthSyncCorrelation.ts` (no force-unwraps, no bare
 *      property access on possibly-non-object `sample.metadata`, no
 *      bare `.get()` on a possibly-hostile Map).
 *   2. Top-level try/catch in `healthSync.ts` around
 *      `requestHealthPermissions`, `syncHealthData`, `syncNutritionFromHealth`,
 *      and `syncNutritionFromHealthThrottled`, each reporting via
 *      `errorTracking.captureException` so we can symbolicate next build.
 *   3. Top-level try/catch in the `handleConnect` callback of
 *      `app/health-sync.tsx` so any remaining native-side throw degrades
 *      to a recoverable Alert instead of a hard crash.
 *
 * This test grep-pins those three artefacts so a future refactor that
 * strips a guard (e.g. "simplifying" an error path) will fail here
 * instead of re-introducing the 100% crash.
 *
 * Web parity: N/A — Apple Health is iOS-only. There is no equivalent
 * surface on `web/` or the shared `src/` tree. Documented in
 * `docs/testflight-feedback/resolved.md` under F-1.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf-8");
}

describe("F-1 structural pin — `healthSyncCorrelation.ts` defensive guards", () => {
  const src = read("lib/healthSyncCorrelation.ts");

  it("every exported function body contains at least one try/catch", () => {
    // Each exported helper that touches caller-supplied data must have
    // a try/catch so a malformed native payload never throws up the
    // stack. We grep for the `export function` keyword, then verify
    // the function body (up to the next top-level `export`/`}` block)
    // contains a `try {` and a `catch`.
    const exports = [
      "buildQuantityIdToCorrelationId",
      "dietaryCorrelationKeyForSample",
      "bucketEnergyShares",
      "detectBulkSync",
    ] as const;
    for (const name of exports) {
      const idx = src.indexOf(`export function ${name}`);
      expect(idx, `missing export: ${name}`).toBeGreaterThan(-1);
      // Scan forward until the next `export function` or end of file,
      // whichever comes first — that region is the function body.
      const after = src.slice(idx + 1);
      const nextExport = after.search(/\nexport\s+function\s+/);
      const body = nextExport === -1 ? after : after.slice(0, nextExport);
      expect(body.includes("try {"), `${name} missing try {`).toBe(true);
      expect(body.match(/\}\s*catch/), `${name} missing catch`).toBeTruthy();
    }
  });

  it("metaString guards against non-object metadata (Proxy / string / array) before key lookup", () => {
    // The function is not exported but is the crash surface — guard
    // against a future refactor dropping the `typeof meta === 'object'`
    // + `!Array.isArray(meta)` check.
    expect(src).toMatch(/function metaString/);
    const body = src.slice(src.indexOf("function metaString"), src.indexOf("function parseInstant"));
    expect(body).toMatch(/typeof meta !== "object"/);
    expect(body).toMatch(/Array\.isArray\(meta\)/);
    // Each key read is inside its own try/catch — Proxy getters can throw.
    expect(body).toMatch(/try \{[\s\S]+?\}\s*catch/);
  });

  it("parseInstant tolerates null / undefined / non-string / invalid-date input", () => {
    const body = src.slice(src.indexOf("function parseInstant"), src.indexOf("function effectiveConsumptionInstant"));
    expect(body).toMatch(/try \{/);
    expect(body).toMatch(/\}\s*catch/);
    expect(body).toMatch(/typeof isoOrDate !== "string"/);
  });
});

describe("F-1 structural pin — `healthSync.ts` top-level try/catch + Sentry reporting", () => {
  const src = read("lib/healthSync.ts");

  it("imports `captureException` from the local errorTracking module", () => {
    expect(src).toMatch(/import\s+\{\s*captureException\s*\}\s+from\s+["']\.\/errorTracking["']/);
  });

  it("each public HealthKit entry-point function has a top-level try/catch that calls captureException", () => {
    const entryPoints = [
      "requestHealthPermissions",
      "syncHealthData",
      "syncNutritionFromHealth",
      "syncNutritionFromHealthThrottled",
    ] as const;
    for (const name of entryPoints) {
      const idx = src.indexOf(`export async function ${name}`);
      expect(idx, `missing export: ${name}`).toBeGreaterThan(-1);
      const after = src.slice(idx);
      // Find the end of this function's brace block (conservative:
      // scan to the next `export async function` or `export function`).
      const nextExport = after.slice(1).search(/\nexport\s+(async\s+)?function\s+/);
      const body = nextExport === -1 ? after : after.slice(0, nextExport + 1);
      expect(body.includes("try {"), `${name} missing try {`).toBe(true);
      expect(body.match(/\}\s*catch/), `${name} missing catch`).toBeTruthy();
      expect(body.includes("captureException"), `${name} missing captureException`).toBe(true);
    }
  });

  it("keeps `FoodCorrelation` in the permission read set — required by the P0-2 MFP bulk-sync fix", () => {
    // Regression guard: the crash-safety pass must not drop the
    // correlation read permission, which powers per-meal macro
    // attribution via `getFoodCorrelationSamples`.
    expect(src).toMatch(/"FoodCorrelation"/);
  });
});

describe("F-1 structural pin — `app/health-sync.tsx` handleConnect guarded", () => {
  const src = read("app/health-sync.tsx");

  it("handleConnect wraps the requestHealthPermissions call in try/catch with a recoverable Alert", () => {
    const idx = src.indexOf("const handleConnect");
    expect(idx).toBeGreaterThan(-1);
    const after = src.slice(idx);
    const end = after.indexOf("}, [available]);");
    expect(end).toBeGreaterThan(-1);
    const body = after.slice(0, end);
    expect(body).toMatch(/try \{/);
    expect(body).toMatch(/\}\s*catch/);
    // The recovery alert must be present — without it a native-side
    // throw would silently swallow the tap and the user sees nothing.
    expect(body).toMatch(/Couldn.?t connect/);
  });
});
