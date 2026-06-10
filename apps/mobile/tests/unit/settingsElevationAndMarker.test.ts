/**
 * ENG-823 + ENG-801 (Redesign — Design Direction 2026, 2026-05-31 design-director
 * review) — Settings soft-elevation + dev-marker gating, source-level pins.
 *
 * ENG-823: every resting section card in the bundle renders through the shared
 * `<SettingsCard>` wrapper, which routes through `useCardElevation`. Per the
 * 2026-06-09 one-card-treatment decision
 * (docs/decisions/2026-06-09-one-card-treatment-soft-elevation.md), every section
 * card sits directly on the page ground, so the wrapper opts into the SOFT lift
 * (`useCardElevation({ variant: "soft" })`) rather than the flat default. The pin
 * guards against a future edit re-introducing a hand-rolled `bg-card +
 * hairline-border` card that drifts off the one-elevation-model spine rule, AND
 * against the wrapper silently reverting to the flat slab.
 *
 * ENG-801: the Build row is `__DEV__`-gated (never ships) AND no longer carries
 * the stale internal capture token (`MARKER F50-...`). The pin fails CI if
 * either the gate is removed or an internal marker token leaks back in.
 *
 * Source-level structural check — no React rendering.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const BUNDLE_PATH = resolve(
  ROOT,
  "components/settings/SettingsBundleContent.tsx",
);
const bundle = readFileSync(BUNDLE_PATH, "utf8");

describe("Settings soft elevation (ENG-823)", () => {
  it("defines a SettingsCard wrapper that consumes useCardElevation with the soft variant", () => {
    expect(bundle).toContain("function SettingsCard");
    expect(bundle).toMatch(/import \{ useCardElevation \} from "@\/hooks\/useCardElevation"/);
    // One-card-treatment (2026-06-09): page-ground section cards take the SOFT
    // lift — the wrapper must opt in, not use the flat no-arg default.
    expect(bundle).toMatch(/useCardElevation\(\{ variant: "soft" \}\)/);
  });

  it("the elevation flag is the only gate — the wrapper never hardcodes a shadow", () => {
    // The flag decision lives in the hook; the wrapper must not reach past it
    // and apply an always-on shadow. (Catches a regression where someone spreads
    // Elevation.cardSoft directly onto the card outside the hook.)
    expect(bundle).not.toMatch(/Elevation\.cardSoft/);
  });

  it("routes the load-bearing section cards through SettingsCard", () => {
    // Each major section card carries a testID on the wrapper so a capture /
    // Maestro pass can target it, and so this pin is meaningful.
    const cardTestIds = [
      "settings-card-membership",
      "settings-card-goals",
      "settings-card-display",
      "settings-card-connections",
      "settings-card-recipes",
      "settings-card-app",
      "settings-card-legal",
      "settings-card-danger",
    ];
    for (const id of cardTestIds) {
      expect(bundle).toContain(`<SettingsCard testID="${id}"`);
    }
  });

  it("no resting section card keeps a hand-rolled hairline-border recipe", () => {
    // The repeated `bg-card + radius-14 + borderWidth: 1 + cardBorder` idiom
    // that SettingsCard replaced must be gone from the section-card layer.
    // (Modal / bottom-sheet surfaces use Radius.lg / borderTopLeftRadius and
    // are deliberately NOT matched here.)
    const handRolledCard =
      /backgroundColor: colors\.card,\s*\n\s*borderRadius: 14,\s*\n\s*borderWidth: 1,\s*\n\s*borderColor: colors\.cardBorder,/g;
    const matches = bundle.match(handRolledCard) ?? [];
    expect(matches.length).toBe(0);
  });
});

describe("Build dev-marker gating (ENG-801)", () => {
  it("the Build row is gated behind __DEV__ so it never ships", () => {
    // The whole Build section is inside a `{__DEV__ ? ( ... ) : null}` block.
    expect(bundle).toMatch(/\{__DEV__ \? \(/);
    // and the build-version Text sits inside that block.
    expect(bundle).toContain('testID="settings-build-marker"');
  });

  it("no stale internal capture marker token leaks into the build string", () => {
    // The legacy `MARKER F50-2026-04-22` relic must be gone; the row shows only
    // the real version + build number. Guards against any `MARKER <token>`
    // pattern returning to a user-readable string.
    expect(bundle).not.toContain("MARKER F50");
    expect(bundle).not.toMatch(/MARKER\s+[A-Z]\d/);
  });

  it("the build string still shows the legitimate version + build number", () => {
    expect(bundle).toContain("Constants.expoConfig?.version");
    expect(bundle).toMatch(/build \$\{/);
  });
});
