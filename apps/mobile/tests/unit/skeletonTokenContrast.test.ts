/**
 * Skeleton token visibility gate (ENG-1479).
 *
 * The ENG-604 skeletons filled with `inputBg`; the v3 token migration
 * (ENG-1316) turned that white — white-on-white shimmer over a white card,
 * reading as a blank broken box (Discover "Recipe ideas", ~2.5s). Second
 * occurrence of the "later token change silently blanks an earlier
 * surface" class (first: ENG-1477 ring ticks), so this pins the pair
 * programmatically: `skeleton` must keep a measured luminance separation
 * from `card` in BOTH schemes. Floor 1.15:1 — the broken states measured
 * 1.00:1 (light) and 1.03:1 (dark); the shipped values measure ~1.20:1.
 */
import { describe, expect, it } from "vitest";
import { Colors } from "../../constants/theme";

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe("Colors.*.skeleton — visible against the card it loads inside", () => {
  it("light: skeleton vs card clears the 1.15:1 floor", () => {
    expect(contrast(Colors.light.skeleton, Colors.light.card)).toBeGreaterThanOrEqual(1.15);
  });

  it("dark: skeleton vs card clears the 1.15:1 floor", () => {
    expect(contrast(Colors.dark.skeleton, Colors.dark.card)).toBeGreaterThanOrEqual(1.15);
  });

  it("skeleton is never literally the card colour in either scheme", () => {
    expect(Colors.light.skeleton.toLowerCase()).not.toBe(Colors.light.card.toLowerCase());
    expect(Colors.dark.skeleton.toLowerCase()).not.toBe(Colors.dark.card.toLowerCase());
  });
});
