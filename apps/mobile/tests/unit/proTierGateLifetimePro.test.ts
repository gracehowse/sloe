/**
 * ENG (Pro-lockout) — every mobile screen that reads `profiles.user_tier` to
 * decide paid-feature access MUST normalise it through `normaliseCachedTier`,
 * which collapses the founding-cohort `lifetime_pro` comp (ENG-1043) to `pro`.
 *
 * The regression this pins: several screens used an inline three-value whitelist
 * `t === "free" || t === "base" || t === "pro" ? t : "free"` that silently
 * dropped `lifetime_pro` to `"free"` — locking founder accounts out of Voice,
 * AI-photo, planner day-count, and the Settings/profile Pro surfaces even though
 * they are entitled. `normaliseCachedTier` is the single correct resolver.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

// Every mobile site that resolves user_tier into a gate decision.
const GATE_SITES = [
  "app/(tabs)/_today/TodayScreen.tsx",
  "app/(tabs)/planner.tsx",
  "app/profile.tsx",
  "app/import-shared.tsx",
  "components/settings/SettingsBundleContent.tsx",
  "components/recipe/CreateRecipeActionSheet.tsx",
];

// The exact bug shape: an inline whitelist that omits lifetime_pro and falls
// back to "free". Matches `X === "free" || X === "base" || X === "pro"` used as
// a resolver (with a `? … : "free"` or an `else … "free"`).
const LIFETIME_PRO_DROPPING_RESOLVER =
  /===\s*"free"\s*\|\|\s*\w+\s*===\s*"base"\s*\|\|\s*\w+\s*===\s*"pro"/;

describe("Today hydrates the tier from cache (no Free-flash on the primary surface)", () => {
  // ENG (Pro-lockout): TodayScreen gates Voice / AI-photo on `userTier`. Without
  // a synchronous cache hydrate it renders "free" until the async profiles read
  // lands, flashing those Pro affordances locked for a real Pro on every mount.
  const today = readFileSync(
    resolve(ROOT, "app/(tabs)/_today/TodayScreen.tsx"),
    "utf8",
  );
  it("loads the cached tier before the async profiles read", () => {
    expect(today).toContain("loadCachedUserTier");
  });
});

describe("Pro-tier gates normalise lifetime_pro → pro (no founder lockout)", () => {
  for (const rel of GATE_SITES) {
    const src = readFileSync(resolve(ROOT, rel), "utf8");

    it(`${rel} resolves user_tier through normaliseCachedTier`, () => {
      expect(src).toContain("normaliseCachedTier");
    });

    it(`${rel} no longer uses the lifetime_pro-dropping inline whitelist`, () => {
      expect(src).not.toMatch(LIFETIME_PRO_DROPPING_RESOLVER);
    });
  }
});
