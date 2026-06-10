/**
 * Frost secondary-colour exploration — RETIRED (ENG-997, 2026-06-08).
 *
 * This file used to pin the `.flag-frost` damson override behaviour. The
 * brand-manager decision (2026-06-08) made Aubergine `#3B2A4D` the
 * UNCONDITIONAL functional accent on web + mobile
 * (`docs/decisions/2026-06-08-aubergine-accent-system.md`). Clay survives
 * only as the carbs macro colour (`--macro-carbs`). So this file is now the
 * RETIREMENT guard — it fails if any of the Frost flag wiring creeps back:
 *
 *   1. The `.flag-frost` (light) + `.dark.flag-frost` override blocks are gone
 *      from `theme.css`, and no `.flag-frost` selector survives anywhere.
 *   2. `--accent-primary` in `:root` (light) and `.dark` is the canonical
 *      AUBERGINE unconditionally (no flag toggles it any more).
 *   3. The win gradient stays the aubergine-family Sloe brand gradient.
 *   4. `brand_frost_secondary` is no longer referenced in `track.ts` at all.
 *   5. The `FrostFlagToggle` component is deleted and `app/providers.tsx`
 *      no longer mounts it.
 *
 * Web mirror of `apps/mobile/tests/unit/accentTokens.test.ts` (which guards the
 * removal of `AccentFrost` / `AccentWinGradientFrost`).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const THEME_CSS = readFileSync(resolve(ROOT, "src/styles/theme.css"), "utf8");
const TRACK_TS = readFileSync(
  resolve(ROOT, "src/lib/analytics/track.ts"),
  "utf8",
);
const PROVIDERS_TSX = readFileSync(resolve(ROOT, "app/providers.tsx"), "utf8");

/** Extract the body of a single-selector CSS rule by its opening selector text. */
function ruleBody(selectorOpen: string): string {
  const idx = THEME_CSS.indexOf(selectorOpen);
  expect(idx, `rule "${selectorOpen}" missing in theme.css`).toBeGreaterThanOrEqual(0);
  const open = THEME_CSS.indexOf("{", idx);
  let depth = 1;
  let i = open + 1;
  while (i < THEME_CSS.length && depth > 0) {
    const ch = THEME_CSS[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    i += 1;
  }
  return THEME_CSS.slice(open + 1, i - 1);
}

function readVar(body: string, name: string): string | null {
  const m = body.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return m ? m[1].trim().toLowerCase() : null;
}

describe("Frost flag — retired (.flag-frost cascade removed)", () => {
  it("no .flag-frost selector survives in theme.css", () => {
    expect(THEME_CSS).not.toContain(".flag-frost");
  });

  it("no damson override hexes from the old Frost block leak into theme.css", () => {
    // The old Frost block redefined the accent to damson #6A4B7A / #54356A /
    // #9A7BAA / #B6ACC6. None of those may carry the accent any more — clay is
    // unconditional. (These hexes can still appear for the win/Pro/source-ai
    // brand-identity roles, so we only assert they're not on --accent-primary*,
    // checked below.)
    const LIGHT = ruleBody(":root {");
    const DARK = ruleBody(".dark {");
    expect(readVar(LIGHT, "accent-primary")).not.toBe("#6a4b7a");
    expect(readVar(DARK, "accent-primary")).not.toBe("#9a7baa");
  });
});

describe("Aubergine is the unconditional functional accent", () => {
  const LIGHT = ruleBody(":root {");
  const DARK = ruleBody(".dark {");

  // Light: --accent-primary #3B2A4D (plum ink, the deepest depth / wordmark hue).
  // --accent-primary-solid also #3B2A4D (≈12:1 on white — AA PASS as text/icon).
  // Spec: docs/decisions/2026-06-08-aubergine-accent-system.md
  it(":root accent-primary is the canonical aubergine (plum ink)", () => {
    expect(readVar(LIGHT, "accent-primary")).toBe("#3b2a4d");
    expect(readVar(LIGHT, "accent-primary-solid")).toBe("#3b2a4d");
  });

  // Dark: --accent-primary #7E5C92 (lifted for OLED contrast).
  // --accent-primary-solid #C4ACD0 (the text/icon/link token on dark card).
  it(".dark accent-primary is the lifted aubergine", () => {
    expect(readVar(DARK, "accent-primary")).toBe("#7e5c92");
    expect(readVar(DARK, "accent-primary-solid")).toBe("#c4acd0");
  });

  // Win gradient: plum → plum-lift → plum-glow (all aubergine-family).
  // Light: #3B2A4D → #5B3B6E → #7E5C92
  // Dark:  #815E91 → #D58A5E → #D6A24A  (lifted; D58A5E is the dark lifted clay-mid stop)
  it("the win gradient stays the aubergine-family Sloe brand gradient (light + dark)", () => {
    expect(readVar(LIGHT, "accent-win-gradient")).toBe(
      "linear-gradient(120deg, #3b2a4d 0%, #5b3b6e 50%, #7e5c92 100%)",
    );
    expect(readVar(DARK, "accent-win-gradient")).toBe(
      "linear-gradient(120deg, #815e91 0%, #d58a5e 50%, #d6a24a 100%)",
    );
  });
});

describe("Frost flag wiring is gone", () => {
  it("brand_frost_secondary is not referenced in track.ts", () => {
    expect(TRACK_TS).not.toContain("brand_frost_secondary");
  });

  it("the FrostFlagToggle component is deleted", () => {
    expect(
      existsSync(resolve(ROOT, "src/app/components/FrostFlagToggle.tsx")),
    ).toBe(false);
  });

  it("app/providers.tsx no longer mounts FrostFlagToggle", () => {
    expect(PROVIDERS_TSX).not.toContain("FrostFlagToggle");
  });
});
