/**
 * landingParity — the public landing page at `/` must stay aligned
 * with the real product (features, pricing tiers, roadmap promises,
 * FAQ). Drift here shows up as misleading marketing copy, which is a
 * trust / legal risk for a nutrition product.
 *
 * What this test protects:
 *   - Landing feature claims that are easy to accidentally oversell
 *     (platforms, sources count, voice control) stay grounded in the
 *     real app.
 *   - Pricing tier headline numbers on the landing page match the
 *     canonical `/pricing` route (same prices, same period suffix).
 *   - Sloe editorial hero + pricing cards stay aligned with Figma LP1
 *     and the shared pricing SSOT.
 *   - Free-tier save limits on the landing pricing card stay pinned to
 *     `FREE_SAVE_LIMIT`.
 *
 * Scope note: we assert on the rendered HTML of `LandingPage` (the
 * component), not the raw source. That way a string that's broken up
 * by JSX tags, or composed from constants, still counts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ENG-1204 — control `isFeatureEnabled("landing_hero_hybrid_v1")` per test
 * so we can assert BOTH hero variants. Default follows the real registry:
 * `landing_hero_hybrid_v1` is default-ON (REDESIGN_DEFAULT_ON). The flag-OFF
 * test opts out explicitly.
 */
const { isFeatureEnabledMock, realFlagImpl } = vi.hoisted(() => {
  const realFlagImpl = { current: (_flag: string) => false };
  return {
    isFeatureEnabledMock: vi.fn((flag: string) => realFlagImpl.current(flag)),
    realFlagImpl,
  };
});
vi.mock("../../src/lib/analytics/track", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/analytics/track")>();
  // Default the mock to the REAL flag registry so sibling tests that depend on
  // genuinely default-on flags (e.g. paywall_free_mfp_wins_v1 — ENG-1203's free
  // MFP-switch wins) keep rendering. Only the hero tests override
  // landing_hero_hybrid_v1 per-case.
  realFlagImpl.current = actual.isFeatureEnabled;
  return { ...actual, isFeatureEnabled: isFeatureEnabledMock };
});

/** One shared client so `CheckoutButton` + `CurrentTierBadge` do not each mint a GoTrueClient (test noise). */
vi.mock("@supabase/supabase-js", () => {
  const shared = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        })),
      })),
    })),
  };
  return { createClient: vi.fn(() => shared) };
});

import { LandingPage } from "../../app/(landing)/LandingPage";
import { PricingTiersGrid } from "../../app/pricing/PricingTiersGrid";
import {
  PRICING_TIERS,
  FREE_SAVE_LIMIT,
  computeAnnualSavingsBadge,
} from "../../src/lib/landing/content";
import {
  HERO_CURRENT,
  HERO_HYBRID,
} from "../../src/lib/landing/sloeLandingContent";

beforeEach(() => {
  isFeatureEnabledMock.mockReset();
  isFeatureEnabledMock.mockImplementation((flag: string) => realFlagImpl.current(flag));
});

describe("landing page — Sloe editorial parity", () => {
  it("renders the Sloe hero headline (D-07 HYBRID, production default)", () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    expect(text).toContain(HERO_HYBRID.headline.pre.trim());
    expect(text).toContain(HERO_HYBRID.headline.em);
    expect(text).toContain(HERO_HYBRID.headline.post.trim());
  });

  it("uses Sloe branding (not legacy Suppr nav mark)", () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    expect(text).toContain("Sloe");
    expect(text).not.toContain("Suppr");
  });

  it("links Browse recipes to /discover", () => {
    const { container } = render(<LandingPage />);
    const browse = Array.from(container.querySelectorAll("a")).find((a) =>
      /browse recipes/i.test(a.textContent ?? ""),
    );
    expect(browse?.getAttribute("href")).toBe("/discover");
  });
});

