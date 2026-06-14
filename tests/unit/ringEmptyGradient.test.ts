/**
 * ENG-1086 — the empty cold-open calorie ring paints a confident brand-gradient
 * loop (plum → aubergine → lift) instead of a grey loading skeleton.
 *
 * Structural source test (reads the files) so one spec covers BOTH platforms in
 * the shared web vitest run — same pattern as `discoverThreeSectionLayout.test.ts`.
 * Flag-gated on `ring_empty_gradient_v1` (default-on); the legacy grey track +
 * 1px hairline empty render stays as the kill-switch path.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const SKIA_SRC = readFileSync(
  resolve(ROOT, "apps/mobile/components/charts/SkiaRingArcs.tsx"),
  "utf8",
);
const HOST_SRC = readFileSync(
  resolve(ROOT, "apps/mobile/components/charts/CalorieRing.tsx"),
  "utf8",
);
const WEB_RING_SRC = readFileSync(
  resolve(ROOT, "src/app/components/suppr/daily-ring.tsx"),
  "utf8",
);
const MOBILE_THEME = readFileSync(
  resolve(ROOT, "apps/mobile/constants/theme.ts"),
  "utf8",
);
const WEB_THEME = readFileSync(resolve(ROOT, "src/styles/theme.css"), "utf8");

describe("empty calorie ring → brand-gradient loop (ENG-1086)", () => {
  describe("mobile (Skia layer)", () => {
    it("imports the SweepGradient shader from Skia", () => {
      expect(SKIA_SRC).toMatch(/SweepGradient/);
      expect(SKIA_SRC).toMatch(/import \{[\s\S]*?SweepGradient[\s\S]*?\} from "@shopify\/react-native-skia"/);
    });

    it("paints a SweepGradient on the empty ring when the flag is on, hairline in the else", () => {
      // Empty + emptyGradient → SweepGradient sweep; else (flag-off) → the
      // legacy 1px inner hairline render.
      expect(SKIA_SRC).toMatch(/isEmpty && emptyGradient && emptyGradientStops/);
      expect(SKIA_SRC).toMatch(/<SweepGradient/);
      // The first stop is repeated at the tail so the sweep wraps seamlessly.
      expect(SKIA_SRC).toMatch(/colors=\{\[\.\.\.emptyGradientStops, emptyGradientStops\[0\]!\]\}/);
      // Legacy hairline kept as the kill-switch path.
      expect(SKIA_SRC).toMatch(/strokeWidth=\{1\}\s*\n\s*color=\{emptyInnerColor\}/);
    });

    it("hides the inner macro arcs only in the COLLAPSED empty state; shows the unpopulated multi-ring when macros are shown (ENG-1093)", () => {
      // ENG-1093 superseded the unconditional `expanded && !isEmpty` — empty +
      // Show-macros now renders the unpopulated multi-ring tracks.
      expect(SKIA_SRC).toMatch(/expanded && \(!isEmpty \|\| emptyShowsMacros\)/);
      expect(SKIA_SRC).toMatch(/emptyShowsMacros = isEmpty && expanded && emptyMacroParity/);
    });
  });

  describe("mobile (host wiring)", () => {
    it("gates on `ring_empty_gradient_v1` and feeds the brand gradient + opacity token", () => {
      expect(HOST_SRC).toMatch(/isFeatureEnabled\("ring_empty_gradient_v1"\)/);
      // ENG-1093 — the loop is now scoped to collapsed-empty via `showEmptyLoop`.
      expect(HOST_SRC).toMatch(/emptyGradient=\{showEmptyLoop\}/);
      expect(HOST_SRC).toMatch(/emptyGradientStops=\{AccentWinGradient\.stops\}/);
      expect(HOST_SRC).toMatch(/emptyGradientOpacity=\{RING_EMPTY_GRADIENT_OPACITY\}/);
    });

    it("the empty COLD-OPEN loop wears the bold collapsed-hero stroke (0.085·S) only while macros are hidden (ENG-1093), Skia path only", () => {
      expect(HOST_SRC).toMatch(/emptyBoldStroke = Math\.round\(SIZE \* 0\.085\)/);
      expect(HOST_SRC).toMatch(
        /showEmptyLoop = isEmpty && emptyGradientOn && !\(emptyMacroParityOn && expanded\)/,
      );
      expect(HOST_SRC).toMatch(/STROKE: showEmptyLoop \? emptyBoldStroke : STROKE/);
    });

    it("exposes the RING_EMPTY_GRADIENT_OPACITY token (~0.36)", () => {
      expect(MOBILE_THEME).toMatch(/export const RING_EMPTY_GRADIENT_OPACITY = 0\.36;/);
    });
  });

  describe("web (DailyRing parity)", () => {
    it("defines the plum brand-gradient def (NOT the warm winSpectrum)", () => {
      expect(WEB_RING_SRC).toMatch(/id="ringEmptyGradient"/);
      expect(WEB_RING_SRC).toMatch(/id="ringEmptyGradient"[\s\S]{0,260}#3B2A4D[\s\S]{0,80}#5B3B6E[\s\S]{0,80}#7E5C92/);
    });

    it("gates on `ring_empty_gradient_v1` and strokes the empty ring with the gradient (loop scoped to collapsed-empty, ENG-1093)", () => {
      expect(WEB_RING_SRC).toMatch(/isFeatureEnabled\("ring_empty_gradient_v1"\)/);
      expect(WEB_RING_SRC).toMatch(
        /showEmptyGradient = isEmpty && emptyGradientOn && !emptyShowsMacros/,
      );
      expect(WEB_RING_SRC).toMatch(/stroke="url\(#ringEmptyGradient\)"/);
      expect(WEB_RING_SRC).toMatch(/opacity: "var\(--ring-empty-gradient-opacity\)"/);
    });

    it("the empty ring wears the bold collapsed-hero stroke (0.085·S)", () => {
      expect(WEB_RING_SRC).toMatch(/emptyBoldStroke = Math\.round\(size \* 0\.085\)/);
      expect(WEB_RING_SRC).toMatch(/strokeWidth=\{showEmptyGradient \? emptyBoldStroke : strokeWidth\}/);
    });

    it("shows the unpopulated multi-ring when macros are shown on an empty day (ENG-1093 parity with mobile)", () => {
      expect(WEB_RING_SRC).toMatch(
        /expanded && \(!isEmpty \|\| emptyShowsMacros\) && macroRings\.map/,
      );
    });

    it("exposes the --ring-empty-gradient-opacity token", () => {
      expect(WEB_THEME).toMatch(/--ring-empty-gradient-opacity:\s*0\.36;/);
    });
  });
});
