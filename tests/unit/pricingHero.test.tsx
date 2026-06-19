import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PricingHero } from "../../app/pricing/PricingHero.tsx";
import { PricingLegacyTrustSignals } from "../../app/pricing/PricingLegacyTrustSignals.tsx";

vi.mock("../../src/lib/analytics/track.ts", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/lib/analytics/track.ts")>();
  return {
    ...actual,
    isFeatureEnabled: vi.fn((flag: string) =>
      flag === "paywall_trust_inline_v1" ? true : actual.isFeatureEnabled(flag),
    ),
  };
});

/**
 * `/pricing` hero — Sloe Pro paywall (Figma `284:2`, 2026-06-08).
 *
 * History: the D13 (2026-04-21) brand-gradient banner (`#588CE4 →
 * #DF5EBC`) was retired in the `284:2` rebuild for a full-bleed food
 * PHOTO hero with a soft fade, the "SLOE PRO" eyebrow, and the
 * positioning headline "Cook what you love. / *Still* reach your
 * goals." (Newsreader serif, italic "Still"). The gradient was flagged
 * as palette drift in `docs/ux/redesign/paywall.md` §3c.
 *
 * These tests protect:
 *  1. The hero renders the `284:2` positioning headline + "SLOE PRO"
 *     eyebrow (the same copy the mobile paywall hero renders).
 *  2. The legacy brand gradient is gone (regression guard — don't let
 *     a future refresh silently re-introduce the off-brand gradient).
 *  3. `app/pricing/page.tsx` renders the hero + the new value grid +
 *     comparison matrix blocks.
 */
describe("PricingHero (Figma 284:2)", () => {
  it("renders the positioning headline and SLOE PRO eyebrow", () => {
    const { container } = render(<PricingHero />);
    const text = container.textContent ?? "";
    expect(text).toContain("Sloe Pro");
    expect(text).toContain("Cook what you love.");
    expect(text).toContain("reach your goals.");
    // The retired D13 gradient title must not silently return.
    expect(text).not.toContain("The full meal planning loop");
  });

  it("uses the food-photo hero, not the legacy brand gradient", () => {
    const { container } = render(<PricingHero />);
    const html = container.innerHTML;
    // Photo hero present. Next.js `<Image>` URL-encodes the src into the
    // srcset (`%2Fpaywall%2F…`), so assert on the filename, which appears
    // in every encoded candidate.
    expect(html).toContain("paywall-hero.jpg");
    expect(html.toLowerCase()).toContain("%2fpaywall%2fpaywall-hero.jpg");
    // Legacy fixed brand-gradient endpoints are gone.
    expect(html).not.toContain("#588CE4");
    expect(html).not.toContain("#DF5EBC");
  });
});

describe("/pricing — 284:2 wiring", () => {
  const SRC = readFileSync(join(process.cwd(), "app/pricing/page.tsx"), "utf8");

  it("renders <PricingHero /> and not the retired flat hero copy", () => {
    expect(SRC).toContain("<PricingHero />");
    expect(SRC).not.toContain("Everything you need to eat well");
  });

  it("renders the new value grid + comparison matrix blocks", () => {
    expect(SRC).toContain("<PaywallValueGrid />");
    expect(SRC).toContain("<PaywallComparison />");
  });

  it("gates legacy post-tier trust signals behind paywall_trust_inline_v1 off path", () => {
    expect(SRC).toContain("<PricingLegacyTrustSignals />");
    expect(SRC).not.toMatch(/Cloud sync across devices/);
  });

  it("uses design-system tokens rather than raw Tailwind slate classes", () => {
    // M2 — no raw slate-{50,900,950,200,800,400,300,600,700,500}
    // class in the file (dark: or otherwise). If a new slate-* class
    // sneaks in, this fails and forces a token swap.
    expect(SRC).not.toMatch(/\bbg-slate-/);
    expect(SRC).not.toMatch(/\btext-slate-/);
    expect(SRC).not.toMatch(/\bborder-slate-/);
  });
});

describe("PricingLegacyTrustSignals (ENG-901)", () => {
  it("renders nothing when paywall_trust_inline_v1 is on (default-on)", () => {
    const { container } = render(<PricingLegacyTrustSignals />);
    expect(container).toBeEmptyDOMElement();
  });
});
