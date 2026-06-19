/**
 * Paywall value-prop grid + Free-vs-Pro comparison SSOT parity
 * (Figma `284:2`).
 *
 * These two presentational blocks (the 2×2 value grid + the FREE/PRO
 * comparison matrix) are rendered on BOTH the web `/pricing` surface
 * (`app/pricing/PaywallValueGrid.tsx`, `PaywallComparison.tsx`) and the
 * mobile paywall (`apps/mobile/components/paywall/*`). They read from
 * one leaf SSOT (`src/lib/landing/paywallValueProps.ts`) so the two
 * platforms can't drift.
 *
 * Anti-drift scope: render/click behaviour for paywall CTAs lives in
 * aiPaywallDialog.test.tsx and upgradePaywallDialog.test.tsx; this file only
 * pins shared value-prop/comparison SSOT shape.
 *
 * This test guards:
 *   1. The 2×2 grid carries exactly four props in frame order, each with
 *      a non-empty title + one-line description and an icon name that
 *      resolves on both lucide packages.
 *   2. The comparison matrix carries the rows in frame order with the
 *      right ✓/— framing (shared rows ✓/✓; Pro-only rows —/✓) — the
 *      permission-not-restriction shape. ENG-1203 added two ✓/✓
 *      MFP-switch-win rows (barcode + custom macros), flag-gated via
 *      `getPaywallComparisonRows`.
 *   3. The Free-tier limits the matrix abstracts are DERIVED from the
 *      shared `FREE_SAVE_LIMIT` / `FREE_PHOTO_LOG_WEEKLY_LIMIT`
 *      constants — never hardcoded — so a future limit change can't make
 *      the paywall lie.
 */
import { describe, expect, it } from "vitest";
import {
  PAYWALL_VALUE_PROPS,
  PAYWALL_COMPARISON_ROWS,
  PAYWALL_FREE_LIMITS,
  PAYWALL_FREE_MFP_WINS_FLAG,
  getPaywallComparisonRows,
} from "../../src/lib/landing/paywallValueProps";
import { FREE_SAVE_LIMIT } from "../../src/context/appData/constants";
import { FREE_PHOTO_LOG_WEEKLY_LIMIT } from "../../src/lib/nutrition/photoLogQuota";

describe("PAYWALL_VALUE_PROPS — 2×2 grid SSOT (Figma 284:2)", () => {
  it("carries exactly four value props", () => {
    expect(PAYWALL_VALUE_PROPS).toHaveLength(4);
  });

  it("is ordered: imports, macro fitting, AI coach, cloud sync", () => {
    expect(PAYWALL_VALUE_PROPS.map((p) => p.key)).toEqual([
      "unlimited_imports",
      "macro_fitting",
      "ai_coach",
      "cloud_sync",
    ]);
  });

  it("matches the frame copy exactly", () => {
    const byKey = Object.fromEntries(PAYWALL_VALUE_PROPS.map((p) => [p.key, p]));
    expect(byKey.unlimited_imports.title).toBe("Unlimited imports");
    expect(byKey.unlimited_imports.description).toBe(
      "Save any recipe from a link or Reel.",
    );
    expect(byKey.macro_fitting.title).toBe("Macro fitting");
    expect(byKey.macro_fitting.description).toBe(
      "Auto-fit any recipe to your day.",
    );
    expect(byKey.ai_coach.title).toBe("AI coach");
    expect(byKey.ai_coach.description).toBe("Personalised, guilt-free nudges.");
    expect(byKey.cloud_sync.title).toBe("Cloud sync");
    expect(byKey.cloud_sync.description).toBe(
      "Your journal, safe on every device.",
    );
  });

  it("each prop has a non-empty title + one-line description + icon", () => {
    for (const p of PAYWALL_VALUE_PROPS) {
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
      // One line — no embedded newline.
      expect(p.description).not.toContain("\n");
      expect(p.icon.length).toBeGreaterThan(0);
    }
  });

  it("uses lucide glyph names that resolve on both platforms", () => {
    // The four chosen glyphs exist on both `lucide-react` and
    // `lucide-react-native`. Guard the names so a future swap to a
    // web-only glyph can't break the mobile import.
    const allowed = new Set(["Link2", "SlidersHorizontal", "Sparkles", "Cloud"]);
    for (const p of PAYWALL_VALUE_PROPS) {
      expect(allowed.has(p.icon)).toBe(true);
    }
  });
});

