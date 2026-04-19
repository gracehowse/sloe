/**
 * Landing CSS reduced-motion pin (2026-04-19 D&I audit P1).
 *
 * The landing page sheet defines 15+ `transition:` declarations and a
 * `lp-pulse` infinite animation. Users with vestibular sensitivities
 * toggle `prefers-reduced-motion: reduce` at the OS level; the landing
 * must respect that toggle.
 *
 * This test pins the presence of a `@media (prefers-reduced-motion:
 * reduce)` block that neutralises animation + transition duration
 * inside the `.lp` root. A source-level read is sufficient — running
 * Playwright purely for a CSS rule is overkill.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const LANDING_CSS = resolve(__dirname, "../../app/(landing)/landing.css");

describe("landing.css reduced-motion — D&I audit 2026-04-19", () => {
  const css = readFileSync(LANDING_CSS, "utf8");

  it("defines a prefers-reduced-motion: reduce media block", () => {
    expect(css).toMatch(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/);
  });

  it("neutralises animation-duration and transition-duration under reduce", () => {
    const reduceBlockMatch = css.match(
      /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{[\s\S]*?\n\}/,
    );
    expect(reduceBlockMatch).toBeTruthy();
    const block = reduceBlockMatch![0];
    expect(block).toMatch(/animation-duration:\s*0\.0*1m?s/);
    expect(block).toMatch(/transition-duration:\s*0\.0*1m?s/);
  });
});
