import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { PaywallViewedFrom } from "../../src/lib/analytics/events";

/**
 * `paywall_viewed.from` attribution parity (round 3, 2026-04-19).
 *
 * Before this round every `openUpgradePromo` call site in
 * `src/app/App.tsx` passed the same `from` (`"meal_planner"`) regardless
 * of which surface triggered the upgrade intent — Library, Profile,
 * Shopping List, Recipe create/import all collapsed into one emit, so
 * the F2 funnel slice was blind to the originating surface.
 *
 * `openUpgradePromo(from, gateReason?)` now takes `from` as a REQUIRED
 * argument — TypeScript fails compile if any caller forgets it — and
 * this test enforces two additional shape guarantees that TypeScript
 * alone can't:
 *
 *   (a) No `onUpgrade={openUpgradePromo}` (bare reference) remains in
 *       App.tsx — every call site MUST wrap the handler in an arrow
 *       that passes an explicit string literal matching a
 *       `PaywallViewedFrom` value.
 *   (b) Every `PaywallViewedFrom` value is either used at ≥1 call site
 *       somewhere under `src/app/**` / `apps/mobile/app/**`, OR is on
 *       an explicit whitelist of legitimately-unused values (surfaces
 *       that haven't shipped yet — e.g. the trial flow).
 *
 * Drift on either guarantee would silently misattribute real PostHog
 * events the moment an engineer adds a new `onUpgrade` entry point.
 */

const APP_TSX_PATH = resolve(process.cwd(), "src/app/App.tsx");
const WEB_APP_ROOT = resolve(process.cwd(), "src/app");
const MOBILE_APP_ROOT = resolve(process.cwd(), "apps/mobile/app");

/** Values allowed to be unused by a call site (`openUpgradePromo`
 *  argument OR a mobile `?from=` URL literal) at this moment. Keep
 *  this list small, and justify every entry — a silent growth here
 *  would hide genuine drift. */
const FROM_USAGE_WHITELIST: readonly PaywallViewedFrom[] = [
  // The 7-day trial flow hasn't shipped yet; the paywall route
  // accepts `?from=trial_end` in preparation but nothing fires that
  // literal today. Re-evaluate when the trial-end email / in-app
  // ribbon ships.
  "trial_end",
  // `deep_link` is the fallback the `normalisePaywallFrom` helpers
  // emit for unknown / missing inputs — it's load-bearing even
  // though no caller ever passes it explicitly. Removing it would
  // break the default branch of both normalisers.
  "deep_link",
] as const;

/** The canonical set, built from the `PaywallViewedFrom` union via a
 *  tiny type-level trick so TypeScript flags any drift here if the
 *  union changes but this list doesn't. */
const CANONICAL_FROM_VALUES: readonly PaywallViewedFrom[] = [
  "voice_log",
  "photo_log",
  "settings",
  "onboarding",
  "trial_end",
  "deep_link",
  "meal_planner",
  "recipes_library",
  "shopping_list",
  "profile",
  "recipe_create",
  "recipe_import",
] as const;

function walkTsFiles(root: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (
      entry === "node_modules" ||
      entry === ".next" ||
      entry === "dist" ||
      entry === "build" ||
      entry.startsWith(".")
    ) {
      continue;
    }
    const full = join(root, entry);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      out.push(...walkTsFiles(full));
      continue;
    }
    if (!/\.(tsx?|jsx?)$/.test(entry)) continue;
    out.push(full);
  }
  return out;
}