describe("PAYWALL_COMPARISON_ROWS — FREE/PRO matrix SSOT (Figma 284:2)", () => {
  it("carries exactly six rows (4 legacy + 2 ENG-1203 MFP-switch wins)", () => {
    expect(PAYWALL_COMPARISON_ROWS).toHaveLength(6);
  });

  it("is ordered per the frame (MFP wins sit in the ✓/✓ Free-useful block)", () => {
    expect(PAYWALL_COMPARISON_ROWS.map((r) => r.key)).toEqual([
      "log_meals_macros",
      "browse_community",
      "free_barcode_scanning",
      "free_custom_macros",
      "unlimited_imports",
      "ai_macro_fitting",
    ]);
  });

  it("shared rows are ✓/✓ (Free is genuinely useful)", () => {
    const byKey = Object.fromEntries(
      PAYWALL_COMPARISON_ROWS.map((r) => [r.key, r]),
    );
    expect(byKey.log_meals_macros.free).toBe(true);
    expect(byKey.log_meals_macros.pro).toBe(true);
    expect(byKey.browse_community.free).toBe(true);
    expect(byKey.browse_community.pro).toBe(true);
  });

  it("Pro-only rows are —/✓ (Pro expands Free, not Free crippled)", () => {
    const byKey = Object.fromEntries(
      PAYWALL_COMPARISON_ROWS.map((r) => [r.key, r]),
    );
    expect(byKey.unlimited_imports.free).toBe(false);
    expect(byKey.unlimited_imports.pro).toBe(true);
    expect(byKey.ai_macro_fitting.free).toBe(false);
    expect(byKey.ai_macro_fitting.pro).toBe(true);
  });

  it("every row has a non-empty label", () => {
    for (const r of PAYWALL_COMPARISON_ROWS) {
      expect(r.label.length).toBeGreaterThan(0);
    }
  });
});

describe("ENG-1203 — free MFP-switch wins (barcode + custom macros)", () => {
  const byKey = Object.fromEntries(
    PAYWALL_COMPARISON_ROWS.map((r) => [r.key, r]),
  );

  it("calls out free barcode scanning as a ✓/✓ row flagged mfpSwitchWin", () => {
    const row = byKey.free_barcode_scanning;
    expect(row).toBeDefined();
    expect(row.label).toBe("Barcode scanning");
    // Genuinely free → ✓ in BOTH columns (Pro keeps it too).
    expect(row.free).toBe(true);
    expect(row.pro).toBe(true);
    expect(row.mfpSwitchWin).toBe(true);
  });

  it("calls out free custom macros as a ✓/✓ row flagged mfpSwitchWin", () => {
    const row = byKey.free_custom_macros;
    expect(row).toBeDefined();
    expect(row.label).toBe("Custom macro goals");
    expect(row.free).toBe(true);
    expect(row.pro).toBe(true);
    expect(row.mfpSwitchWin).toBe(true);
  });

  it("never claims a switch win as Free-only (✓ in both columns — honest)", () => {
    // The merchandising must not imply the feature is *withheld* from
    // Pro. Both MFP-win rows are ✓/✓ — they're free, and Pro keeps them.
    for (const r of PAYWALL_COMPARISON_ROWS) {
      if (r.mfpSwitchWin) {
        expect(r.free).toBe(true);
        expect(r.pro).toBe(true);
      }
    }
  });

  it("exposes the default-on flag string the renderers gate on", () => {
    expect(PAYWALL_FREE_MFP_WINS_FLAG).toBe("paywall_free_mfp_wins_v1");
  });
});

describe("getPaywallComparisonRows — flag-gated row selection (ENG-1203)", () => {
  it("flag ON → all six rows including the two MFP-switch wins", () => {
    const rows = getPaywallComparisonRows(true);
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.key)).toContain("free_barcode_scanning");
    expect(rows.map((r) => r.key)).toContain("free_custom_macros");
  });

  it("flag OFF → the legacy four rows, MFP wins suppressed (kill switch)", () => {
    const rows = getPaywallComparisonRows(false);
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.key)).toEqual([
      "log_meals_macros",
      "browse_community",
      "unlimited_imports",
      "ai_macro_fitting",
    ]);
    expect(rows.some((r) => r.mfpSwitchWin)).toBe(false);
  });
});

describe("PAYWALL_FREE_LIMITS — derived from constants, never hardcoded", () => {
  it("savedRecipes reflects FREE_SAVE_LIMIT", () => {
    expect(PAYWALL_FREE_LIMITS.savedRecipes).toBe(FREE_SAVE_LIMIT);
  });

  it("weeklyPhotoLogs reflects FREE_PHOTO_LOG_WEEKLY_LIMIT", () => {
    expect(PAYWALL_FREE_LIMITS.weeklyPhotoLogs).toBe(FREE_PHOTO_LOG_WEEKLY_LIMIT);
  });
});
