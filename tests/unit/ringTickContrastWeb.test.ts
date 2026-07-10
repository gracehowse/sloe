/**
 * Web empty-ring tick visibility gate (ENG-1485).
 *
 * Web mirror of apps/mobile ringTickContrast.test.ts: `--ring-tick` is an
 * rgba the v3 dial paints straight over `--card` (carded hero) or
 * `--background` (de-carded hero / desktop), so the gate alpha-composites
 * the tick over BOTH grounds per scheme and asserts the measured WCAG
 * contrast. Parses theme.css directly so the gate tracks shipped values.
 *
 * Floor ratified 2026-07-10 (ENG-1485): the empty track is DECORATIVE
 * geometry, not informational text/iconography, so the ENG-1315 3:1
 * non-text target does not apply — ≥1.3:1 is the floor for decorative
 * tracks. Shipped values measure ~1.45:1 light / ~1.70:1 dark.
 *
 * Also pins the ENG-1485 render fix: the web dial must NOT re-attenuate the
 * track ticks with an extra `opacity` prop — the token already carries its
 * alpha, and the removed `opacity={0.7}` double-discount measured 1.29:1 on
 * the light grounds (below the floor) while mobile rendered the same token
 * at full strength.
 *
 * Modelled on skeletonTokenContrastWeb.test.ts (ENG-1486).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../src/styles/theme.css"), "utf8");

const FLOOR = 1.3;

/** Slice the scheme block ("light" = before the dark selector, "dark" = after). */
function schemeSection(scheme: "light" | "dark"): string {
  const darkStart = css.search(/\.dark\s*\{|\[data-theme="dark"\]|@media \(prefers-color-scheme: dark\)/);
  expect(darkStart).toBeGreaterThan(0);
  return scheme === "light" ? css.slice(0, darkStart) : css.slice(darkStart);
}

function tokenColor(scheme: "light" | "dark", token: string): [number, number, number, number] {
  const section = schemeSection(scheme);
  const m = new RegExp(`--${token}:\\s*(#[0-9a-fA-F]{6}|rgba?\\([^)]+\\))`).exec(section);
  expect(m, `--${token} (${scheme}) must be a literal hex or rgba`).toBeTruthy();
  return parseColor(m![1]);
}

function parseColor(value: string): [number, number, number, number] {
  const rgba = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/.exec(value);
  if (rgba) {
    return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), rgba[4] === undefined ? 1 : Number(rgba[4])];
  }
  const h = value.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return [r, g, b, 1];
}

function composite(fg: [number, number, number, number], bg: [number, number, number, number]): [number, number, number] {
  const a = fg[3];
  return [0, 1, 2].map((i) => a * fg[i] + (1 - a) * bg[i]) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe("--ring-tick — visible on every ground the dial sits on (ENG-1485)", () => {
  const schemes = ["light", "dark"] as const;
  const grounds = ["card", "background"] as const;

  for (const scheme of schemes) {
    for (const ground of grounds) {
      it(`${scheme}: tick over --${ground} clears the ${FLOOR}:1 decorative floor`, () => {
        const g = tokenColor(scheme, ground);
        const ratio = contrast(composite(tokenColor(scheme, "ring-tick"), g), [g[0], g[1], g[2]]);
        expect(ratio).toBeGreaterThanOrEqual(FLOOR);
      });
    }
  }

  it("the dial's track ticks carry NO extra opacity attenuation (the removed 0.7 double-discount)", () => {
    const dial = readFileSync(
      resolve(__dirname, "../../src/app/components/suppr/calorie-ring-dial.tsx"),
      "utf8",
    );
    // The track-tick rect (fill={tickFill}) must not also set an `opacity`
    // prop — the token alpha is the single source of tick strength. Scan the
    // JSX attributes of any element that fills with the tick colour.
    const trackRects = dial.match(/<rect[^>]*fill=\{tickFill\}[^>]*\/>/gs) ?? [];
    expect(trackRects.length).toBeGreaterThan(0);
    for (const rect of trackRects) {
      expect(rect).not.toMatch(/\bopacity=/);
    }
  });
});
