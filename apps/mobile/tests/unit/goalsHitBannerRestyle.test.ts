/**
 * F-139 (`ACyWRLx2M-_D9t2jdcNjmaU`, 2026-05-08) — Grace's "the goals
 * hit banner looks cheap" complaint. Pre-fix the banner used a solid
 * 88%-opacity Accent.primary (purple) block centred over the calorie
 * ring, fully obscuring the metric it celebrated.
 *
 * Post-fix: white card with subtle green border + inline checkmark
 * icon + soft shadow, anchored to the top of the screen (not centred
 * over the ring).
 *
 * Static analysis pin so the regression doesn't sneak back in.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..", "..", "..");
const SRC = readFileSync(
  resolve(REPO, "apps/mobile/app/(tabs)/index.tsx"),
  "utf8",
);

describe("F-139 — Goals hit banner restyle", () => {
  it("targetCelebration banner no longer uses Accent.primary + 'E8' background", () => {
    // Pre-fix used `backgroundColor: Accent.primary + "E8"` for the
    // solid purple block. Post-fix the banner is white card +
    // subtle green border. Pin the absence of the old color literal.
    const code = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    // Find the targetCelebration block and ensure the old color is gone.
    const re = /targetCelebration\s*&&[\s\S]{0,2000}?(?:\}\)|<\/View>\s*\)\s*\})/;
    const m = re.exec(code);
    expect(m, "targetCelebration block must exist").not.toBeNull();
    if (m) {
      expect(m[0]).not.toMatch(/Accent\.primary\s*\+\s*["']E8["']/);
    }
  });

  it("targetCelebration banner uses Accent.success accent + lucide CheckCircle2 icon", () => {
    // ENG-73 (2026-05-13): Today moved off `@expo/vector-icons` to
    // lucide-react-native. The Ionicons `name="checkmark-circle"`
    // is now `<CheckCircle2 />`. Pin the new lucide identifier so
    // a future regression to a different success glyph still trips.
    const code = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    const re = /targetCelebration\s*&&[\s\S]{0,2000}?(?:\}\)|<\/View>\s*\)\s*\})/;
    const m = re.exec(code);
    expect(m).not.toBeNull();
    if (m) {
      expect(m[0]).toMatch(/Accent\.success/);
      expect(m[0]).toMatch(/CheckCircle2/);
    }
  });

  it("targetCelebration banner anchors to top (insets.top + Spacing.lg) not centered over ring", () => {
    const code = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    const re = /targetCelebration\s*&&[\s\S]{0,2000}?(?:\}\)|<\/View>\s*\)\s*\})/;
    const m = re.exec(code);
    expect(m).not.toBeNull();
    if (m) {
      expect(m[0]).toMatch(/top:\s*insets\.top/);
      // No bottom: 0 / justifyContent: "center" full-screen overlay any more.
      expect(m[0]).not.toMatch(/bottom:\s*0/);
    }
  });
});
