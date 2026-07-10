/**
 * Empty-ring tick visibility gate (ENG-1485).
 *
 * Third pin in the "later token change silently blanks an earlier surface"
 * class (ENG-1477 ring ticks, ENG-1479/1486 skeletons). `ringTick` is an
 * rgba the dial paints straight over the card (carded hero) or the page
 * ground (de-carded v3 hero), so the gate alpha-composites the tick over
 * BOTH grounds per scheme and asserts the measured WCAG contrast.
 *
 * Floor ratified 2026-07-10 (ENG-1485): the empty track is DECORATIVE
 * geometry, not informational text/iconography, so the ENG-1315 3:1
 * non-text target does not apply — ≥1.3:1 is the floor for decorative
 * tracks. Shipped values measure ~1.45:1 light / ~1.70:1 dark. (The
 * ENG-1477 pre-fix warm tick measured 1.02:1; the broken state this
 * guards against.)
 *
 * Modelled on skeletonTokenContrast.test.ts (ENG-1479).
 */
import { describe, expect, it } from "vitest";
import { Colors } from "../../constants/theme";

const FLOOR = 1.3;

function parseColor(value: string): [number, number, number, number] {
  const rgba = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/.exec(value);
  if (rgba) {
    return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), rgba[4] === undefined ? 1 : Number(rgba[4])];
  }
  const h = value.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return [r, g, b, 1];
}

/** Alpha-composite `fg` over an opaque `bg` (both as parsed channels). */
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

/** Contrast of the (translucent) tick composited over an opaque ground. */
function tickContrastOn(tick: string, ground: string): number {
  const g = parseColor(ground);
  return contrast(composite(parseColor(tick), g), [g[0], g[1], g[2]]);
}

describe("Colors.*.ringTick — visible on every ground the dial sits on (ENG-1485)", () => {
  const schemes = ["light", "dark"] as const;
  const grounds = ["card", "background"] as const;

  for (const scheme of schemes) {
    for (const ground of grounds) {
      it(`${scheme}: tick over ${ground} clears the ${FLOOR}:1 decorative floor`, () => {
        expect(
          tickContrastOn(Colors[scheme].ringTick, Colors[scheme][ground]),
        ).toBeGreaterThanOrEqual(FLOOR);
      });
    }
  }

  it("ringTick stays translucent (alpha < 1) — it is a graduation, not a filled arc", () => {
    for (const scheme of schemes) {
      expect(parseColor(Colors[scheme].ringTick)[3]).toBeLessThan(1);
    }
  });
});