describe("landing page — hero positioning flag (ENG-1204, D-07 HYBRID)", () => {
  function heroText() {
    const { container } = render(<LandingPage />);
    // The first <h1> is the hero headline; the <p> immediately after is the lead.
    const h1 = container.querySelector("h1");
    const lead = container.querySelector(".lp-lead-center");
    return {
      full: container.textContent ?? "",
      headline: h1?.textContent ?? "",
      lead: lead?.textContent ?? "",
    };
  }

  it("flag OFF renders the legacy recipe-first hero (kill switch)", () => {
    isFeatureEnabledMock.mockImplementation((flag: string) =>
      flag === "landing_hero_hybrid_v1" ? false : realFlagImpl.current(flag),
    );
    const { headline, lead } = heroText();
    expect(headline).toContain(HERO_CURRENT.headline.pre.trim());
    expect(headline).toContain(HERO_CURRENT.headline.em);
    expect(headline).toContain(HERO_CURRENT.headline.post.trim());
    expect(lead).toBe(HERO_CURRENT.lead);
    expect(headline).not.toContain(HERO_HYBRID.headline.pre.trim());
  });

  it("flag ON (default) renders the hybrid tracker/coaching headline + import wedge line", () => {
    const { headline, lead } = heroText();
    // Headline leads with the tracker + "what to eat next" coaching promise.
    expect(headline).toContain(HERO_HYBRID.headline.pre.trim());
    expect(headline).toContain(HERO_HYBRID.headline.em);
    expect(headline).toContain(HERO_HYBRID.headline.post.trim());
    // Lead keeps the import hook as the supporting wedge line.
    expect(lead).toBe(HERO_HYBRID.lead);
    expect(lead.toLowerCase()).toContain("tiktok or reel");
    // The current recipe-first headline must NOT appear on the flag-on path.
    expect(headline).not.toContain(HERO_CURRENT.headline.pre.trim());
  });

  it("only reads the landing_hero_hybrid_v1 flag for the hero gate", () => {
    render(<LandingPage />);
    expect(isFeatureEnabledMock).toHaveBeenCalledWith("landing_hero_hybrid_v1");
  });

  it("neither variant introduces a new product claim beyond the current hero", () => {
    // D-07 is an emphasis re-order, not a new promise. Both variants must
    // only reference surfaces the landing already asserts (recipe import +
    // macro tracking). Guard against accidental over-claim creep.
    const FORBIDDEN_NEW_CLAIMS = [
      "guaranteed",
      "lose weight",
      "doctor",
      "clinically",
      "personalized coach", // we coach "what to eat next", not a human coach
    ];
    for (const variant of [HERO_CURRENT, HERO_HYBRID]) {
      const blob = `${variant.eyebrow} ${variant.headline.pre} ${variant.headline.em} ${variant.headline.post} ${variant.lead}`.toLowerCase();
      for (const claim of FORBIDDEN_NEW_CLAIMS) {
        expect(blob, `${claim} in hero variant`).not.toContain(claim);
      }
    }
  });
});

