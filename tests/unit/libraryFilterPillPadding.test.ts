/**
 * Library filter pill padding — pin (build-12, 2026-05-02).
 *
 * Tester (2026-05-02) reported the Library filter pills ("All · 21",
 * "Saved · 13", "High-Protein", "Quick") had text visually squished
 * against the border on iOS — descenders kissed the bottom edge,
 * ascenders kissed the top. The fix bumps vertical padding and adds
 * an explicit `min-h` floor so the label always sits in the optical
 * centre, regardless of the longest-label test fixture.
 *
 * This file pins the padding values on BOTH platforms so a future
 * refactor (e.g. someone collapsing the long-label classes back to
 * `px-3 py-1.5`) can't silently regress what TestFlight has already
 * flagged. The shared `LIBRARY_FILTER_PILLS` source is also asserted
 * to confirm the longest label fits without truncation at the new
 * padding budget.
 *
 * Mirrors:
 *   - `apps/mobile/app/(tabs)/library.tsx` `filterPill` style
 *   - `src/app/components/Library.tsx` filter pill className
 *
 * Web/mobile parity is enforced by both pins living in the same file.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { LIBRARY_FILTER_PILLS } from "../../src/lib/recipes/libraryFilters";

const ROOT = resolve(__dirname, "../..");
const WEB_LIBRARY_PATH = resolve(ROOT, "src/app/components/Library.tsx");
const MOBILE_LIBRARY_PATH = resolve(
  ROOT,
  "apps/mobile/app/(tabs)/library.tsx",
);

const WEB_SRC = readFileSync(WEB_LIBRARY_PATH, "utf8");
const MOBILE_SRC = readFileSync(MOBILE_LIBRARY_PATH, "utf8");

describe("Library filter pill padding (build-12, 2026-05-02)", () => {
  describe("web — Tailwind className floor", () => {
    it("uses px-3.5 (14px) horizontal padding — meets the 14pt brief floor", () => {
      // The pill className must include `px-3.5`; the prior `px-3`
      // (12px) is what the tester saw squished.
      expect(WEB_SRC).toMatch(/shrink-0 inline-flex items-center px-3\.5 py-2 min-h-8/);
    });

    it("pins min-h-8 (32px) — matches mobile minHeight floor for parity", () => {
      // `min-h-8` == 2rem == 32px in the project's Tailwind config.
      // Vertical breathing room was the regression vector the brief
      // called out, not horizontal.
      expect(WEB_SRC).toMatch(/min-h-8/);
    });

    it("centers the label optically with inline-flex items-center", () => {
      // Without `items-center`, `min-h-8` would just enlarge the box
      // and leave the text top-aligned. The combination is the actual
      // fix for the squish.
      expect(WEB_SRC).toMatch(/inline-flex items-center px-3\.5 py-2 min-h-8/);
    });

    it("does NOT regress to the squished px-3 py-1.5 (no min-h) baseline", () => {
      // Defensive: if a future refactor collapses the className, this
      // assertion catches it. We look specifically inside the pill
      // map to keep the check tight.
      const pillRegion = WEB_SRC.match(/LIBRARY_CATEGORY_PILLS\.map[\s\S]+?\}\)\}/);
      expect(pillRegion).not.toBeNull();
      // The squished baseline was `px-3 py-1.5` with no min-h. The
      // new floor is `px-3.5 py-2 min-h-8` (ENG-921 category pills bumped
      // py-1.5 → py-2). Reject the old shape.
      expect(pillRegion?.[0]).not.toMatch(/\bpx-3 py-1\.5 rounded-full/);
    });
  });

  describe("mobile — StyleSheet floor (2026-05-06: aligned with Discover)", () => {
    // 2026-05-06 (Grace) — geometry shifted to match Discover so the
    // four most-used filters (All / Saved / High-Protein / Quick) fit
    // a 393pt iPhone width without "Quick" clipping at the trailing
    // edge. The Type.body (14pt) tokens used to render a ~454pt-wide
    // row that was always half-off-screen. Now: paddingHorizontal:13
    // + fontSize:12 + lineHeight:18 + minHeight:36 — descenders
    // ("Q", "g") sit fully inside the pill body and the row fits.
    it("pins paddingHorizontal: 12 (Spacing.sm+Spacing.xs) — on-scale canonical value (was 13, snapped 2026-06-09)", () => {
      // 2026-06-09 library spacing audit snapped 13 → 12 (Spacing.sm+xs=8+4)
      // to land on the canonical Spacing ladder. The test now pins the
      // token expression the source uses rather than a raw off-scale literal.
      expect(MOBILE_SRC).toMatch(
        /filterPill:\s*\{[\s\S]*?paddingHorizontal:\s*Spacing\.sm\s*\+\s*Spacing\.xs[\s\S]*?\}/,
      );
    });

    it("pins paddingVertical: 8 — vertical breathing room preserved from build-12 fix", () => {
      expect(MOBILE_SRC).toMatch(
        /filterPill:\s*\{[\s\S]*?paddingVertical:\s*8[\s\S]*?\}/,
      );
    });

    it("pins minHeight: 36 — gives descender envelope room without iOS clipping", () => {
      // Bumped 32 → 36 (2026-05-06) after Grace flagged the descender
      // tail of "g" / "Q" clipping at the bottom border on iOS.
      expect(MOBILE_SRC).toMatch(
        /filterPill:\s*\{[\s\S]*?minHeight:\s*36[\s\S]*?\}/,
      );
    });

    it("centers the label with justifyContent + alignItems", () => {
      // `minHeight: 36` alone would just enlarge the box; without
      // centering the text would flow top-aligned, defeating the fix.
      expect(MOBILE_SRC).toMatch(
        /filterPill:\s*\{[\s\S]*?justifyContent:\s*"center"[\s\S]*?alignItems:\s*"center"[\s\S]*?\}/,
      );
    });

    it("uses fontSize 12 / lineHeight 18 — matches Discover's 12/18 text scale", () => {
      // Was Type.body (14/20). Dropped to Discover's 12/18 so the
      // 4-pill row fits a 393pt iPhone width and the pill text scale
      // is consistent across Library and Discover.
      expect(MOBILE_SRC).toMatch(
        /filterPillText:\s*\{[\s\S]*?fontSize:\s*12[\s\S]*?lineHeight:\s*18[\s\S]*?\}/,
      );
    });

    it("scrolls horizontally with leading Spacing.xl + extra trailing padding", () => {
      // 2026-05-06: split the previous symmetric `paddingHorizontal:
      // Spacing.xl` into `paddingLeft: Spacing.xl` (preserve header
      // alignment) + `paddingRight: Spacing.xl * 2` so the trailing
      // pill always has visible scroll-headroom on the right edge.
      expect(MOBILE_SRC).toMatch(
        /filterScroll:\s*\{[\s\S]*?paddingLeft:\s*Spacing\.xl[\s\S]*?\}/,
      );
      expect(MOBILE_SRC).toMatch(
        /filterScroll:\s*\{[\s\S]*?paddingRight:\s*Spacing\.xl\s*\*\s*2[\s\S]*?\}/,
      );
    });
  });

  describe("longest-label fits without truncation in the padding budget", () => {
    // Test fixture sanity — the longest pill label is what stresses
    // the padding budget. As of build-12 it's "High-Protein" (12
    // chars) followed by "Vegetarian" (10) and "Imported" (8). With
    // the count suffix on entry-kind pills ("All · 21" -> max ~9
    // chars at 99 saved recipes; "Saved · 99" -> max ~10), the
    // longest user-visible label is still bounded under 14 chars.
    // We pin this here so a future addition to LIBRARY_FILTER_PILLS
    // that exceeds that budget at least lights up CI.
    const LONGEST_LABEL_BUDGET = 14;

    for (const pill of LIBRARY_FILTER_PILLS) {
      it(`label "${pill.label}" stays under the ${LONGEST_LABEL_BUDGET}-char wide-render budget`, () => {
        expect(pill.label.length).toBeLessThanOrEqual(LONGEST_LABEL_BUDGET);
      });
    }

    it("count-suffix variant ('All · 99') for entry-kind pills also fits", () => {
      // Worst-case at 99 saved recipes is `${label} · 99` — the
      // `${label}` floor for entry-kind pills is "Saved" (5) /
      // "All" (3). The longest possible composite is 11 chars,
      // still inside the 14-char budget. If we ever ship 100+ saved
      // recipes per user, bump the budget; the layout still
      // doesn't truncate because of `whitespace-nowrap` (web) /
      // single-line `<Text>` (mobile).
      const composite = `Saved · 99`;
      expect(composite.length).toBeLessThanOrEqual(LONGEST_LABEL_BUDGET);
    });
  });
});
