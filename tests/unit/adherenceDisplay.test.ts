/**
 * adherence_over_display (audit P1-3, product-lead 2026-06-12) — pin the
 * shared band-inverted headline formatter. Web + mobile both call
 * `formatAdherenceHeadline` so the over-target overshoot semantics + the
 * 90/110 tolerance band can't drift.
 *
 * The decision: above 110% the headline stops claiming to be "adherence"
 * and reads as the OVERSHOOT (`pct − 100`, e.g. 111% → "11% over") in the
 * amber "over" tone — a >100% figure can never read as a *better* score.
 * Under/on-target render verbatim in the sage success tone.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  formatAdherenceHeadline,
  ADHERENCE_ON_TARGET_MIN_PCT,
  ADHERENCE_ON_TARGET_MAX_PCT,
} from "../../src/lib/nutrition/adherenceDisplay";

const repoRoot = join(__dirname, "..", "..");

describe("formatAdherenceHeadline", () => {
  describe("under target (pct < 90)", () => {
    it("shows the true percentage with a success tone", () => {
      const r = formatAdherenceHeadline(82);
      expect(r).toEqual({ value: 82, suffix: "%", qualifier: null, label: "Under target", tone: "under" });
    });

    it("treats 89 as under (boundary − 1)", () => {
      expect(formatAdherenceHeadline(89)?.label).toBe("Under target");
    });
  });

  describe("on target (90 ≤ pct ≤ 110)", () => {
    it("shows the true percentage at 97", () => {
      const r = formatAdherenceHeadline(97);
      expect(r).toEqual({ value: 97, suffix: "%", qualifier: null, label: "On target", tone: "on" });
    });

    it("includes the lower boundary 90", () => {
      expect(formatAdherenceHeadline(90)?.label).toBe("On target");
    });

    it("includes exactly 100 (not over)", () => {
      const r = formatAdherenceHeadline(100);
      expect(r).toEqual({ value: 100, suffix: "%", qualifier: null, label: "On target", tone: "on" });
    });

    it("keeps 105 in the raw On-target band (no '5% over' jolt)", () => {
      const r = formatAdherenceHeadline(105);
      expect(r).toEqual({ value: 105, suffix: "%", qualifier: null, label: "On target", tone: "on" });
    });

    it("includes the upper boundary 110 (still On target, not over)", () => {
      const r = formatAdherenceHeadline(110);
      expect(r).toEqual({ value: 110, suffix: "%", qualifier: null, label: "On target", tone: "on" });
    });
  });

  describe("over target (pct > 110)", () => {
    it("flips 111 to the 11% overshoot in the warning tone", () => {
      const r = formatAdherenceHeadline(111);
      expect(r).toEqual({ value: 11, suffix: "% over", qualifier: "over", label: "Over target", tone: "over" });
    });

    it("never prints the inflated total — 160 reads as '60% over'", () => {
      const r = formatAdherenceHeadline(160);
      expect(r?.value).toBe(60);
      expect(r?.suffix).toBe("% over");
      expect(r?.label).toBe("Over target");
      expect(r?.tone).toBe("over");
    });

    it("flips at 111 (just above the 110 band), keeping 110 on-target", () => {
      // The band boundary: 110 stays On target, 111 becomes the first over.
      expect(formatAdherenceHeadline(110)?.tone).toBe("on");
      expect(formatAdherenceHeadline(111)?.tone).toBe("over");
    });

    it("magnitude is preserved — a 5%-over and a 60%-over user read differently", () => {
      // The core trust bug: capping at 100 would make both read "100% · over".
      // The overshoot frame keeps the magnitude legible (small-when-good).
      expect(formatAdherenceHeadline(115)?.value).toBe(15);
      expect(formatAdherenceHeadline(160)?.value).toBe(60);
    });
  });

  describe("null / non-finite inputs", () => {
    it("returns null for null (caller renders its own empty state)", () => {
      expect(formatAdherenceHeadline(null)).toBeNull();
    });

    it("returns null for NaN", () => {
      expect(formatAdherenceHeadline(Number.NaN)).toBeNull();
    });

    it("returns null for Infinity", () => {
      expect(formatAdherenceHeadline(Number.POSITIVE_INFINITY)).toBeNull();
    });
  });

  describe("rounding self-consistency", () => {
    it("rounds a fractional pct before banding (110.4 → 110 On target)", () => {
      expect(formatAdherenceHeadline(110.4)?.label).toBe("On target");
    });

    it("rounds 110.6 up into the over band (→ 111 → '11% over')", () => {
      const r = formatAdherenceHeadline(110.6);
      expect(r?.label).toBe("Over target");
      expect(r?.value).toBe(11);
    });
  });

  it("exports the tolerance-band constants used by both render sites", () => {
    expect(ADHERENCE_ON_TARGET_MIN_PCT).toBe(90);
    expect(ADHERENCE_ON_TARGET_MAX_PCT).toBe(110);
  });

  // Source-level consumption pin (NOT a behavioural test — labelled per the
  // decision spec). Guards that BOTH web Progress headline render sites
  // import the shared formatter and gate it behind the flag, so a refactor
  // can't reintroduce a per-site copy of the over-target logic or drop the
  // flag gate (which would change a healthy user's number on a flag flicker).
  // The single-source invariant is what keeps web↔mobile in lockstep — both
  // platforms import the SAME module. Mobile resolution is pinned by
  // `apps/mobile/tests/unit/adherenceDisplay.test.ts`.
  describe("render-site consumption pin (web)", () => {
    const sites = [
      "src/app/components/suppr/progress-hero-metric.tsx",
      "src/app/components/suppr/progress-average-adherence.tsx",
    ];

    for (const rel of sites) {
      it(`${rel} imports formatAdherenceHeadline from the shared helper`, () => {
        const src = readFileSync(join(repoRoot, rel), "utf8");
        expect(src).toMatch(
          /import\s*\{\s*formatAdherenceHeadline\s*\}\s*from\s*["'][^"']*lib\/nutrition\/adherenceDisplay["']/,
        );
      });

      it(`${rel} gates the over-target branch behind isFeatureEnabled("adherence_over_display")`, () => {
        const src = readFileSync(join(repoRoot, rel), "utf8");
        expect(src).toContain('isFeatureEnabled("adherence_over_display")');
        // ...and only flips above the 110% band (the ≤110% path is untouched).
        expect(src).toMatch(/adherencePct\s*>\s*110/);
      });
    }
  });
});