describe("landing page — pricing tier parity with /pricing route", () => {
  const PRICING_SOURCE = readFileSync(
    join(process.cwd(), "app/pricing/page.tsx"),
    "utf8",
  );

  it("/pricing imports the shared SSOT (PRICING_TIERS)", () => {
    expect(PRICING_SOURCE).toContain("PRICING_TIERS");
    expect(PRICING_SOURCE).toContain('from "../../src/lib/landing/content');
  });

  it("SSOT exposes exactly Free / Pro (PR-01, 2026-04-28 — Base tier removed per strategic direction)", () => {
    expect(PRICING_TIERS.map((t) => t.name)).toEqual(["Free", "Pro"]);
  });

  it("landing displays every SSOT tier headline price", () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    for (const tier of PRICING_TIERS) {
      expect(text).toContain(tier.price);
    }
  });

  it("paid tiers carry an annualPrice + annualPeriod, and a derivable savings badge", () => {
    // Audit P04 (2026-05-05) — `annualSavings` is now optional on the
    // tier shape; the badge copy is computed at render time from
    // `price` + `annualPrice` via `computeAnnualSavingsBadge`. The
    // pin here is that every paid tier must produce a non-null badge,
    // either via the optional override or via the derived calc.
    for (const tier of PRICING_TIERS) {
      if (tier.checkoutTier === null) continue; // Free has no annual
      expect(tier.annualPrice, `${tier.name} annualPrice`).toBeTruthy();
      expect(tier.annualPeriod, `${tier.name} annualPeriod`).toBeTruthy();
      expect(computeAnnualSavingsBadge(tier), `${tier.name} derivable savings badge`).toBeTruthy();
    }
  });

  it("SSOT prices are GBP-denominated (no USD dollar sign)", () => {
    for (const tier of PRICING_TIERS) {
      expect(tier.price.startsWith("$")).toBe(false);
      if (tier.annualPrice) expect(tier.annualPrice.startsWith("$")).toBe(false);
    }
  });

  it("landing tier names match SSOT tier names", () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    for (const tier of PRICING_TIERS) {
      expect(text).toContain(tier.name);
    }
  });
});

describe("landing page — nutrition attribution (Figma LP1)", () => {
  it("renders mandatory FatSecret attribution in the footer", () => {
    const { container } = render(<LandingPage />);
    const badge = container.querySelector('a[href*="fatsecret"]');
    expect(badge, "FatSecret badge link").toBeTruthy();
    expect(badge?.getAttribute("aria-label") ?? "").toMatch(/fatsecret/i);
  });

  it("does not claim a source that isn't in the pipeline", () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    const RETIRED = ["Spoonacular", "Nutritionix"];
    for (const gone of RETIRED) {
      expect(text).not.toContain(gone);
    }
  });
});

describe("landing page — Adaptive TDEE (moved off LP1)", () => {
  it("does not repeat the retired '14 days' claim on the Sloe landing", () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    expect(text).not.toContain("over 14 days");
  });
});

describe("landing page — Free-tier save limit parity", () => {
  it("quotes the real FREE_SAVE_LIMIT", () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    expect(text).toContain(`${FREE_SAVE_LIMIT} recipes`);
  });
});

describe("landing page — free MFP-switch wins (ENG-1203)", () => {
  // MyFitnessPal paywalled barcode scanning + custom macro goals in 2026
  // (the #1 cited exodus reasons). Suppr ships both free — the landing
  // Free card must merchandise them by name. The `paywall_free_mfp_wins_v1`
  // flag is default-on (in `REDESIGN_DEFAULT_ON`), so `isFeatureEnabled`
  // returns true under vitest and the bullets render.
  it("calls out Free barcode scanning on the Free card", () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    expect(text).toContain("Free barcode scanning");
  });

  it("calls out Free custom macros on the Free card", () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    expect(text).toContain("Free custom macros");
  });
});

describe("/pricing — free MFP-switch wins on the Free column (ENG-1203)", () => {
  const TIERS = PRICING_TIERS.map((t) => ({
    ...t,
    cta: t.checkoutTier === null ? "Continue for free" : `Upgrade to ${t.name}`,
    featHeadStripped: t.featHead
      ? t.featHead.replace(/,\s*plus$/i, "")
      : undefined,
  }));

  it("renders both free callouts on the /pricing Free column", () => {
    const { container } = render(
      <PricingTiersGrid tiers={TIERS} paywallFrom="deep_link" />,
    );
    const text = container.textContent ?? "";
    // Barcode predates ENG-1203 (un-gated); custom macros is the gated
    // addition. With the default-on flag both must be present.
    expect(text).toContain("Barcode scanning — free forever");
    expect(text).toContain("Custom macros — free forever");
  });
});

