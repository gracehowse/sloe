import { describe, expect, it } from "vitest";

import { barcodeProvenanceLabel } from "../../src/lib/nutrition/barcodeProvenance";

describe("barcodeProvenanceLabel (ENG-1251 P1-C)", () => {
  it("own pending submission → Not yet confirmed", () => {
    expect(
      barcodeProvenanceLabel({
        source: "user",
        verified: false,
        verificationStatus: "pending",
        isOwnSubmission: true,
      }),
    ).toBe("Not yet confirmed");
  });

  it("verified canonical row → Verified entry", () => {
    expect(
      barcodeProvenanceLabel({
        source: "verified",
        verified: true,
        verificationStatus: "verified",
        isOwnSubmission: false,
      }),
    ).toBe("Verified entry");
  });

  it("someone else's community row → Community submitted", () => {
    expect(
      barcodeProvenanceLabel({
        source: "user",
        verified: false,
        verificationStatus: "pending",
        isOwnSubmission: false,
      }),
    ).toBe("Community submitted");
  });

  it("Open Food Facts fallback → via Open Food Facts", () => {
    expect(barcodeProvenanceLabel({ source: "off", verified: false })).toBe(
      "via Open Food Facts",
    );
  });
});
