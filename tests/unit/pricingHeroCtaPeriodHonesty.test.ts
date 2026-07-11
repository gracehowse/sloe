/**
 * /pricing hero CTA — period honesty (ENG-1511).
 *
 * Only the annual SKU carries the 7-day trial. The hero CTA label must
 * track the selected period: "Start free trial" on annual, "Subscribe" on
 * monthly — a Monthly view pairing "Start free trial" with the
 * "Charged today · cancel anytime" caption is a false claim (CMA/FTC
 * class). Pins the ternary so the label can't drift back to a constant.
 * Source-assertion style matches `landingProCtaPeriodNeutral.test.ts`.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const SRC = fs.readFileSync(path.join(ROOT, "app/pricing/PricingHeroCta.tsx"), "utf-8");

describe("/pricing hero CTA — period honesty (ENG-1511)", () => {
  it("label is period-aware: trial only on annual, Subscribe on monthly", () => {
    expect(SRC).toMatch(/label=\{isAnnual \? "Start free trial" : "Subscribe"\}/);
  });

  it('never hardcodes label="Start free trial" unconditionally', () => {
    expect(SRC).not.toMatch(/label="Start free trial"/);
  });
});
