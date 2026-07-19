import { describe, expect, it } from "vitest";

import {
  barcodeProvenanceLabel,
  barcodeTrustProvenanceLabel,
  barcodeTrustSourceName,
} from "../../src/lib/nutrition/barcodeProvenance";

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

describe("canonical barcode provenance (ENG-1567)", () => {
  it("names the promoted community corpus without a generic trust claim", () => {
    const product = {
      source: "verified",
      verified: true,
      verificationStatus: "verified" as const,
    };
    expect(barcodeTrustSourceName(product)).toBe("Sloe community");
    expect(barcodeTrustProvenanceLabel(product)).toBe("Sloe community");
  });

  it("names Open Food Facts for the external fallback", () => {
    const product = { source: "open_food_facts", verified: false };
    expect(barcodeTrustSourceName(product)).toBe("Open Food Facts");
    expect(barcodeTrustProvenanceLabel(product)).toBe("via Open Food Facts");
  });

  it("keeps the honest pending state for the viewer's own submission", () => {
    const product = {
      source: "user",
      verified: false,
      verificationStatus: "pending" as const,
      isOwnSubmission: true,
    };
    expect(barcodeTrustSourceName(product)).toBe("Community submitted");
    expect(barcodeTrustProvenanceLabel(product)).toBe("Not yet confirmed");
  });
});