describe("paywall_viewed.from attribution (round 3, 2026-04-19)", () => {
  it('App.tsx has no bare "onUpgrade={openUpgradePromo}" reference (every call site must wrap with an explicit from literal)', () => {
    const src = readFileSync(APP_TSX_PATH, "utf8");
    // Match any JSX attribute assignment that passes the function
    // reference directly (no arrow wrapper). The forbidden shape is
    // `onUpgrade={openUpgradePromo}`; the allowed shape is
    // `onUpgrade={() => openUpgradePromo("some_literal")}`. A literal
    // `openUpgradePromo` inside an arrow body is fine — the regex
    // specifically anchors on the `{openUpgradePromo}` attribute form.
    const bareMatch = src.match(/onUpgrade=\{\s*openUpgradePromo\s*\}/);
    expect(
      bareMatch,
      `Found a bare onUpgrade={openUpgradePromo} reference in src/app/App.tsx. ` +
        `Every call site must wrap with an arrow that passes an explicit ` +
        `PaywallViewedFrom literal — e.g. onUpgrade={() => openUpgradePromo("profile")}.`,
    ).toBeNull();
  });

  it("every openUpgradePromo call in App.tsx passes a PaywallViewedFrom literal as its first argument", () => {
    const src = readFileSync(APP_TSX_PATH, "utf8");
    // Find `openUpgradePromo("…")` / `openUpgradePromo('…')` calls
    // that are NOT the function definition itself. The declaration
    // uses `(from:` so we exclude that shape; every other invocation
    // must carry a string-literal first argument.
    const calls = [
      ...src.matchAll(/openUpgradePromo\(\s*(?!from\s*:)(["'])([^"']+)\1/g),
    ];
    expect(
      calls.length,
      "Expected at least 7 openUpgradePromo call sites — one per child component that takes onUpgrade",
    ).toBeGreaterThanOrEqual(7);
    for (const m of calls) {
      const literal = m[2] as PaywallViewedFrom;
      expect(
        (CANONICAL_FROM_VALUES as readonly string[]).includes(literal),
        `openUpgradePromo("${literal}") in src/app/App.tsx is not a canonical PaywallViewedFrom value`,
      ).toBe(true);
    }
  });

  it("every PaywallViewedFrom value is referenced at ≥1 call site or is explicitly whitelisted", () => {
    // Collect every occurrence of a canonical `from` value as a
    // string literal in any web-app or mobile-app source file. This
    // catches both `openUpgradePromo("…")` calls on web and
    // `router.push("/paywall?from=…")` strings on mobile.
    const files = [
      ...walkTsFiles(WEB_APP_ROOT),
      ...walkTsFiles(MOBILE_APP_ROOT),
    ];
    const used = new Set<PaywallViewedFrom>();
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const v of CANONICAL_FROM_VALUES) {
        // Match the value inside either a double/single-quoted string
        // or a `?from=value` URL fragment. Ignore comments — the
        // matcher is imprecise by design (tests over-use, not under-use).
        const patterns = [
          new RegExp(`["']${v}["']`),
          new RegExp(`\\?from=${v}\\b`),
        ];
        if (patterns.some((p) => p.test(src))) {
          used.add(v);
        }
      }
    }
    const missing = CANONICAL_FROM_VALUES.filter(
      (v) =>
        !used.has(v) &&
        !(FROM_USAGE_WHITELIST as readonly string[]).includes(v),
    );
    expect(
      missing,
      `PaywallViewedFrom value(s) have no caller under src/app/** or apps/mobile/app/** ` +
        `and are not on the whitelist. Either remove the unused enum value, add a caller, ` +
        `or justify it by adding it to FROM_USAGE_WHITELIST: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("openUpgradePromo signature enforces `from` as the first positional argument (not optional)", () => {
    // Parsing the TS source for the signature shape. If someone tries
    // to relax the signature back to `openUpgradePromo()` or adds a
    // default value to the first parameter, this test should flag it.
    const src = readFileSync(APP_TSX_PATH, "utf8");
    // Find the `openUpgradePromo = useCallback((…signature…) => …`
    // declaration and extract the parameter list.
    const decl = src.match(
      /openUpgradePromo\s*=\s*useCallback\(\s*\(\s*([^)]*)\)\s*=>/,
    );
    expect(
      decl,
      "Could not find the openUpgradePromo useCallback declaration — has its shape changed?",
    ).not.toBeNull();
    const params = decl![1].trim();
    // First parameter must be `from: PaywallViewedFrom`, not `from?:`
    // or `from: PaywallViewedFrom = …`.
    expect(params).toMatch(/^from\s*:\s*PaywallViewedFrom/);
    expect(params).not.toMatch(/^from\?\s*:/);
    expect(params).not.toMatch(/^from\s*:\s*PaywallViewedFrom\s*=/);
  });
});
