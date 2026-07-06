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
const PLAN_SELECTOR_PATH = resolve(
  __dirname,
  "../../components/paywall/PaywallPlanSelector.tsx",
);

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

  it("renders the SLOE PRO eyebrow in the aubergine accent via useAccent()", () => {
    // The eyebrow is the "Pro" voice in the brand accent per `284:2`.
    // ENG-997: the eyebrow reads the accent via `useAccent()`, which is now the
    // unconditional aubergine `Accent` (#5B3B6E — the Frost secondary-colour
    // exploration was retired 2026-06-08 and clay was superseded by aubergine
    // the same day), not the static `Accent.primarySolid`. The hook indirection
    // is kept; it just always returns the aubergine palette.
    expect(hero).toContain('from "@/context/theme"');
    expect(hero).toMatch(/const\s+accent\s*=\s*useAccent\(\)/);
    expect(hero).toContain("accent.primarySolid");
  });

  it("ENG-1382/ENG-1374: has a tinted fallback background so a failed/slow image load never renders blank white", () => {
    // The outer hero View must carry a theme-token backgroundColor
    // (Sloe Deep, the same dark-plum brand ground used on the onboarding
    // welcome screen) so the image container is never bare/transparent —
    // structural guarantee, not dependent on the Image resolving.
    expect(hero).toContain("Accent.primaryDeep");
    expect(hero).toMatch(/backgroundColor:\s*Accent\.primaryDeep/);
  });
});

describe("mobile paywall — plan selector active-row treatment (Sloe)", () => {
  const planSelector = readFileSync(PLAN_SELECTOR_PATH, "utf8");

  /** The `rowSelected: { … }` style block body, isolated so the
   *  assertions can't accidentally match a `backgroundColor` from a later
   *  style (e.g. `bestValue` / `radioDot`) via a greedy `[\s\S]*`. */
  const rowSelectedBlock = (() => {
    const m = planSelector.match(/rowSelected:\s*\{([\s\S]*?)\}/);
    return m ? m[1] : "";
  })();

  it("fills the selected plan row with the aubergine SOFT tint, not a solid slab", () => {
    // Sloe treatment system (2026-06-08, rule 7): the active plan-selector row
    // is a soft aubergine tint + 2px ring — NOT a solid accent fill (the fill is
    // rationed to the FAB + the conversion CTA). This pins the `rowSelected`
    // style so a future edit can't regress the active row to a bare border or a
    // solid `accent.primary` slab.
    expect(rowSelectedBlock).toMatch(/backgroundColor:\s*accent\.primarySoft/);
    // The ring stays on the full-strength accent (the frame's selected ring).
    expect(rowSelectedBlock).toMatch(/borderColor:\s*accent\.primary[,\s}]/);
    // The selected row must NOT paint a solid `accent.primary` background
    // (only the SOFT variant). `primarySoft` shares the `accent.primary`
    // prefix, so guard the solid token with a trailing non-identifier char.
    expect(rowSelectedBlock).not.toMatch(
      /backgroundColor:\s*accent\.primary[,\s}]/,
    );
  });

  it("keeps the radio dot + BEST VALUE badge on the full-strength accent", () => {
    // The radio dot + the conversion "BEST VALUE" highlight badge legitimately
    // keep the solid accent (small surfaces / conversion highlight — parity with
    // the web "Most popular" ribbon). Guard they didn't get diluted to the tint.
    expect(planSelector).toMatch(
      /radioDot:\s*\{[\s\S]*backgroundColor:\s*accent\.primary[,\s}]/,
    );
    expect(planSelector).toMatch(
      /bestValue:\s*\{[\s\S]*backgroundColor:\s*accent\.primary[,\s}]/,
    );
  });
});
