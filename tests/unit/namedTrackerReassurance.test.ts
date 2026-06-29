/**
 * ENG-1258 — named-tracker reassurance strip (B18 option C).
 */
import { describe, expect, it } from "vitest";

import { namedTrackerReassuranceItems } from "@/lib/imports/namedTrackerReassurance";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WEB_CARD = readFileSync(
  resolve(__dirname, "../../src/app/components/imports/MfpCsvImportCard.tsx"),
  "utf8",
);
const MOBILE_CARD = readFileSync(
  resolve(__dirname, "../../apps/mobile/components/imports/MfpCsvImportCard.tsx"),
  "utf8",
);

describe("namedTrackerReassuranceItems", () => {
  it("lists every registered CSV adapter", () => {
    const items = namedTrackerReassuranceItems();
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items.map((i) => i.label)).toContain("MyFitnessPal");
    expect(items.map((i) => i.label)).toContain("Lose It");
    expect(items.map((i) => i.label)).toContain("Cronometer");
  });
});

describe("ENG-1258 MfpCsvImportCard reassurance strip", () => {
  it("gates strip behind mfp_tracker_reassurance_v1 on web + mobile", () => {
    expect(WEB_CARD).toMatch(/mfp_tracker_reassurance_v1/);
    expect(WEB_CARD).toMatch(/NamedTrackerReassuranceStrip/);
    expect(MOBILE_CARD).toMatch(/mfp_tracker_reassurance_v1/);
    expect(MOBILE_CARD).toMatch(/NamedTrackerReassuranceStrip/);
  });

  it("hides strip when highlightApp is set (user already picked their app)", () => {
    expect(WEB_CARD).toMatch(/!highlighted/);
    expect(MOBILE_CARD).toMatch(/!highlighted/);
  });
});
