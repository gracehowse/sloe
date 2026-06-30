/**
 * ENG-1269 — CalorieRing overflow-ramp + win-glow colours come from theme
 * tokens, not raw hexes.
 *
 * The six scheme-resolved colours that paint the over-budget ramp (`overflowFrom`
 * / `overflowTo`) and the win-glow cap (`winGlowColor`) used to be raw hex
 * literals in `CalorieRing.tsx` (with a bespoke eslint carve-out). ENG-1269
 * tokenised them as a VALUE-EQUAL swap — pixel-identical — by reusing existing
 * accent tokens and adding two new `to`-stop tokens (`Colors.{light,dark}.
 * ringOverflowTo`).
 *
 * What this protects:
 *   1. `CalorieRing.tsx` carries NO raw hex literal (re-introducing one — the
 *      thing the deleted carve-out used to permit — fails here, independently
 *      of the now-active eslint raw-hex lane).
 *   2. The value-equality invariant the swap rests on: each token still equals
 *      the exact hex it replaced. Because the swap is "pixel-identical", any
 *      future edit that changes one of these token VALUES would silently shift
 *      the rendered ring — this pins the literals so that edit fails loudly and
 *      points back here.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { Accent, Colors } from "../../constants/theme";

const SRC = readFileSync(
  resolve(__dirname, "../../components/charts/CalorieRing.tsx"),
  "utf8",
);

// Strip comments so a hex referenced in a doc comment never reads as a literal
// (mirrors the check:token-scale comment-stripping contract).
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("CalorieRing overflow + win-glow tokens (ENG-1269)", () => {
  it("CalorieRing.tsx code carries no raw hex colour literal", () => {
    expect(CODE).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("resolves the overflow ramp + win glow from theme tokens", () => {
    expect(CODE).toContain(
      "isDark ? Colors.dark.navPrimary : Accent.primaryLight",
    );
    expect(CODE).toContain(
      "isDark ? Colors.dark.ringOverflowTo : Colors.light.ringOverflowTo",
    );
    expect(CODE).toContain(
      "isDark ? Accent.primarySolidDark : Accent.primaryDark",
    );
  });

  // Value-equality pins — each token MUST equal the hex it replaced, or the
  // "pixel-identical" claim is broken and the ring silently re-colours.
  it("overflowFrom tokens equal the replaced hexes (#815E91 dark / #5B3B6E light)", () => {
    expect(Colors.dark.navPrimary).toBe("#815E91");
    expect(Accent.primaryLight).toBe("#5B3B6E");
  });

  it("overflowTo tokens equal the replaced hexes (#A589B5 dark / #7A5890 light)", () => {
    expect(Colors.dark.ringOverflowTo).toBe("#A589B5");
    expect(Colors.light.ringOverflowTo).toBe("#7A5890");
  });

  it("winGlow tokens equal the replaced hexes (#C4ACD0 dark / #7E5C92 light)", () => {
    expect(Accent.primarySolidDark).toBe("#C4ACD0");
    expect(Accent.primaryDark).toBe("#7E5C92");
  });
});
