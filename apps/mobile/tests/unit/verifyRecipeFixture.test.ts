import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  VERIFY_FIXTURE_INGREDIENTS,
  VERIFY_FIXTURE_RECIPE,
  fixtureModeRequested,
} from "@/lib/verifyRecipeFixture";

describe("verifyRecipeFixture (ENG-1066 agent path)", () => {
  it("seeds matched ingredient rows for the verify fixture deeplink", () => {
    expect(VERIFY_FIXTURE_RECIPE.servings).toBeGreaterThan(0);
    expect(VERIFY_FIXTURE_INGREDIENTS.length).toBeGreaterThanOrEqual(3);
    for (const row of VERIFY_FIXTURE_INGREDIENTS) {
      expect(row.matchedName).toBeTruthy();
      expect(row.confidence).toBeGreaterThan(0);
    }
  });
});

describe("fixtureModeRequested — param-presence predicate (audit 2026-06-12 P2 #3)", () => {
  it("recognises the Maestro deeplink shapes", () => {
    expect(fixtureModeRequested({ fixture: "1" })).toBe(true);
    expect(fixtureModeRequested({ fixture: "true" })).toBe(true);
    expect(fixtureModeRequested({ id: "fixture" })).toBe(true);
  });

  it("returns false for normal recipe ids and absent params", () => {
    expect(fixtureModeRequested({ id: "abc-123" })).toBe(false);
    expect(fixtureModeRequested({})).toBe(false);
    expect(fixtureModeRequested({ fixture: "0" })).toBe(false);
    expect(fixtureModeRequested({ fixture: "" })).toBe(false);
  });

  it("does NOT consult __DEV__ itself — it is param-only (the screen ANDs in __DEV__)", () => {
    // The predicate is intentionally __DEV__-unaware so it's testable without
    // the RN global. The screen composes it with `&& __DEV__`.
    expect(fixtureModeRequested({ fixture: "1" })).toBe(true);
  });
});

// The verify screen's effective gate is `fixtureModeRequested(params) &&
// __DEV__`. The behavioural half (`fixtureModeRequested` truth table) is
// covered above; the release-build guarantee is pinned against the REAL
// `verify.tsx` expression below — a mirrored local function would keep
// passing if the screen dropped its `&& __DEV__` (audit 2026-06-12 review
// m1), so the pin reads the actual source (labelled source-pin, not
// behavioural).
describe("verify fixture gate — the screen's own isFixture ANDs in __DEV__ (source pin)", () => {
  const VERIFY_SRC = readFileSync(
    resolve(__dirname, "..", "..", "app", "recipe", "verify.tsx"),
    "utf8",
  );

  it("verify.tsx composes fixtureModeRequested(...) && __DEV__ in one expression", () => {
    // Matches the literal gate:
    //   const isFixture =
    //     fixtureModeRequested({ id, fixture }) &&
    //     typeof __DEV__ !== "undefined" &&
    //     __DEV__;
    expect(VERIFY_SRC).toMatch(
      /const\s+isFixture\s*=\s*fixtureModeRequested\(\{ id, fixture \}\)\s*&&[\s\S]{0,120}?__DEV__/,
    );
  });

  it("no other fixture-mode derivation bypasses the gate", () => {
    // `fixtureModeRequested` must appear exactly once in the screen (the
    // gated expression) — a second call site could re-introduce an ungated
    // fixture path.
    const calls = VERIFY_SRC.match(/fixtureModeRequested\(/g) ?? [];
    expect(calls.length).toBe(1);
  });
});
