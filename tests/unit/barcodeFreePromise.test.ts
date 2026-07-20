import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  BARCODE_FREE_PAYWALL_CHIP,
  BARCODE_FREE_PAYWALL_CHIP_TEST_ID,
  BARCODE_LOUD_CTA_LABEL,
} from "../../src/lib/nutrition/barcodeFreePromise";

describe("barcodeFreePromise (ENG-932 / ENG-973)", () => {
  it("exports loud CTA + paywall chip copy", () => {
    expect(BARCODE_LOUD_CTA_LABEL).toBe("Scan barcode");
    expect(BARCODE_FREE_PAYWALL_CHIP.label).toMatch(/free/i);
    expect(BARCODE_FREE_PAYWALL_CHIP.a11yLabel).toMatch(/MyFitnessPal/i);
    expect(BARCODE_FREE_PAYWALL_CHIP_TEST_ID).toBe("paywall-barcode-free-chip");
  });

  it("web + mobile paywall surfaces render the chip test id", () => {
    const root = process.cwd();
    const webUpgrade = readFileSync(
      join(root, "src/app/components/suppr/upgrade-paywall-dialog.tsx"),
      "utf8",
    );
    const webTrustStrip = readFileSync(
      join(root, "app/pricing/PaywallTrustStrip.tsx"),
      "utf8",
    );
    expect(webUpgrade).toContain("<PaywallTrustStrip");
    expect(webTrustStrip).toContain("BARCODE_FREE_PAYWALL_CHIP_TEST_ID");
    expect(webTrustStrip).toContain("BARCODE_FREE_PAYWALL_CHIP");

    const mobilePaywall = readFileSync(join(root, "apps/mobile/app/paywall.tsx"), "utf8");
    const mobileTrustStrip = readFileSync(
      join(root, "apps/mobile/components/paywall/PaywallTrustStrip.tsx"),
      "utf8",
    );
    expect(mobilePaywall).toContain("<PaywallTrustStrip");
    expect(mobileTrustStrip).toContain("BARCODE_FREE_PAYWALL_CHIP_TEST_ID");
    expect(mobileTrustStrip).toContain("BARCODE_FREE_PAYWALL_CHIP");
  });

  it("LogSheet loud barcode CTA carries its test id + copy constant", () => {
    // ENG-1303 — the loud CTA + free-forever line were extracted from the
    // flagship LogSheet into a sibling `LogSheetBarcodeFreePromise` on each
    // platform (to hold the screen-line budget as the v3 method grid landed).
    // The testid + copy constant now live there; the hosts wire the component.
    const root = process.cwd();
    for (const rel of [
      "src/app/components/suppr/log-sheet-barcode-free-promise.tsx",
      "apps/mobile/components/today/LogSheetBarcodeFreePromise.tsx",
    ]) {
      const src = readFileSync(join(root, rel), "utf8");
      expect(src).toContain("log-sheet-loud-barcode-cta");
      expect(src).toContain("BARCODE_LOUD_CTA_LABEL");
    }
    for (const rel of [
      "src/app/components/suppr/log-sheet.tsx",
      "apps/mobile/components/today/LogSheet.tsx",
    ]) {
      const src = readFileSync(join(root, rel), "utf8");
      expect(src).toContain("LogSheetBarcodeFreePromise");
    }
  });

  it("LogSheet loud barcode CTA uses hairline border grammar (ENG-1610)", () => {
    const root = process.cwd();
    const mobile = readFileSync(
      join(root, "apps/mobile/components/today/LogSheetBarcodeFreePromise.tsx"),
      "utf8",
    );
    const web = readFileSync(
      join(root, "src/app/components/suppr/log-sheet-barcode-free-promise.tsx"),
      "utf8",
    );
    expect(mobile).toMatch(/borderWidth:\s*1\b/);
    expect(mobile).toContain("accent.primarySoftStrong");
    expect(mobile).not.toMatch(/borderWidth:\s*(1\.5|2)\b/);
    expect(web).toMatch(/\bborder\b/);
    expect(web).not.toMatch(/\bborder-2\b/);
    expect(web).toContain("--accent-primary-soft-strong");
  });

  it("Today tab census has no 1.5px/2px emphasis borders (ENG-1610)", () => {
    const root = process.cwd();
    const census = [
      "apps/mobile/components/today/TodayEditMealModal.tsx",
      "apps/mobile/components/today/TodayHeaderBar.tsx",
      "apps/mobile/components/today/TodayPlannedMealsCard.tsx",
      "apps/mobile/components/today/TodaySnapShortcut.tsx",
      "apps/mobile/components/today/WhereThisComesFromSheet.tsx",
      "apps/mobile/components/today/PostOnboardingPushExplainer.tsx",
      "src/app/components/suppr/today-snap-shortcut.tsx",
    ];
    for (const rel of census) {
      const src = readFileSync(join(root, rel), "utf8");
      expect(src, rel).not.toMatch(/borderWidth:\s*(1\.5|2)\b/);
      expect(src, rel).not.toMatch(/\bborder-2\b/);
      expect(src, rel).not.toMatch(/border-\[1\.5px\]/);
    }
  });
});
