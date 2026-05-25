import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../../apps/mobile/app/paywall.tsx"),
  "utf-8",
);

describe("Paywall dark-mode contrast (ENG-617)", () => {
  it("headerKicker uses textSecondary, not textTertiary", () => {
    const headerKickerBlock = SRC.match(/headerKicker:\s*\{[^}]+\}/s)?.[0] ?? "";
    expect(headerKickerBlock).toContain("textSecondary");
    expect(headerKickerBlock).not.toContain("textTertiary");
  });

  it("toggleEyebrow uses textSecondary, not textTertiary", () => {
    const toggleEyebrowBlock = SRC.match(/toggleEyebrow:\s*\{[^}]+\}/s)?.[0] ?? "";
    expect(toggleEyebrowBlock).toContain("textSecondary");
    expect(toggleEyebrowBlock).not.toContain("textTertiary");
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
