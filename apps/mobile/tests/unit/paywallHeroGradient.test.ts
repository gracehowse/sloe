/**
 * Mobile paywall header — premium calm chrome (2026-05-20).
 *
 * Replaces the 2026-04-21 brand-gradient hero requirement. Product
 * paywall uses a flat card header + theme foreground copy so blue
 * does not clash with Today premium surfaces.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PAYWALL_PATH = resolve(__dirname, "../../app/paywall.tsx");

describe("mobile paywall — calm header (no brand-gradient hero)", () => {
  const src = readFileSync(PAYWALL_PATH, "utf8");

  it("does not render the legacy paywall-hero-grad SVG banner", () => {
    expect(src).not.toContain('id="paywall-hero-grad"');
    expect(src).not.toMatch(/stopColor=\{Accent\.magenta\}/);
  });

  it("uses theme foreground on header copy (not white-on-gradient)", () => {
    expect(src).toContain("color: colors.text, lineHeight: 32");
    expect(src).toContain("color: colors.textSecondary");
    expect(src).not.toContain('headerTitle: { fontSize: 24, fontWeight: "800", color: "#ffffff"');
  });

  it("styles the header as a bordered card surface", () => {
    expect(src).toMatch(/header:[\s\S]*backgroundColor: colors\.card/);
    expect(src).toMatch(/borderBottomColor: colors\.border/);
  });
});
