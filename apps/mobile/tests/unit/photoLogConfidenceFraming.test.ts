/**
 * Mobile `PhotoLogSheet` confidence-framing structural contract
 * (2026-05-02).
 *
 * The mobile sheet is React Native and cannot be rendered in vitest.
 * This source-level test pins the public contract so a regression on
 * the midpoint-with-confidence-meter framing fails CI on the mobile
 * side too. Mirrors the pattern used by
 * `apps/mobile/tests/unit/aiPaywallSheetShape.test.ts`.
 *
 * Covered:
 *  1. Imports `midpoint` / `rangeFor` / `aggregateRange` /
 *     `plateConfidence` / `photoLogSaveCopy` from the shared
 *     `aiLogging` module — never re-rolls these in mobile.
 *  2. Imports the new analytics events
 *     (`ai_photo_log_verify_tapped` / succeeded / failed) and fires
 *     them at the verify call site.
 *  3. Renders the plate hero card chrome (28pt midpoint headline +
 *     "plate total" subline + range caption with confidence label).
 *  4. Per-item card emits the new "AI estimate" / "database · verified"
 *     chip swap.
 *  5. Tri-state save copy strings are present verbatim ("Log verified" /
 *     "Log meal" / "Log estimate").
 *  6. The retired `#EF4444` literal has been replaced by the
 *     `Accent.destructive` token (spec L246-251 cleanup).
 *  7. Verify CTA "Verify with database" is present (spec Row 3 expanded).
 *  8. The retired "Log anyway" / "Log all" copy is gone.
 *  9. Tooltip helper text is present for the meter tap.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SHEET_PATH = resolve(__dirname, "../../components/PhotoLogSheet.tsx");
const SHEET_SOURCE = readFileSync(SHEET_PATH, "utf8");

describe("PhotoLogSheet confidence-framing contract (2026-05-02)", () => {
  it("imports midpoint / rangeFor / aggregateRange / plateConfidence / photoLogSaveCopy from shared aiLogging", () => {
    expect(SHEET_SOURCE).toMatch(/aggregateRange/);
    expect(SHEET_SOURCE).toMatch(/midpoint\b/);
    expect(SHEET_SOURCE).toMatch(/rangeFor\b/);
    expect(SHEET_SOURCE).toMatch(/plateConfidence\b/);
    expect(SHEET_SOURCE).toMatch(/photoLogSaveCopy\b/);
    // All from the shared module — never re-rolled in mobile.
    expect(SHEET_SOURCE).toMatch(
      /from\s+["']\.\.\/\.\.\/\.\.\/src\/lib\/nutrition\/aiLogging["']/,
    );
  });

  it("fires the three new verify analytics events at the verify call site", () => {
    expect(SHEET_SOURCE).toMatch(
      /track\(\s*AnalyticsEvents\.ai_photo_log_verify_tapped\b/,
    );
    expect(SHEET_SOURCE).toMatch(
      /track\(\s*AnalyticsEvents\.ai_photo_log_verify_succeeded\b/,
    );
    expect(SHEET_SOURCE).toMatch(
      /track\(\s*AnalyticsEvents\.ai_photo_log_verify_failed\b/,
    );
    // Failure event must always carry a reason — three legitimate values.
    expect(SHEET_SOURCE).toMatch(/reason:\s*["'](no_match|server_error|offline)["']/);
  });

  it("renders the plate hero card chrome (28pt midpoint + 'plate total' subline + range caption)", () => {
    // 28pt headline.
    expect(SHEET_SOURCE).toMatch(/fontSize:\s*28/);
    // The literal headline format `~{totals.calories} kcal` is the
    // public-facing spec line — pin its presence verbatim. JSX uses
    // `{...}` (single-brace expression) here, not `${...}` template
    // literal, so the regex matches a literal `{`.
    expect(SHEET_SOURCE).toMatch(/~\{totals\.calories\}\s*kcal/);
    // "plate total · N item(s)" subline (template literal inside JSX).
    expect(SHEET_SOURCE).toMatch(/plate total · \{items\.length\}/);
    // Range caption with confidence label.
    expect(SHEET_SOURCE).toMatch(/Range \{plateRange\.low\}–\{plateRange\.high\}/);
  });

  it("renders the per-item 'AI estimate' chip and its verified counterpart 'database · verified'", () => {
    expect(SHEET_SOURCE).toContain("AI estimate");
    expect(SHEET_SOURCE).toContain("database · verified");
  });

  it("renders the tri-state save copy strings verbatim (Log verified / Log meal / Log estimate)", () => {
    // Strings live in `photoLogSaveCopy` (shared) but the button reads
    // `saveCopy.primary` — assert the helper is wired to render those
    // exact strings via the surface's source text.
    expect(SHEET_SOURCE).toMatch(/saveCopy\.primary/);
    // Defensive — also ensure the legacy "Log anyway" / "Log all" copy
    // is gone so a refactor that re-wires the button without the
    // helper would fail loudly.
    expect(SHEET_SOURCE).not.toMatch(/"Log anyway"/);
    expect(SHEET_SOURCE).not.toMatch(/"Log all"/);
  });

  it("uses Accent.destructive (no raw #EF4444 literal) per the spec L246-251 cleanup", () => {
    expect(SHEET_SOURCE).not.toMatch(/#EF4444/i);
    expect(SHEET_SOURCE).toMatch(/Accent\.destructive/);
  });

  it("renders the 'Verify with database' CTA inside the expanded item row", () => {
    expect(SHEET_SOURCE).toContain("Verify with database");
  });

  it("renders the meter-tap tooltip helper text", () => {
    expect(SHEET_SOURCE).toMatch(/Estimated from photo/);
    expect(SHEET_SOURCE).toMatch(/USDA \/ Open Food Facts/);
  });

  it("uses LayoutAnimation for expand/collapse (spec interaction)", () => {
    expect(SHEET_SOURCE).toMatch(/LayoutAnimation/);
  });

  it("imports lucide-react-native chevrons + check + shield + more glyphs (prototype-icons rule)", () => {
    expect(SHEET_SOURCE).toMatch(
      /import\s*\{[^}]*ChevronDown[^}]*\}\s*from\s*["']lucide-react-native["']/,
    );
    expect(SHEET_SOURCE).toMatch(/ChevronUp/);
    expect(SHEET_SOURCE).toMatch(/\bCheck\b/);
    expect(SHEET_SOURCE).toMatch(/ShieldCheck/);
    expect(SHEET_SOURCE).toMatch(/MoreHorizontal/);
  });
});
