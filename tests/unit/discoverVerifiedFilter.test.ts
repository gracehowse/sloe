/**
 * Discover "Verified only" filter (ENG-1417, tl-F6) — wires the
 * previously-dead `filters.verified` state: the field existed and was
 * checked (the render-gate predicate and the `showClusterCarousels`
 * empty-state gate both already read it), but no UI control ever set it
 * to `true`.
 *
 * Source-pin (the 1100+-line `DiscoverFeed.tsx` isn't mounted in unit
 * tests, matching the repo idiom — see `discoverClusterCarousels.test.ts`).
 * The chip itself lives in `DiscoverFilterChips.tsx` (extracted from
 * `DiscoverFeed.tsx` for the screen-budget pin). Web-only: mobile Discover
 * has no equivalent filter sheet, so this flag is registered on mobile
 * purely for the KNOWN_DEFAULT_OFF_FLAGS parity check (see
 * `redesignDefaultOnParity.test.ts` and its siblings).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const DISCOVER = readFileSync(resolve(ROOT, "src/app/components/DiscoverFeed.tsx"), "utf8");
const FILTER_CHIPS = readFileSync(
  resolve(ROOT, "src/app/components/DiscoverFilterChips.tsx"),
  "utf8",
);
const WEB_TRACK = readFileSync(resolve(ROOT, "src/lib/analytics/track.ts"), "utf8");
const MOBILE_ANALYTICS = readFileSync(resolve(ROOT, "apps/mobile/lib/analytics.ts"), "utf8");

describe("ENG-1417 / ENG-1567 — Discover source-backed filter chip", () => {
  it("is registered as a default-OFF flag (net-new structural control)", () => {
    expect(WEB_TRACK).toContain('"discover_verified_filter_v1"');
    const defaultOnStart = WEB_TRACK.indexOf("const REDESIGN_DEFAULT_ON");
    const defaultOnBlock = WEB_TRACK.slice(defaultOnStart, WEB_TRACK.indexOf("]);", defaultOnStart));
    expect(defaultOnBlock).not.toContain("discover_verified_filter_v1");
    expect(WEB_TRACK).toMatch(
      /KNOWN_DEFAULT_OFF_FLAGS = \[[\s\S]*?"discover_verified_filter_v1"[\s\S]*?\] as const;/,
    );
  });

  it("is registered on mobile too, for the cross-platform parity check", () => {
    // Web-only in practice, but KNOWN_DEFAULT_OFF_FLAGS has no per-platform
    // carve-out mechanism (unlike REDESIGN_DEFAULT_ON's WEB_ONLY/MOBILE_ONLY) —
    // the two lists must be identical sets.
    expect(MOBILE_ANALYTICS).toMatch(
      /KNOWN_DEFAULT_OFF_FLAGS = \[[\s\S]*?"discover_verified_filter_v1"[\s\S]*?\] as const;/,
    );
  });

  it("DiscoverFeed renders the extracted chip row with the filters state threaded through", () => {
    expect(DISCOVER).toMatch(/<DiscoverFilterChips[\s\S]*?filters=\{filters\}[\s\S]*?setFilters=\{setFilters\}/);
  });

  it("the chip is flag-gated and toggles filters.verified", () => {
    expect(FILTER_CHIPS).toMatch(
      /isFeatureEnabled\("discover_verified_filter_v1"\)/,
    );
    expect(FILTER_CHIPS).toMatch(
      /setFilters\(\(prev\) => \(\{ \.\.\.prev, verified: !prev\.verified \}\)\)/,
    );
    expect(FILTER_CHIPS).toContain('data-testid="discover-filter-verified"');
    expect(FILTER_CHIPS).toContain('"Source-backed only"');
    expect(FILTER_CHIPS).toContain('"Verified only"');
    expect(FILTER_CHIPS).toMatch(/aria-label=\{`Filter: \$\{sourceFilterLabel\}`\}/);
  });

  it("uses the same chip grammar as the category pills (design-craft parity)", () => {
    // Selected = bg-primary-soft + text-primary-solid + font-semibold, no
    // border. Unselected = bg-card + muted label, no border. (ENG-1022 chip
    // grammar, 2026-06-10.) Both the category pills and the Verified chip
    // route through the same `chipClassName(isActive)` helper.
    expect(FILTER_CHIPS).toMatch(
      /isActive\s*\?\s*\n?\s*"bg-primary-soft text-primary-solid font-semibold"/,
    );
    expect(FILTER_CHIPS).toMatch(/chipClassName\(filters\.verified\)/);
  });

  it("the render-gate and empty-state predicates already read filters.verified (pre-existing wiring, not touched)", () => {
    // showClusterCarousels must exclude verified-filtered views from the
    // carousel view so the flat filtered grid renders instead.
    expect(DISCOVER).toMatch(/!filters\.verified/);
  });
});
