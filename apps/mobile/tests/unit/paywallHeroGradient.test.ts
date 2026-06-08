/**
 * Mobile paywall hero — Sloe Pro paywall (Figma `284:2`).
 *
 * History:
 *   - 2026-04-21: brand-gradient (blue→magenta) hero banner.
 *   - 2026-05-20: retired the gradient for a flat theme-foreground header.
 *   - 2026-06-07: Sloe DS reskin — cream `colors.card` card header, plum
 *     serif heading.
 *   - 2026-06-08: Figma `284:2` rebuild — the flat cream-card header is
 *     replaced by a full-bleed food PHOTO hero (`PaywallHero`) with a soft
 *     fade, "SLOE PRO" eyebrow, and the "Cook what you love. / Still reach
 *     your goals." positioning headline (plum Newsreader serif, italic
 *     "Still"). The NON-gradient intent is unchanged — still never the blue
 *     brand gradient.
 *
 * This test guards: (1) no legacy blue-gradient hero anywhere, (2) the
 * screen renders the `PaywallHero` photo block, (3) the plum-serif brand
 * voice carries the headline (in `PaywallHero`, on `colors.navPrimary`),
 * (4) the hero is a bundled local asset, not a remote URL.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PAYWALL_PATH = resolve(__dirname, "../../app/paywall.tsx");
const HERO_PATH = resolve(__dirname, "../../components/paywall/PaywallHero.tsx");

describe("mobile paywall — Sloe Pro photo hero (no brand-gradient hero)", () => {
  const screen = readFileSync(PAYWALL_PATH, "utf8");
  const hero = readFileSync(HERO_PATH, "utf8");

  it("does not render the legacy blue brand-gradient hero banner", () => {
    expect(screen).not.toContain('id="paywall-hero-grad"');
    expect(screen).not.toMatch(/stopColor=\{Accent\.magenta\}/);
    expect(hero).not.toContain('id="paywall-hero-grad"');
    expect(hero).not.toMatch(/Accent\.magenta/);
    // The old flat cream-card header is gone — replaced by the photo hero.
    expect(screen).not.toMatch(/header:\s*\{[\s\S]*borderBottomLeftRadius/);
  });

  it("renders the PaywallHero photo block", () => {
    expect(screen).toContain("PaywallHero");
    expect(screen).toContain('from "@/components/paywall/PaywallHero"');
  });

  it("uses a bundled local hero asset (not a remote URL)", () => {
    // Trust-critical surface — a network failure must never break the hero.
    expect(hero).toContain("paywall-hero.jpg");
    expect(hero).not.toMatch(/source=\{\{\s*uri:/);
  });

  it("carries the headline in the plum-serif brand voice (not white-on-gradient)", () => {
    // The positioning headline reads in the plum nav/brand hue
    // (`colors.navPrimary`) in Newsreader serif, with a real italic "Still".
    expect(hero).toContain("colors.navPrimary");
    expect(hero).toContain("FontFamily.serif");
    expect(hero).toContain("Cook what you love.");
    expect(hero).toContain("reach your goals.");
  });

  it("renders the SLOE PRO eyebrow in clay", () => {
    // The eyebrow is the clay "Pro" voice (Accent.primarySolid) per `284:2`.
    expect(hero).toContain("Accent.primarySolid");
  });
});