describe("landing page — roadmap (Figma LP1)", () => {
  it("links to the dedicated /roadmap page instead of inlining the SSOT", () => {
    const { container } = render(<LandingPage />);
    const roadmap = Array.from(container.querySelectorAll("a")).find((a) =>
      a.getAttribute("href")?.includes("/roadmap"),
    );
    expect(roadmap, "footer or nav roadmap link").toBeTruthy();
  });
});

describe("/pricing — paid-tier renewal disclosure (legal round-4 + round-6 flag)", () => {
  // Build a Tier array shaped the way `app/pricing/page.tsx` passes it
  // in: every PRICING_TIERS entry, plus the derived `cta` +
  // `featHeadStripped` fields. Monthly (default state) covers the
  // trial-less disclosure; the ENG-1285 case below flips the toggle to
  // pin the annual trial disclosure too.
  const TIERS = PRICING_TIERS.map((t) => ({
    ...t,
    cta: t.checkoutTier === null ? "Continue for free" : `Upgrade to ${t.name}`,
    featHeadStripped: t.featHead
      ? t.featHead.replace(/,\s*plus$/i, "")
      : undefined,
  }));

  // Round-6 (2026-04-19) — the tax-clause copy is flag-gated behind
  // `STRIPE_TAX_ENABLED` so it tracks the Stripe Checkout route's
  // `automatic_tax` behaviour. Both states must stay valid so the copy
  // can ship ahead of the dashboard flip and flip on without a code
  // change. Two describe blocks below pin both branches.

  describe("flag ON (stripeTaxEnabled=true)", () => {
    it("renders the round-4 tax-inclusive VAT line — the post-legal wording (round-6 dropped 'shown')", () => {
      const { container } = render(
        <PricingTiersGrid tiers={TIERS} stripeTaxEnabled={true} paywallFrom="deep_link" />,
      );
      const text = container.textContent ?? "";
      // Round-6 (legal-reviewer): aligned to the mobile wording.
      // Guard BOTH the presence of the new line and the absence of the
      // old "Price shown …" variant.
      expect(text).toContain("Price includes any applicable VAT.");
      expect(text).not.toContain("Price shown includes any applicable VAT.");
    });

    it("does not carry the tax-exclusive disclosure", () => {
      const { container } = render(
        <PricingTiersGrid tiers={TIERS} stripeTaxEnabled={true} paywallFrom="deep_link" />,
      );
      const text = container.textContent ?? "";
      expect(text).not.toContain("Price excludes any applicable taxes");
    });
  });

  describe("flag OFF (stripeTaxEnabled=false — default)", () => {
    it("renders the pre-round-4 tax-EXCLUSIVE line (truthful while Stripe Tax is inactive)", () => {
      const { container } = render(
        <PricingTiersGrid tiers={TIERS} stripeTaxEnabled={false} paywallFrom="deep_link" />,
      );
      const text = container.textContent ?? "";
      // With the flag off, the /api/stripe/checkout route does NOT pass
      // `automatic_tax`, so Stripe charges the sticker price — copy must
      // say so.
      expect(text).toContain("Price excludes any applicable taxes.");
      expect(text).not.toContain("Price includes any applicable VAT.");
    });

    it("defaults to OFF when the prop is omitted (matches .env.example default)", () => {
      // `paywallFrom` is still required for analytics wiring, but
      // `stripeTaxEnabled` is opt-in — when absent the disclosure
      // must render the tax-EXCLUSIVE copy.
      const { container } = render(
        <PricingTiersGrid tiers={TIERS} paywallFrom="deep_link" />,
      );
      const text = container.textContent ?? "";
      expect(text).toContain("Price excludes any applicable taxes.");
    });
  });

  describe("shared disclosure surface (flag-independent)", () => {
    it("still carries the renewal + cancel + refund elements with the flag ON", () => {
      const { container } = render(
        <PricingTiersGrid tiers={TIERS} stripeTaxEnabled={true} paywallFrom="deep_link" />,
      );
      const text = container.textContent ?? "";
      expect(text).toContain("charged today and automatically renews");
      expect(text).toContain("Cancel anytime in");
      expect(text).toContain("account settings");
      expect(text).toContain("7-day refund policy");
    });

    it("still carries the renewal + cancel + refund elements with the flag OFF", () => {
      const { container } = render(
        <PricingTiersGrid tiers={TIERS} stripeTaxEnabled={false} paywallFrom="deep_link" />,
      );
      const text = container.textContent ?? "";
      expect(text).toContain("charged today and automatically renews");
      expect(text).toContain("Cancel anytime in");
      expect(text).toContain("account settings");
      expect(text).toContain("7-day refund policy");
    });

    // ENG-1285 — annual carries a real Stripe 7-day trial
    // (`trial_period_days: 7` on the checkout route), so the annual
    // disclosure must state the trial + Day-7 first charge and must
    // NOT claim "charged today". Monthly (above) stays trial-less.
    it("annual view: discloses the 7-day trial + Day-7 first charge, never 'charged today'", () => {
      const { container } = render(
        <PricingTiersGrid tiers={TIERS} stripeTaxEnabled={true} paywallFrom="deep_link" />,
      );
      const annualTab = Array.from(
        container.querySelectorAll('button[role="tab"]'),
      ).find((b) => b.textContent?.includes("Annual"));
      expect(annualTab, "Annual billing tab").toBeTruthy();
      fireEvent.click(annualTab!);

      const text = container.textContent ?? "";
      expect(text).toContain("7-day free trial");
      expect(text).toContain("no payment due today, first charge on Day 7");
      expect(text).toContain("Automatically renews each year until you cancel");
      expect(text).not.toContain("charged today");
      // Chip + disclosure must tell the same story on the same card.
      expect(text).toContain("No payment due now — first charge on Day 7");
    });

    it("does not carry the retired '(billed in USD)' parenthetical on either branch", () => {
      // Round-3 briefly added this; STOPPED before ship. Guard against
      // reintroduction in either flag state.
      for (const flag of [true, false]) {
        const { container } = render(
          <PricingTiersGrid tiers={TIERS} stripeTaxEnabled={flag} paywallFrom="deep_link" />,
        );
        const text = container.textContent ?? "";
        expect(text, `flag=${flag}`).not.toContain("billed in USD");
      }
    });
  });
});

