/**
 * DS compliance tests for cookbook-import surface (premium-parity pass,
 * 2026-06-09). These tests read source files and assert the presence of
 * the correct design-system token names so that regressions to pre-DS
 * patterns (raw fontWeight strings, off-scale radii, Alert for non-destructive
 * feedback) are caught by CI.
 *
 * Tests are intentionally source-read (not render) because the constraints
 * being enforced are at the StyleSheet / prop level, not the rendered-output
 * level, and because lucide-react-native + Expo font loading are not set up
 * in the vitest environment.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSrc = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");

const screen = readSrc("../../app/cookbook-import.tsx");
const reviewRow = readSrc("../../components/cookbook/CookbookReviewRow.tsx");
const parsingView = readSrc("../../components/cookbook/CookbookParsingView.tsx");
const successView = readSrc("../../components/cookbook/CookbookSuccessView.tsx");

describe("cookbook-import — DS §2.3 typography compliance", () => {
  it("cardTitle uses Type.headline (serifMedium), not raw fontWeight", () => {
    // Type.headline = Newsreader_500Medium / serifMedium — the correct serif
    // role for recipe names per DS §2.3 rule 2.
    expect(screen).toMatch(/cardTitle.*Type\.headline/s);
    // Must NOT use a bare fontWeight:'700' for the card title any more.
    expect(screen).not.toMatch(/cardTitle.*fontWeight.*['"]700['"]/);
  });

  it("CookbookReviewRow: recipe title uses Type.headline (serifMedium)", () => {
    expect(reviewRow).toMatch(/Type\.headline/);
  });

  it("CookbookReviewRow: kcal value uses FontFamily.serifMedium", () => {
    // DS §2.3 rule 3: numeric editorial data → serif.
    expect(reviewRow).toMatch(/FontFamily\.serifMedium/);
  });

  it("screen does not use raw fontWeight: '700' outside comments", () => {
    // Strip comments, then check for raw fontWeight strings.
    const noComments = screen.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(noComments).not.toMatch(/fontWeight:\s*['"]700['"]/);
  });

  it("primaryBtnText uses FontFamily.sansSemibold (Inter 600)", () => {
    // DS §2.2 cta-primary: Inter 600 / 15pt — not fontWeight:'700'.
    expect(screen).toMatch(/primaryBtnText[\s\S]*?FontFamily\.sansSemibold/);
  });

  it("segBtnText uses FontFamily.sansSemibold", () => {
    expect(screen).toMatch(/segBtnText[\s\S]*?FontFamily\.sansSemibold/);
  });

  it("CookbookSuccessView uses Type.title for the 'Saved.' H1", () => {
    // DS §2.2 display-title: Fraunces/Newsreader for screen H1.
    expect(successView).toMatch(/Type\.title/);
    expect(successView).toMatch(/Saved\./);
  });

  it("CookbookParsingView uses Type.title for the step label", () => {
    expect(parsingView).toMatch(/Type\.title/);
  });
});

describe("cookbook-import — DS §4 radius compliance", () => {
  it("uses Radius.xl (12) for inputs and primary buttons, not hardcoded 16", () => {
    expect(screen).toMatch(/borderRadius:\s*Radius\.xl/);
    // Must NOT use bare borderRadius:16 any more.
    const noComments = screen.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(noComments).not.toMatch(/borderRadius:\s*16\b/);
  });

  it("uses Radius.lg (8) for cards, not Radius.xl*2 (24)", () => {
    expect(screen).toMatch(/borderRadius:\s*Radius\.lg/);
    // Explicit ban on the old Radius.xl * 2 arithmetic.
    expect(screen).not.toMatch(/Radius\.xl\s*\*\s*2/);
  });

  it("segment buttons use Radius.lg (8), not hardcoded 14", () => {
    const noComments = screen.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(noComments).not.toMatch(/borderRadius:\s*14\b/);
    expect(screen).toMatch(/segBtn[\s\S]*?Radius\.lg/);
  });

  it("CookbookReviewRow uses Radius.lg for card and Radius.md for checkbox", () => {
    expect(reviewRow).toMatch(/Radius\.lg/);
    expect(reviewRow).toMatch(/Radius\.md/);
  });
});

describe("cookbook-import — DS §3 spacing compliance", () => {
  it("uses Spacing.md (16) for card padding, not bare 14", () => {
    // DS §3.2: standard card internal padding = 16pt.
    const noComments = screen.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    // padding:14 was the pre-fix value for textInput.
    expect(noComments).not.toMatch(/padding:\s*14\b/);
    expect(screen).toMatch(/padding:\s*Spacing\.md/);
  });

  it("uses Spacing.xs (4) for marginBottom/marginTop labels, not bare 6", () => {
    const noComments = screen.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(noComments).not.toMatch(/marginBottom:\s*6\b/);
    expect(noComments).not.toMatch(/marginTop:\s*6\b/);
  });

  it("card gap uses Spacing.md (16), not Spacing.sm (8)", () => {
    // import.md §3.5: 16pt between review rows for clarity.
    expect(screen).toMatch(/marginBottom:\s*Spacing\.md/);
  });
});

describe("cookbook-import — DS §10.8 alert discipline", () => {
  it("success state uses setStep('success'), not Alert", () => {
    // Under redesignOn, success must navigate to the success step, not Alert.
    expect(screen).toMatch(/setStep\("success"\)/);
  });

  it("pro_required uses inline banner (redesignOn path), not Alert only", () => {
    // DS §10.8: paywall banner is an inline banner, not a system dialog.
    expect(screen).toMatch(/setBanner[\s\S]*?upgradeAction[\s\S]*?paywall/);
  });

  it("save_limit uses inline banner (redesignOn path), not Alert only", () => {
    // Inline banner with upgrade action for free-tier save limit.
    expect(screen).toMatch(/setBanner[\s\S]*?COOKBOOK_IMPORT_FREE_SAVE_CAP/s);
  });

  it("file-too-large uses inline banner (redesignOn path), not Alert only", () => {
    expect(screen).toMatch(/setBanner[\s\S]*?limit is 4 MB/s);
  });

  it("Alert is still used in the legacy (redesignOn = false) path", () => {
    // Alert must remain for the flag-off path to avoid breaking existing UX.
    expect(screen).toMatch(/Alert\.alert/);
  });
});

describe("cookbook-import — DS §11.4 imagery compliance", () => {
  it("CookbookReviewRow includes UtensilsCrossed warm fallback thumbnail", () => {
    // DS §11.4: warm fallback must use UtensilsCrossed (or pan icon) on the
    // card background — never a cold placeholder.
    expect(reviewRow).toMatch(/UtensilsCrossed/);
  });

  it("CookbookParsingView uses ChefHat line-art glyph instead of ActivityIndicator", () => {
    // DS §3.3: line-art glyph replaces the spinner in the parsing state.
    expect(parsingView).toMatch(/ChefHat/);
    expect(parsingView).not.toMatch(/ActivityIndicator/);
  });
});

describe("cookbook-import — DS §6.2 selected-card pattern", () => {
  it("CookbookReviewRow uses 2pt terracotta border for included state, not opacity only", () => {
    // DS §6.2: selected state = 2pt terracotta border. The old treatment was
    // opacity:0.45 + strikethrough only — a flat, cheap exclude signal.
    expect(reviewRow).toMatch(/borderWidth:\s*2/);
    expect(reviewRow).toMatch(/accent\.primary/);
  });

  it("CookbookReviewRow has a CheckCircle checkbox affordance", () => {
    // DS §10.1: trailing checkbox control to signal include/exclude.
    expect(reviewRow).toMatch(/CheckCircle/);
  });
});

describe("cookbook-import — redesign flag gates structural changes", () => {
  it("recipe-import-redesign flag gates the success step and FlatList review", () => {
    expect(screen).toMatch(/isFeatureEnabled\("recipe-import-redesign"\)/);
    expect(screen).toMatch(/redesignOn/);
  });

  it("step === 'success' is only reachable when redesignOn", () => {
    // Success step must be gated: setStep('success') only called inside
    // the redesignOn branch of finishSave.
    expect(screen).toMatch(/redesignOn[\s\S]*?setStep\("success"\)/s);
  });
});

describe("cookbook-import — ENG-742 launch gate (regression)", () => {
  it("cookbook_import_enabled flag gates the screen", () => {
    expect(screen).toMatch(/isFeatureEnabled\("cookbook_import_enabled"\)/);
    expect(screen).toMatch(/router\.back\(\)/);
  });
});
