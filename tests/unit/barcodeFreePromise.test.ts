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
    for (const rel of [
      "src/app/components/suppr/upgrade-paywall-dialog.tsx",
      "apps/mobile/app/paywall.tsx",
    ]) {
      const src = readFileSync(join(root, rel), "utf8");
      expect(src).toContain("BARCODE_FREE_PAYWALL_CHIP_TEST_ID");
      expect(src).toContain("BARCODE_FREE_PAYWALL_CHIP");
    }
  });

  it("LogSheet hosts wire loud barcode CTA test id", () => {
    const root = process.cwd();
    for (const rel of [
      "src/app/components/suppr/log-sheet.tsx",
      "apps/mobile/components/today/LogSheet.tsx",
    ]) {
      const src = readFileSync(join(root, rel), "utf8");
      expect(src).toContain("log-sheet-loud-barcode-cta");
      expect(src).toContain("BARCODE_LOUD_CTA_LABEL");
    }
  });
});
