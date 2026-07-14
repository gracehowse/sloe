import { describe, expect, it } from "vitest";

import { withAlpha } from "../../constants/theme";

/**
 * ENG-1521 — locks the PRESERVE-EXACT contract of the withAlpha helper that
 * replaced ~282 ad-hoc `colour + "XX"` alpha-concat sites across 104 files:
 * withAlpha(c, 0x18) must be byte-identical to the old colour+hex concat it replaced.
 */
describe("ENG-1521 — withAlpha byte-identity", () => {
  it("is byte-identical to the old `color + hex` concat (uppercase suffix)", () => {
    const c = "#3B2A4D";
    const cases: readonly [number, string][] = [
      [0x10, "10"], [0x14, "14"], [0x18, "18"], [0x1a, "1A"], [0x22, "22"],
      [0x26, "26"], [0x33, "33"], [0x40, "40"], [0x55, "55"], [0x66, "66"],
      [0x80, "80"], [0xff, "FF"],
    ];
    for (const [byte, hex] of cases) {
      expect(withAlpha(c, byte)).toBe(c + hex);
    }
  });

  it("zero-pads single-digit bytes to two hex chars", () => {
    expect(withAlpha("#000000", 0x0a)).toBe("#0000000A");
    expect(withAlpha("#000000", 0)).toBe("#00000000");
  });
});
