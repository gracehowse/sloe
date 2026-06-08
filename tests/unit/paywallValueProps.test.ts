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
 * This test guards:
 *   1. The 2×2 grid carries exactly four props in frame order, each with
 *      a non-empty title + one-line description and an icon name that
 *      resolves on both lucide packages.
 *   2. The comparison matrix carries exactly four rows in frame order
 *      with the right ✓/— framing (both shared rows ✓/✓; both Pro-only
 *      rows —/✓) — the permission-not-restriction shape.
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
  it("carries exactly four rows", () => {
    expect(PAYWALL_COMPARISON_ROWS).toHaveLength(4);
  });

  it("is ordered per the frame", () => {
    expect(PAYWALL_COMPARISON_ROWS.map((r) => r.key)).toEqual([
      "log_meals_macros",
      "browse_community",
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

describe("PAYWALL_FREE_LIMITS — derived from constants, never hardcoded", () => {
  it("savedRecipes reflects FREE_SAVE_LIMIT", () => {
    expect(PAYWALL_FREE_LIMITS.savedRecipes).toBe(FREE_SAVE_LIMIT);
  });

  it("weeklyPhotoLogs reflects FREE_PHOTO_LOG_WEEKLY_LIMIT", () => {
    expect(PAYWALL_FREE_LIMITS.weeklyPhotoLogs).toBe(FREE_PHOTO_LOG_WEEKLY_LIMIT);
  });
});