describe("landing page — forbidden marketing claims", () => {
  const FORBIDDEN_CLAIMS = [
    // Retired: "400+ sources" — we don't have a curated source list
    "400+",
    "400 recipe sites",
    // Retired: Android as a shipping platform — not on the roadmap
    "iOS, Android, web",
    "Android, iOS",
    // Retired: voice control in cook mode — the real cook mode
    // doesn't ship voice navigation. Voice *logging* (tracker) is a
    // Pro feature and remains valid marketing.
    "voice control",
    // Retired: annual-plan prices — /pricing says "coming soon"
    "$50/year",
    "$120/year",
    // Retired: mock URL
    "app.suppr.co",
    // Retired: fabricated version label from an earlier draft
    "v1.4 · May 2026",
    // Retired: refund over-promise — refund is manual via Stripe
    "no questions asked",
    // Retired: imaginary perk — no monthly roadmap email exists
    "monthly roadmap email",
    // Retired: imaginary perk — we do not market CSV export
    "Export data (CSV)",
    // Retired: Android widget claim contradicts FAQ (Android not on roadmap)
    "iOS 18 + Android",
    // Retired: unsubstantiated SLO from an earlier draft
    "under five seconds",
    // Retired: promise of a perk that doesn't exist
    "direct support response",
    // Retired: "Creator analytics" promised but never built
    "creator analytics for published recipes going live",
  ];

  it.each(FORBIDDEN_CLAIMS)("does not claim %s", (claim) => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    expect(text.toLowerCase()).not.toContain(claim.toLowerCase());
  });
});
