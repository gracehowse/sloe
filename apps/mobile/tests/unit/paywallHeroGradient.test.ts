/**
 * Mobile paywall header — Sloe DS calm chrome (08 Paywall, frame 284:2).
 *
 * History: the 2026-04-21 brand-gradient hero was retired 2026-05-20 for a
 * flat theme-foreground card header. The 2026-06-07 Sloe DS reskin keeps the
 * calm, NON-gradient intent — still a cream `colors.card` surface, never the
 * blue brand-gradient hero — but moves the heading to the plum serif voice
 * (`colors.navPrimary`) and rounds the header's bottom corners so the paywall
 * reads as a bottom sheet rising off the page (monetisation decision). This
 * test guards: (1) no legacy blue-gradient hero, (2) plum-serif heading on the
 * cream card, (3) the sheet-style rounded bottom corners.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PAYWALL_PATH = resolve(__dirname, "../../app/paywall.tsx");

describe("mobile paywall — Sloe DS calm header (no brand-gradient hero)", () => {
  const src = readFileSync(PAYWALL_PATH, "utf8");

  it("does not render the legacy paywall-hero-grad SVG banner", () => {
    expect(src).not.toContain('id="paywall-hero-grad"');
    expect(src).not.toMatch(/stopColor=\{Accent\.magenta\}/);
  });

  it("uses the plum-serif brand voice on the header heading (not white-on-gradient)", () => {
    // Sloe DS: heading reads in the plum nav/brand hue (`colors.navPrimary`),
    // not white-on-gradient. Subtitle stays on the muted theme foreground.
    expect(src).toContain("color: colors.navPrimary, lineHeight: 32");
    expect(src).toContain("color: colors.textSecondary");
    expect(src).not.toContain('headerTitle: { fontSize: 24, fontWeight: "800", color: "#ffffff"');
  });

  it("styles the header as a cream card surface that reads as a bottom sheet", () => {
    // Cream `colors.card` fill (never the blue brand gradient), with rounded
    // bottom corners so the paywall rises off the page like a sheet.
    expect(src).toMatch(/header:[\s\S]*backgroundColor: colors\.card/);
    expect(src).toMatch(/header:[\s\S]*borderBottomLeftRadius/);
    expect(src).toMatch(/header:[\s\S]*borderBottomRightRadius/);
  });
});
