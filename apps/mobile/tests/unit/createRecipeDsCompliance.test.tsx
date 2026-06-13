// @vitest-environment jsdom
/**
 * create-recipe-form premium-parity sweep (mobile lane).
 *
 * Guards the 13-gap editorial-luxury sweep on `apps/mobile/app/create-recipe.tsx`
 * + `apps/mobile/components/MealTypePicker.tsx` so a revert surfaces in CI.
 * Source-level assertions in the established `recipeEditTokenSweep` style:
 *
 *  1 (sev5 fn)   footer is a flex sibling (not absolute) + measured paddingBottom
 *  2 (sev5 type) serif Fraunces/Newsreader screen title (Type.title), not tracked Inter
 *  3 (sev4 photo) warm RecipeHeroFallback cover placeholder, not a cold grey box (flag)
 *  4 (sev4 space) inputs / textarea / publish / chips at Radius.xl (12pt), not Radius.md
 *  5 (sev3 space) on-scale padding only — no off-scale 10/12/14 literals
 *  6 (sev3 style) section eyebrows in sage (Accent.success), not tertiary grey
 *  7 (sev3 style) filled primary submit under the flag; outline only in the else
 *  9 (sev2 style) quick-action row → three GHOST SupprButton peers (button
 *                 system 2026-06-12 — none is the primary; supersedes the
 *                 earlier flag-gated clay-fill photo lift)
 * 10 (sev2 style) lucide icons throughout — zero Ionicons
 * 11 (sev2 type)  per-serving values in serif (Type.heroValue) under the flag
 * 12 (sev2 fn)    publish toggle uses brand accent, never Accent.success green
 * 13 (sev2 space) boxed −/[n]/+ servings stepper under the flag
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");
const screen = () => read("../../app/create-recipe.tsx");
const picker = () => read("../../components/MealTypePicker.tsx");

// Strip `//` comment lines so explanatory comments that reference old patterns
// (e.g. "was Ionicons", "was a filled slab") never trip a negative assertion.
const codeOnly = (src: string) =>
  src
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*"))
    .join("\n");

describe("create-recipe — gap 10: one icon family (lucide), zero Ionicons", () => {
  it("create-recipe imports lucide line icons and never Ionicons", () => {
    const src = screen();
    expect(src).toMatch(/from "lucide-react-native"/);
    expect(codeOnly(src)).not.toMatch(/@expo\/vector-icons/);
    expect(codeOnly(src)).not.toMatch(/\bIonicons\b/);
  });

  it("MealTypePicker uses lucide meal-slot icons, not Ionicons", () => {
    const src = picker();
    expect(src).toMatch(/from "lucide-react-native"/);
    expect(codeOnly(src)).not.toMatch(/@expo\/vector-icons/);
    expect(codeOnly(src)).not.toMatch(/\bIonicons\b/);
  });
});

describe("create-recipe — gap 2: serif screen title (not tracked Inter eyebrow)", () => {
  it("topTitle spreads the serif Type.title token", () => {
    const src = screen();
    expect(src).toMatch(/topTitle:\s*\{\s*\.\.\.Type\.title/);
    // the old caption treatment is gone.
    expect(codeOnly(src)).not.toMatch(/topTitle:[^}]*letterSpacing:\s*3/);
    expect(codeOnly(src)).not.toMatch(/topTitle:[^}]*fontWeight:\s*"800"/);
  });
});

describe("create-recipe — gap 6: section eyebrows in sage, +0.08em tracking", () => {
  it("label spreads Type.label and is coloured sage (Accent.success)", () => {
    const src = screen();
    expect(src).toMatch(/label:\s*\{\s*\.\.\.Type\.label,\s*color:\s*Accent\.success/);
    // the old hand-rolled tertiary-grey eyebrow is gone.
    expect(codeOnly(src)).not.toMatch(/label:[^}]*colors\.textTertiary/);
  });

  it("MealTypePicker label eyebrow is sage Type.label, not tertiary grey", () => {
    const src = picker();
    expect(src).toMatch(/\[Type\.label,\s*\{\s*color:\s*Accent\.success/);
    expect(codeOnly(src)).not.toMatch(/letterSpacing:\s*1\b/);
  });
});

describe("create-recipe — gap 4: input/card radius bumped to Radius.xl (12pt)", () => {
  it("inputs, paste textarea, publish row and chips use Radius.xl, not Radius.md", () => {
    const src = screen();
    // No card/input/control still on the boxy 6pt Radius.md.
    expect(codeOnly(src)).not.toMatch(/borderRadius:\s*Radius\.md/);
    expect(src).toMatch(/input:\s*\{[\s\S]*?borderRadius:\s*Radius\.xl/);
    expect(src).toMatch(/pasteInput:\s*\{[\s\S]*?borderRadius:\s*Radius\.xl/);
    expect(src).toMatch(/publishRow:\s*\{[\s\S]*?borderRadius:\s*Radius\.xl/);
  });

  it("MealTypePicker chips use Radius.full (chips census 2026-06-10 — supersedes the Radius.xl gap-4 bump)", () => {
    expect(picker()).toMatch(/borderRadius:\s*Radius\.full/);
    expect(picker()).not.toMatch(/borderRadius:\s*Radius\.xl/);
  });
});

describe("create-recipe — gap 5: spacing snaps to the canonical scale", () => {
  it("no off-scale padding literals (10/12/14) in the StyleSheet", () => {
    const code = codeOnly(screen());
    expect(code).not.toMatch(/padding(Vertical|Horizontal)?:\s*1[024]\b/);
    // no hardcoded gap:4 / gap:6 — use Spacing.xs.
    expect(code).not.toMatch(/gap:\s*[46]\b/);
  });

  it("MealTypePicker chip padding/gap are on-scale", () => {
    const code = codeOnly(picker());
    expect(code).not.toMatch(/padding(Vertical|Horizontal)?:\s*1[024]\b/);
    expect(code).not.toMatch(/gap:\s*4\b/);
    expect(picker()).toMatch(/paddingHorizontal:\s*Spacing\.md/);
    expect(picker()).toMatch(/paddingVertical:\s*Spacing\.sm/);
    expect(picker()).toMatch(/gap:\s*Spacing\.xs/);
  });
});

describe("create-recipe — gap 1: footer can never occlude scrollable rows", () => {
  it("footer is a flex sibling (no absolute positioning)", () => {
    const src = screen();
    expect(codeOnly(src)).not.toMatch(/footer:\s*\{[\s\S]*?position:\s*"absolute"/);
  });

  it("ScrollView reserves the measured footer height as bottom padding", () => {
    const src = screen();
    expect(src).toMatch(/onLayout=\{\(e\)\s*=>\s*setFooterHeight/);
    expect(src).toMatch(/paddingBottom:\s*\(footerHeight\s*\|\|\s*\d+\)\s*\+\s*insets\.bottom/);
  });
});

describe("create-recipe — gap 12: publish toggle uses brand accent, not green", () => {
  it("Switch track/thumb use accent.primary, never Accent.success", () => {
    const src = screen();
    expect(src).toMatch(/trackColor=\{\{\s*false:\s*colors\.border,\s*true:\s*accent\.primary/);
    expect(src).toMatch(/thumbColor=\{publish\s*\?\s*accent\.primary/);
    // success-green on the publish toggle's own props is gone (the only
    // remaining Accent.success in the file is the sage section eyebrow).
    expect(codeOnly(src)).not.toMatch(/trackColor=[^}]*Accent\.success/);
    expect(codeOnly(src)).not.toMatch(/thumbColor=[^}]*Accent\.success/);
  });
});

describe("create-recipe — flag-gated structural redesign blocks", () => {
  const src = () => screen();

  it("reads the recipes_redesign_v1 surface flag", () => {
    expect(src()).toMatch(/isFeatureEnabled\("recipes_redesign_v1"\)/);
  });

  it("gap 3: warm RecipeHeroFallback cover placeholder under the flag", () => {
    const code = src();
    expect(code).toMatch(/import \{ RecipeHeroFallback \}/);
    expect(code).toMatch(/redesignOn \? \(\s*<View style=\{styles\.coverHero\}>/);
    expect(code).toMatch(/<RecipeHeroFallback/);
  });

  it("gap 7: filled primary submit under the flag, outline only in the else", () => {
    const code = src();
    expect(code).toMatch(/redesignOn \? styles\.saveBtn : styles\.saveBtnLegacy/);
    expect(code).toMatch(/saveBtn:\s*\{[\s\S]*?backgroundColor:\s*accentInk/);
    expect(code).toMatch(/saveBtnLegacy:\s*\{[\s\S]*?backgroundColor:\s*"transparent"/);
  });

  it("gap 9: quick-action row is three GHOST SupprButton peers (button system 2026-06-12)", () => {
    const code = src();
    // The button-system canon retires the flag-gated clay-fill photo lift: all
    // three entry actions (Paste list / Scan photo / Scan barcode) are peer
    // ghost SupprButtons — none reads as the primary. The bespoke
    // quickBtnPrimary / quickBtnTextPrimary styles were removed.
    expect(code).toMatch(/import\s*\{\s*SupprButton\s*\}\s*from\s*"@\/components\/ui\/SupprButton"/);
    expect(code).toMatch(/<SupprButton\s+variant="ghost"[\s\S]{0,300}Scan photo/);
    expect(code).not.toMatch(/quickBtnPrimary:\s*\{/);
    expect(code).not.toMatch(/quickBtnTextPrimary:/);
  });

  it("gap 11: serif per-serving values under the flag", () => {
    const code = src();
    expect(code).toMatch(/totalValue:\s*\{\s*\.\.\.Type\.heroValue/);
    expect(code).toMatch(/redesignOn \? styles\.totalValue : styles\.totalValueLegacy/);
  });

  it("gap 13: boxed servings stepper under the flag", () => {
    const code = src();
    expect(code).toMatch(/redesignOn \? \(\s*<View style=\{styles\.stepper\}>/);
    expect(code).toMatch(/adjustServings\(-1\)/);
    expect(code).toMatch(/adjustServings\(1\)/);
    // clamps to a safe [1, 99] so per-serving math never divides by zero.
    expect(code).toMatch(/Math\.min\(99,\s*Math\.max\(1,/);
  });
});
