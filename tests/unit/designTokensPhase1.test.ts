/**
 * Production design spec — 2026-04-27 — Phase 1 token coverage.
 *
 * Pins the canonical web theme tokens added in Phase 1:
 *   - source / provenance dots (--source-usda, --source-off, etc.)
 *   - confidence-neutral
 *   - north-star bg/border tokens
 *   - over-budget tokens
 *   - elevation tokens (--elev-card / --elev-sheet / --elev-float /
 *     --elev-float-primary)
 *   - easing tokens (--ease-spring-soft, --ease-decel)
 *
 * Each token is checked in BOTH the `:root` light block and the `.dark`
 * dark block — drift in dark-mode coverage was the most common failure
 * mode in the audit log.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const themeCss = readFileSync(
  path.resolve(__dirname, "../../src/styles/theme.css"),
  "utf8",
);

const REQUIRED_TOKENS = [
  "--source-usda",
  "--source-off",
  "--source-fatsecret",
  "--source-manual",
  "--source-ai",
  "--confidence-neutral",
  "--north-star-bg-from",
  "--north-star-bg-to",
  "--north-star-border",
  "--over-budget-fg",
  "--over-budget-soft",
  "--elev-card",
  "--elev-sheet",
  "--elev-float",
  "--elev-float-primary",
] as const;

const REQUIRED_EASING = ["--ease-spring-soft", "--ease-decel"] as const;

describe("design tokens — Phase 1 production design spec coverage (web)", () => {
  // Split the file into the light block (between `:root {` and the
  // first closing `}` ahead of `.dark`) and the dark block (between
  // `.dark {` and its closing `}`).
  const lightMatch = themeCss.match(/:root\s*\{([\s\S]*?)\n\}/);
  const darkMatch = themeCss.match(/\.dark\s*\{([\s\S]*?)\n\}/);

  it("locates both :root and .dark blocks", () => {
    expect(lightMatch).not.toBeNull();
    expect(darkMatch).not.toBeNull();
  });

  for (const token of REQUIRED_TOKENS) {
    it(`${token} is defined in :root (light)`, () => {
      expect(lightMatch?.[1]).toContain(token);
    });
    it(`${token} is defined in .dark`, () => {
      expect(darkMatch?.[1]).toContain(token);
    });
  }

  for (const easing of REQUIRED_EASING) {
    it(`${easing} is defined in :root`, () => {
      expect(lightMatch?.[1]).toContain(easing);
    });
  }

  it("--ease-spring-soft uses the spec's bezier curve", () => {
    expect(lightMatch?.[1]).toMatch(
      /--ease-spring-soft:\s*cubic-bezier\(0\.34,\s*1\.56,\s*0\.64,\s*1\)/,
    );
  });

  it("--ease-decel uses the spec's bezier curve", () => {
    expect(lightMatch?.[1]).toMatch(
      /--ease-decel:\s*cubic-bezier\(0\.05,\s*0\.7,\s*0\.1,\s*1\)/,
    );
  });

  it("body sets font-feature-settings tnum + ss01", () => {
    // The order isn't fixed, but both must be present in the body
    // declaration.
    const bodyBlock = themeCss.match(/body\s*\{([\s\S]*?)\}/);
    expect(bodyBlock).not.toBeNull();
    expect(bodyBlock?.[1]).toContain('"tnum"');
    expect(bodyBlock?.[1]).toContain('"ss01"');
  });

  it("global @media (prefers-reduced-motion: reduce) rule is present", () => {
    expect(themeCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });
});
