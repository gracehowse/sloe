/**
 * ENG-889 — Today log-slot CTA pixel delta (Figma 654:2).
 *
 * The empty-day "Log {slot}" affordance is a solid white card (r24, min-h 58),
 * not the legacy dashed-border button. Pins web + mobile source parity.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const WEB = readFileSync(
  resolve(ROOT, "src/app/components/suppr/today-meals-figma-layout.tsx"),
  "utf8",
);
const MOBILE = readFileSync(
  resolve(ROOT, "apps/mobile/components/today/TodayMealsFigmaLayout.tsx"),
  "utf8",
);

describe("ENG-889 — log-slot CTA solid card (654:2 pixel delta)", () => {
  it("web CTA is a solid bg-card slab — no dashed border", () => {
    expect(WEB).toMatch(/today-log-slot-cta-/);
    expect(WEB).toMatch(/bg-card/);
    expect(WEB).toMatch(/min-h-\[58px\]/);
    expect(WEB).toMatch(/rounded-\[var\(--radius-card-lg\)\]/);
    expect(WEB).toMatch(/text-\[#6a6072\]/);
    expect(WEB).not.toMatch(/border-dashed/);
  });

  it("mobile CTA matches — solid card, minHeight 58, no dashed border", () => {
    expect(MOBILE).toMatch(/today-log-slot-cta-/);
    expect(MOBILE).toMatch(/backgroundColor: colors\.card/);
    expect(MOBILE).toMatch(/minHeight: 58/);
    expect(MOBILE).not.toMatch(/borderStyle: "dashed"/);
  });
});
