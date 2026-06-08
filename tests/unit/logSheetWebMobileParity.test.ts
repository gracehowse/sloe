/**
 * Source-grep parity tests pinning the web ↔ mobile parity contract for:
 *   1. `LogSheet` — Recent / Library / Saved 3-tab structure, search row,
 *      right-edge icons (scan / voice / photo).
 *   2. `today-meals-section` (web) — empty-state collage REMOVED in
 *      favour of the canonical LogSheet entry. Mobile already has no
 *      collage; this test pins web from regressing back.
 *   3. `FullNutrientPanelSheet` — both platforms route through the
 *      shared `buildFullNutrientPanelRows` helper and render the
 *      Macros / Vitamins / Minerals section taxonomy with the
 *      `DAILY_VALUES_SOURCE_LABEL` footer.
 *
 * Source-grep rather than runtime so a regression on either platform
 * fails the suite immediately, without needing to render both sides.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");
function read(p: string): string {
  return readFileSync(path.join(REPO_ROOT, p), "utf8");
}

const WEB_LOG_SHEET = "src/app/components/suppr/log-sheet.tsx";
const MOBILE_LOG_SHEET = "apps/mobile/components/today/LogSheet.tsx";
const WEB_TODAY_MEALS_SECTION =
  "src/app/components/suppr/today-meals-section.tsx";
const MOBILE_TODAY_MEALS_SECTION =
  "apps/mobile/components/today/TodayMealsSection.tsx";
const WEB_FULL_PANEL =
  "src/app/components/suppr/full-nutrient-panel-sheet.tsx";
const MOBILE_FULL_PANEL =
  "apps/mobile/components/today/FullNutrientPanelSheet.tsx";

describe("LogSheet — web ↔ mobile structural parity", () => {
  const web = read(WEB_LOG_SHEET);
  const mobile = read(MOBILE_LOG_SHEET);

  it("both surfaces declare the same `BrowseTab` union (recent / library / saved)", () => {
    const browseTabRe =
      /type BrowseTab = "recent" \| "library" \| "saved"/;
    expect(web).toMatch(browseTabRe);
    expect(mobile).toMatch(browseTabRe);
  });

  it("both surfaces emit the same testIDs for each browse tab", () => {
    for (const id of [
      "log-sheet-tab-recent",
      "log-sheet-tab-library",
      "log-sheet-tab-saved",
    ]) {
      expect(web).toContain(id);
      expect(mobile).toContain(id);
    }
  });

  it("both surfaces render the saved-tab dot indicator with testID `log-sheet-tab-saved-dot`", () => {
    expect(web).toContain("log-sheet-tab-saved-dot");
    expect(mobile).toContain("log-sheet-tab-saved-dot");
  });

  it("both surfaces gate the saved-dot on `savedCount >= 3`", () => {
    expect(web).toMatch(/savedCount\s*>=\s*3/);
    expect(mobile).toMatch(/savedCount\s*>=\s*3/);
  });

  it("both surfaces render right-edge icons in Scan / Voice / Photo order", () => {
    // RightEdgeIcons defines the icon list with `key: "scan"`, `"voice"`, `"photo"`.
    // The order in the array dictates render order.
    function iconOrder(src: string): string[] {
      const m = src.match(
        /key:\s*"scan"[\s\S]*?key:\s*"voice"[\s\S]*?key:\s*"photo"/,
      );
      return m ? ["scan", "voice", "photo"] : [];
    }
    expect(iconOrder(web)).toEqual(["scan", "voice", "photo"]);
    expect(iconOrder(mobile)).toEqual(["scan", "voice", "photo"]);
  });

  it("both surfaces label the scan / voice / photo icons identically", () => {
    for (const label of ["Scan barcode", "Voice log", "Photo log"]) {
      expect(web).toContain(label);
      expect(mobile).toContain(label);
    }
  });

  it("both surfaces share the inline-search test handles", () => {
    for (const id of ["log-sheet-search-row", "log-sheet-search-input"]) {
      expect(web).toContain(id);
      expect(mobile).toContain(id);
    }
  });

  it("both surfaces ship the `Or add manually` footer string", () => {
    expect(web).toContain("Or add manually");
    expect(mobile).toContain("Or add manually");
  });
});

describe("LogSheet slot selector — web ↔ mobile parity (ENG-773)", () => {
  const web = read(WEB_LOG_SHEET);
  const mobile = read(MOBILE_LOG_SHEET);

  it("both surfaces declare an optional `slot` prop of the same shape", () => {
    // slot?: { current: string; options: readonly string[]; onChange }
    for (const src of [web, mobile]) {
      expect(src).toMatch(/slot\?:\s*\{/);
      expect(src).toMatch(/options:\s*readonly string\[\]/);
      expect(src).toMatch(/onChange:\s*\(slot:\s*string\)\s*=>\s*void/);
    }
  });

  it("both surfaces emit per-slot testIDs via the `log-sheet-slot-` prefix", () => {
    // Rendered dynamically as `log-sheet-slot-${s.toLowerCase()}` so the
    // 4 resolved IDs (breakfast/lunch/dinner/snacks) exist at runtime;
    // the source carries the template form on both platforms.
    expect(web).toMatch(/log-sheet-slot-\$\{/);
    expect(mobile).toMatch(/log-sheet-slot-\$\{/);
  });

  it("both surfaces wrap the selector in a labelled radiogroup of radios", () => {
    // Web uses ARIA; mobile uses RN accessibilityRole — both declare the
    // radiogroup container + radio options so AT announces the choice.
    expect(web).toMatch(/role="radiogroup"/);
    expect(web).toMatch(/role="radio"/);
    expect(mobile).toMatch(/accessibilityRole="radiogroup"/);
    expect(mobile).toMatch(/accessibilityRole="radio"/);
  });

  it("both surfaces tag the selector row with the `log-sheet-slot-row` handle", () => {
    expect(web).toContain("log-sheet-slot-row");
    expect(mobile).toContain("log-sheet-slot-row");
  });
});

describe("LogSheet S13 logged-confirmation — web ↔ mobile parity (Figma 202:2)", () => {
  const web = read(WEB_LOG_SHEET);
  const mobile = read(MOBILE_LOG_SHEET);

  it("both surfaces declare an optional `confirmation` prop of the same shape", () => {
    for (const src of [web, mobile]) {
      // confirmation?: { title; kcal; slot?; source?; onDone; onUndo? } | null
      expect(src).toMatch(/confirmation\?:\s*\{/);
      expect(src).toMatch(/onDone:\s*\(\)\s*=>\s*void/);
      expect(src).toMatch(/onUndo\?:\s*\(\)\s*=>\s*void/);
    }
  });

  it("both surfaces tag the confirmation surface with the `log-sheet-confirmation` handle", () => {
    expect(web).toContain("log-sheet-confirmation");
    expect(mobile).toContain("log-sheet-confirmation");
  });

  it("both surfaces render the confirmation via a dedicated LoggedConfirmation component", () => {
    for (const src of [web, mobile]) {
      expect(src).toContain("function LoggedConfirmation");
      expect(src).toContain("<LoggedConfirmation confirmation={confirmation!} />");
    }
  });

  it("both surfaces keep nutrition copy as an estimate (`Est.` prefix), never absolute", () => {
    for (const src of [web, mobile]) {
      expect(src).toMatch(/Est\.\s*\{kcal\}\s*kcal/);
    }
  });

  it("both surfaces ship the Done + Undo confirmation actions", () => {
    // Done + Undo labels present on both (web `aria-label` / mobile
    // `accessibilityLabel`).
    expect(web).toContain('aria-label="Done"');
    expect(mobile).toContain('accessibilityLabel="Done"');
    expect(web).toContain('aria-label="Undo log"');
    expect(mobile).toContain('accessibilityLabel="Undo log"');
  });
});

describe("today-meals-section — empty-state collage REMOVED on web (mobile parity)", () => {
  const web = read(WEB_TODAY_MEALS_SECTION);
  const mobile = read(MOBILE_TODAY_MEALS_SECTION);

  it("web no longer renders the duplicated 'Log from today's plan' rows block", () => {
    // The standalone `<TodayPlannedMealsCard>` is the canonical surface
    // for plan rows on both platforms; the meals card no longer
    // duplicates them. Check the JSX text node form (`>Log from today's plan<`)
    // rather than substring match — the docstring at the top of the
    // file references the removed block by name as part of the
    // explanatory comment.
    expect(web).not.toMatch(/>\s*Log from today/);
    // Also: the `onLogPlanMeal` callback that the removed block used
    // is no longer wired through the props.
    expect(web).not.toMatch(/onLogPlanMeal/);
  });

  it("web no longer renders parallel Photo / Voice / Add-custom CTAs in the meals card", () => {
    // The unified `<LogSheet>` is the canonical entry for these modes.
    // (Note: the LogSheet itself still ships these labels via
    // its right-edge icons; we're pinning them out of the meals
    // section ONLY.)
    expect(web).not.toMatch(/onOpenAddCustom/);
    expect(web).not.toMatch(/onOpenPhotoLog/);
    expect(web).not.toMatch(/onOpenVoiceLog/);
  });

  it("web exposes a single `onOpenLogSheet` prop matching mobile's raised-button entry", () => {
    expect(web).toContain("onOpenLogSheet");
  });

  it("mobile has no in-card empty-state collage — sanity check", () => {
    // Mobile's TodayMealsSection never carried the collage; pin it.
    expect(mobile).not.toMatch(/onOpenAddCustom/);
    expect(mobile).not.toMatch(/onOpenPhotoLog/);
    expect(mobile).not.toMatch(/onOpenVoiceLog/);
  });
});

describe("FullNutrientPanelSheet — web ↔ mobile parity", () => {
  const web = read(WEB_FULL_PANEL);
  const mobile = read(MOBILE_FULL_PANEL);

  it("both platforms import the shared row builder + count constant", () => {
    for (const src of [web, mobile]) {
      expect(src).toContain("buildFullNutrientPanelRows");
      expect(src).toContain("FULL_NUTRIENT_PANEL_ROW_COUNT");
    }
  });

  it("both platforms render the FDA source-attribution footer via DAILY_VALUES_SOURCE_LABEL", () => {
    for (const src of [web, mobile]) {
      expect(src).toContain("DAILY_VALUES_SOURCE_LABEL");
      expect(src).toContain("full-panel-source-label");
    }
  });

  it("both platforms render the same per-section testID prefix", () => {
    for (const src of [web, mobile]) {
      expect(src).toContain("full-panel-section-${section}");
    }
  });

  it("both platforms render the same per-row testID prefix", () => {
    for (const src of [web, mobile]) {
      expect(src).toContain("full-panel-row-${row.key}");
    }
  });

  it("both platforms apply the limit-tier color ramp (sodium / sat fat / cholesterol)", () => {
    for (const src of [web, mobile]) {
      // The shared `rowColor`/`rowColorVar` helper checks `row.percentDv >= 100` first.
      expect(src).toMatch(/row\.percentDv\s*>=\s*100/);
      expect(src).toMatch(/row\.percentDv\s*>=\s*80/);
    }
  });
});
