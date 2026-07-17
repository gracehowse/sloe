/**
 * ENG-1097 — the Today import onboarding nudge renders as a flat WHITE card
 * (matching every sibling Today card via SupprCard) with a solid aubergine
 * "Try it" CTA, instead of the legacy tinted+bordered slab + outline CTA that
 * predated the flat-card law (Grace 2026-06-13: "is this import in keeping with
 * styling?").
 *
 * Structural source test — RN inline styles are awkward to assert on a render,
 * and the banner's eligibility gating makes a styling-focused render brittle, so
 * this pins the flag wiring + both treatment paths at the source. iOS-only (the
 * nudge has no web surface).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const BANNER = readFileSync(
  resolve(
    __dirname,
    "../../components/today/onboarding-nudges/OnboardingNudgeBanner.tsx",
  ),
  "utf8",
);
const MOBILE_FLAGS = readFileSync(
  resolve(__dirname, "../../lib/analytics.ts"),
  "utf8",
);

describe("ENG-1097 — import nudge flat-white treatment", () => {
  it("registers `import_nudge_flat_white_v1` default-on (mobile)", () => {
    expect(MOBILE_FLAGS).toMatch(/"import_nudge_flat_white_v1"/);
  });

  it("gates the treatment on the flag", () => {
    expect(BANNER).toMatch(/isFeatureEnabled\("import_nudge_flat_white_v1"\)/);
    expect(BANNER).toMatch(/const flatWhite = isFeatureEnabled/);
  });

  it("flag-on renders a flat-white SupprCard (matches sibling Today cards)", () => {
    expect(BANNER).toMatch(/import \{ SupprCard \} from "@\/components\/ui\/SupprCard"/);
    expect(BANNER).toMatch(/if \(flatWhite\) \{[\s\S]*?<SupprCard/);
  });

  it("flag-off keeps the legacy tinted clay-wash + border slab (kill switch)", () => {
    // ENG-1521 — the wash reads the named scheme-resolved Soft token (the old
    // `accent.primary + "0A"` sub-10% concat snapped UP to Soft per the ruling).
    expect(BANNER).toMatch(/accent\.primarySoft/);
    expect(BANNER).toMatch(/borderColor: accent\.primarySoftStrong/);
  });

  it("the 'Try it' CTA is solid aubergine when flat-white, outline when off", () => {
    expect(BANNER).toMatch(
      /backgroundColor: flatWhite \? accent\.primarySolid : "transparent"/,
    );
    expect(BANNER).toMatch(/borderWidth: flatWhite \? 0 : 1\.5/);
    expect(BANNER).toMatch(
      /color: flatWhite \? colors\.primaryForeground : accent\.primarySolid/,
    );
  });
});
