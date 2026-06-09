import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../../apps/mobile/app/paywall.tsx"),
  "utf-8",
);

// 284:2 rebuild (2026-06-08): the kicker text moved into PaywallHero.tsx;
// the billing-period segmented toggle was replaced by PaywallPlanSelector.tsx.
// ENG-617 contrast intent is preserved — read both child sources.
const HERO_SRC = readFileSync(
  resolve(__dirname, "../../apps/mobile/components/paywall/PaywallHero.tsx"),
  "utf-8",
);
const SELECTOR_SRC = readFileSync(
  resolve(__dirname, "../../apps/mobile/components/paywall/PaywallPlanSelector.tsx"),
  "utf-8",
);

describe("Paywall dark-mode contrast (ENG-617)", () => {
  // 284:2 (2026-06-08): the paywall kicker ("SLOE PRO") moved from an inline
  // StyleSheet entry `headerKicker` in paywall.tsx into PaywallHero.tsx, where
  // it is coloured with `accent.primarySolid` (#3B2A4D ≈ 12:1 on white — AA).
  // Assert the kicker uses the accent solid token (not textTertiary which fails
  // dark-mode contrast at 2.7:1).
  it("PaywallHero kicker text uses accent.primarySolid, not textTertiary", () => {
    // The kicker line renders <Text style={[Type.label, { color: accent.primarySolid, ... }]}>
    expect(HERO_SRC).toContain("accent.primarySolid");
    expect(HERO_SRC).not.toContain("textTertiary");
  });

  // 284:2 (2026-06-08): the billing-period segmented toggle was replaced by
  // PaywallPlanSelector. The surviving secondary text elements in the selector
  // (per-month subtitle, price period suffix) must use textSecondary, not
  // textTertiary, so they clear AA in dark mode.
  it("PaywallPlanSelector secondary text uses textSecondary, not textTertiary", () => {
    // rowSubtitle (per-month line) and pricePeriod ("/yr", "/mo") are the
    // contrast-critical secondary text slots in the plan selector.
    const rowSubtitle = SELECTOR_SRC.match(/rowSubtitle:\s*\{[^}]+\}/s)?.[0] ?? "";
    expect(rowSubtitle).toContain("textSecondary");
    expect(rowSubtitle).not.toContain("textTertiary");

    const pricePeriod = SELECTOR_SRC.match(/pricePeriod:\s*\{[^}]+\}/s)?.[0] ?? "";
    expect(pricePeriod).toContain("textSecondary");
    expect(pricePeriod).not.toContain("textTertiary");
  });

  it("freeBtnText uses textSecondary for readability", () => {
    const freeBtnBlock = SRC.match(/freeBtnText:\s*\{[^}]+\}/s)?.[0] ?? "";
    expect(freeBtnBlock).toContain("textSecondary");
    expect(freeBtnBlock).not.toContain("textTertiary");
  });

  it("disclosure notes use textSecondary for legibility", () => {
    const promoHint = SRC.match(/promoHint:\s*\{[^}]+\}/s)?.[0] ?? "";
    expect(promoHint).toContain("textSecondary");

    const secondaryNote = SRC.match(/secondaryNote:\s*\{[^}]+\}/s)?.[0] ?? "";
    expect(secondaryNote).toContain("textSecondary");
  });

  it("trust chips use textSecondary (DC4 readability)", () => {
    const trustChipText = SRC.match(/trustChipText:\s*\{[^}]+\}/s)?.[0] ?? "";
    expect(trustChipText).toContain("textSecondary");
  });
});
