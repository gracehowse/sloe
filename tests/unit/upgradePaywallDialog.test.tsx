/**
 * UpgradePaywallDialog render + analytics test.
 *
 * Pins the user-visible contract + the canonical analytics payload
 * shapes for the web whole-paywall modal that replaces the old
 * navigate-to-/pricing flow for in-app "Upgrade" taps. Mirrors the
 * `AiPaywallDialog` test in structure: a lightweight harness + a mock
 * of the analytics `track()` so we can assert exact event names and
 * payload shapes.
 *
 * We mock the supabase client so the primary CTA's "start checkout"
 * path can be exercised without the real network + without pinning us
 * to a signed-in session.
 *
 * PR-01 (audit 2026-04-28): the dialog used to render two variants
 * (Free→Base "the full meal-planning loop" and Base→Pro "AI logging").
 * Base was removed from the SSOT per the 2026-04-27 strategic
 * direction; the dialog now renders a single Free→Pro upsell. The
 * Variant A / Variant B test cases have been merged into the new
 * Pro-only assertions.
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

void React;

type TrackCall = { event: string; payload?: Record<string, unknown> };
const trackCalls: TrackCall[] = [];

vi.mock("../../src/lib/analytics/track.ts", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/lib/analytics/track.ts")>();
  return {
    ...actual,
    track: (event: string, payload?: Record<string, unknown>) => {
      trackCalls.push({ event, payload });
    },
  };
});

// We don't exercise real Supabase in these tests — the checkout path
// below stops at the `getSession` call. Return no session so the
// dialog's fallback ("not logged in → redirect to /login") path fires
// instead of the `/api/stripe/checkout` network call.
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
    },
  }),
}));

// ENG-1441 — the dialog resolves `STRIPE_TAX_ENABLED` via
// `useStripeTaxEnabled()` (a fetch to `/api/stripe/tax-status`, see
// that hook's doc comment for why this is a fetch rather than a
// prop). Mocked directly so tests are synchronous/deterministic rather
// than racing a real fetch in jsdom; default `false` matches the real
// hook's fail-safe default and the pre-launch `.env.example` value.
const stripeTaxEnabledMock = vi.fn(() => false);
vi.mock("../../src/lib/stripe/useStripeTaxEnabled.ts", () => ({
  useStripeTaxEnabled: () => stripeTaxEnabledMock(),
}));

import { UpgradePaywallDialog } from "../../src/app/components/suppr/upgrade-paywall-dialog";

function Harness({
  initialOpen = true,
  userTier = "free",
  from = "meal_planner",
  bypassSessionCap = true,
  defaultPeriod,
}: {
  initialOpen?: boolean;
  userTier?: "free" | "base" | "pro";
  from?: React.ComponentProps<typeof UpgradePaywallDialog>["from"];
  bypassSessionCap?: boolean;
  defaultPeriod?: "monthly" | "annual";
}) {
  const [open, setOpen] = React.useState(initialOpen);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <UpgradePaywallDialog
        open={open}
        onOpenChange={setOpen}
        from={from}
        userTier={userTier}
        bypassSessionCap={bypassSessionCap}
        defaultPeriod={defaultPeriod}
      />
    </>
  );
}

/** ENG-1441 — deterministic client-side region for
 *  `detectRegionFromNavigatorLanguage()`, same rationale + pattern as
 *  `subscriptionCard.test.tsx` ("Deterministic region —
 *  navigator.language drives detectRegionClient"). */
function stubNavigatorLanguage(lang: string) {
  Object.defineProperty(window.navigator, "language", {
    value: lang,
    configurable: true,
  });
}

describe("UpgradePaywallDialog (PR-01 post-collapse, 2026-04-28)", () => {
  beforeEach(() => {
    trackCalls.length = 0;
    stripeTaxEnabledMock.mockReturnValue(false);
    // Default-region baseline for every test that doesn't override it —
    // matches the ENG-1441 default (`detectRegion`'s `defaultRegion`).
    stubNavigatorLanguage("en-US");
    try {
      window.sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });

  it("renders the Pro hero pitch, six feature rows, and the 'Most popular' Pro pricing card", () => {
    render(<Harness />);
    // Hero copy — Sloe Pro pitch (ENG-901, default-on).
    expect(
      screen.getByRole("heading", { name: /Cook what you love\.\s*Still reach your goals\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Snap a photo or say what you ate — Pro handles the rest/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Secure checkout")).toBeInTheDocument();

    // The six Pro feature rows — merged from prior Variant A + B.
    expect(screen.getByText("AI photo meal recognition")).toBeInTheDocument();
    expect(screen.getByText("Voice food logging")).toBeInTheDocument();
    expect(
      screen.getByText("Meal plans matched to your macros"),
    ).toBeInTheDocument();
    expect(screen.getByText("Shopping list from your plan")).toBeInTheDocument();
    expect(screen.getByText("Unlimited saved recipes")).toBeInTheDocument();
    expect(screen.getByText("Priority email support")).toBeInTheDocument();

    // Pricing card.
    expect(screen.getByText("Most popular")).toBeInTheDocument();
    // The primary CTA label carries the live tier price (pulled from
    // PRICING_TIERS — region-aware per CLAUDE.md). We assert only
    // the "Upgrade to Pro · " prefix here so this test doesn't break
    // the day the tier price changes; landingParity.test pins the
    // exact value.
    expect(
      screen.getByRole("button", { name: /Upgrade to Pro · /i }),
    ).toBeInTheDocument();
  });

  it("fires paywall_viewed exactly once on open with the `from` attribution and tier=pro", () => {
    render(<Harness />);
    const viewed = trackCalls.filter((c) => c.event === "paywall_viewed");
    expect(viewed).toHaveLength(1);
    expect(viewed[0].payload).toEqual({
      from: "meal_planner",
      tier: "pro",
      surface: "upgrade_dialog",
      platform: "web",
    });
  });

  it("'Continue for free' fires paywall_dismissed with reason=continue_free and closes", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /Continue for free/i }));

    const dismissed = trackCalls.filter((c) => c.event === "paywall_dismissed");
    expect(dismissed).toHaveLength(1);
    expect(dismissed[0].payload).toEqual({
      from: "meal_planner",
      reason: "continue_free",
    });
    // The hero title should be gone after close.
    expect(
      screen.queryByText(/Cook what you love\./i),
    ).not.toBeInTheDocument();
  });

  it("close X fires paywall_dismissed with reason=close_button", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /^Close$/i }));

    const dismissed = trackCalls.filter((c) => c.event === "paywall_dismissed");
    expect(dismissed).toHaveLength(1);
    expect(dismissed[0].payload).toEqual({
      from: "meal_planner",
      reason: "close_button",
    });
  });

  it("backdrop click fires paywall_dismissed with reason=backdrop", () => {
    render(<Harness />);
    // The outermost dialog div carries the click handler. Use the
    // accessible role `dialog` to grab it.
    const backdrop = screen.getByRole("dialog");
    fireEvent.click(backdrop);

    const dismissed = trackCalls.filter((c) => c.event === "paywall_dismissed");
    expect(dismissed).toHaveLength(1);
    expect(dismissed[0].payload).toEqual({
      from: "meal_planner",
      reason: "backdrop",
    });
  });

  it("StrictMode-safe: reopening fires a fresh paywall_viewed event", async () => {
    const user = userEvent.setup();
    render(<Harness initialOpen={true} />);
    expect(trackCalls.filter((c) => c.event === "paywall_viewed")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: /Continue for free/i }));
    await user.click(screen.getByRole("button", { name: /^Open$/i }));

    expect(trackCalls.filter((c) => c.event === "paywall_viewed")).toHaveLength(2);
  });

  it("fires upsell_variant_shown with variant=free_to_pro for free users (post-PR-01)", () => {
    render(<Harness userTier="free" />);
    const shown = trackCalls.filter((c) => c.event === "upsell_variant_shown");
    expect(shown).toHaveLength(1);
    expect(shown[0].payload).toEqual({
      variant: "free_to_pro",
      from: "meal_planner",
      surface: "upgrade_dialog",
      platform: "web",
      user_tier: "free",
    });
    // Legacy event still fires alongside.
    expect(trackCalls.filter((c) => c.event === "paywall_viewed")).toHaveLength(1);
  });

  it("legacy 'base' tier users get the same Pro pitch (PR-01: no separate Variant B)", () => {
    render(<Harness userTier="base" from="settings" />);
    expect(
      screen.getByRole("heading", { name: /Cook what you love\.\s*Still reach your goals\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Upgrade to Pro · /i }),
    ).toBeInTheDocument();
    // The "Stay on Base" secondary CTA is gone — Base no longer
    // exists as a tier the user can stay on. Both Free and legacy
    // Base see "Continue for free".
    expect(
      screen.getByRole("button", { name: /Continue for free/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Stay on Base/i)).not.toBeInTheDocument();
  });

  it("upsell_variant_shown emits variant=free_to_pro for legacy base users too", () => {
    render(<Harness userTier="base" from="voice_log" />);
    const shown = trackCalls.filter((c) => c.event === "upsell_variant_shown");
    expect(shown).toHaveLength(1);
    expect(shown[0].payload).toEqual({
      variant: "free_to_pro",
      from: "voice_log",
      surface: "upgrade_dialog",
      platform: "web",
      user_tier: "base",
    });
  });

  it("Pro users render nothing — the dialog has no next tier to pitch", () => {
    render(<Harness userTier="pro" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // And no analytics emits at all.
    expect(trackCalls).toHaveLength(0);
  });

  it("PR-01 (2026-04-28): Pro-gated trigger surface no longer shows the 'Voice/photo require Pro, Base unlocks the rest' note", () => {
    render(<Harness userTier="free" from="voice_log" />);
    expect(
      screen.getByRole("heading", { name: /Cook what you love\.\s*Still reach your goals\./i }),
    ).toBeInTheDocument();
    // The intermediate-step note is gone — Pro is the single tier
    // that unlocks voice and photo, plus everything else.
    expect(
      screen.queryByText(/Base unlocks everything else/i),
    ).not.toBeInTheDocument();
  });

  it("T24: defaults to monthly + renders the period toggle with annual savings badge", () => {
    render(<Harness userTier="free" />);
    const monthlyBtn = screen.getByTestId("upsell-period-monthly");
    const annualBtn = screen.getByTestId("upsell-period-annual");
    expect(monthlyBtn).toHaveAttribute("aria-selected", "true");
    expect(annualBtn).toHaveAttribute("aria-selected", "false");
    // Annual savings badge is visible without clicking.
    expect(annualBtn).toHaveTextContent(/Save 37%/i);
    // Monthly default — disclosure says "per month".
    expect(screen.getByTestId("upsell-renewal-note")).toHaveTextContent(
      /per month until cancelled/i,
    );
  });

  it("T24: tapping Annual swaps the price + period across CTA, card, and disclosure (Pro pricing)", async () => {
    const user = userEvent.setup();
    render(<Harness userTier="free" />);

    await user.click(screen.getByTestId("upsell-period-annual"));

    // CTA renews to per-year and shows the annual price.
    expect(
      screen.getByRole("button", { name: /Upgrade to Pro · £59\.99\/year/i }),
    ).toBeInTheDocument();

    // Disclosure now reads "per year" + alt monthly equivalence line.
    const renewal = screen.getByTestId("upsell-renewal-note");
    expect(renewal).toHaveTextContent(/per year/i);
    expect(renewal).toHaveTextContent(/until cancelled/i);
    expect(renewal).toHaveTextContent(/£7\.99 per month on the monthly plan/i);
    // ENG-1285: annual checkouts carry the Stripe 7-day trial, so the
    // annual disclosure leads with the trial + Day-7 first charge.
    expect(renewal).toHaveTextContent(
      /7-day free trial — no payment due today, first charge on Day 7/i,
    );
  });

  it("T24: full CMA disclosure includes renews-until-cancelled, cancel path, refund policy (Pro)", () => {
    render(<Harness userTier="free" />);
    const renewal = screen.getByTestId("upsell-renewal-note");
    expect(renewal).toHaveTextContent(
      /Pro renews automatically at .* per month until cancelled\./i,
    );
    expect(renewal).toHaveTextContent(/Cancel anytime from Account → Billing/i);
    // ENG-1441: default region (this test's `beforeEach` stubs
    // `navigator.language` to "en-US") + `STRIPE_TAX_ENABLED=false` (the
    // real default) must render the honest tax-EXCLUSIVE line, never
    // the unconditional "Prices include any applicable VAT." claim this
    // dialog used to hardcode regardless of region or the flag.
    expect(renewal).toHaveTextContent(/Price excludes any applicable taxes\./i);
    expect(renewal).not.toHaveTextContent(/Prices include any applicable VAT/i);
    expect(renewal).toHaveTextContent(/7-day refund policy/i);
    // ENG-1285: monthly stays trial-less — no trial claim on the
    // default (monthly) disclosure.
    expect(renewal).not.toHaveTextContent(/free trial/i);
    // PR-01: Base must not appear in the disclosure.
    expect(renewal).not.toHaveTextContent(/Suppr Base/i);
    expect(renewal).not.toHaveTextContent(/keep base/i);
  });

  // ENG-1441 (2026-07-21) — the dialog's tax clause used to be a
  // hardcoded, unconditional "Prices include any applicable VAT."
  // regardless of the visitor's region or whether Stripe Tax was even
  // active. Now mirrors `BillingDisclosure`'s `taxClause` branch exactly
  // (`app/pricing/BillingDisclosure.tsx`): UK/EU + flag-on wins outright,
  // otherwise the flag alone decides, default is the honest non-claim.
  describe("region + STRIPE_TAX_ENABLED tax clause (ENG-1441)", () => {
    it("UK region + flag ON: 'Prices include VAT.'", () => {
      stubNavigatorLanguage("en-GB");
      stripeTaxEnabledMock.mockReturnValue(true);
      render(<Harness userTier="free" />);
      const renewal = screen.getByTestId("upsell-renewal-note");
      expect(renewal).toHaveTextContent(/Prices include VAT\./i);
      expect(renewal).not.toHaveTextContent(/excludes any applicable taxes/i);
    });

    it("UK region + flag OFF: still the honest tax-exclusive line (no false VAT claim)", () => {
      stubNavigatorLanguage("en-GB");
      stripeTaxEnabledMock.mockReturnValue(false);
      render(<Harness userTier="free" />);
      const renewal = screen.getByTestId("upsell-renewal-note");
      expect(renewal).toHaveTextContent(/Price excludes any applicable taxes\./i);
      expect(renewal).not.toHaveTextContent(/Prices include VAT/i);
      expect(renewal).not.toHaveTextContent(/Price includes any applicable VAT/i);
    });

    it("EU region (de-DE) + flag ON: 'Prices include VAT.'", () => {
      stubNavigatorLanguage("de-DE");
      stripeTaxEnabledMock.mockReturnValue(true);
      render(<Harness userTier="free" />);
      const renewal = screen.getByTestId("upsell-renewal-note");
      expect(renewal).toHaveTextContent(/Prices include VAT\./i);
    });

    it("default region (en-US) + flag ON: the flag-only inclusive-VAT branch, not the UK/EU wording", () => {
      stubNavigatorLanguage("en-US");
      stripeTaxEnabledMock.mockReturnValue(true);
      render(<Harness userTier="free" />);
      const renewal = screen.getByTestId("upsell-renewal-note");
      // Mirrors BillingDisclosure exactly: outside UK/EU, the flag alone
      // decides and renders the generic "Price includes any applicable
      // VAT." (not the UK/EU-specific "Prices include VAT.").
      expect(renewal).toHaveTextContent(/Price includes any applicable VAT\./i);
    });

    it("default region (en-US) + flag OFF: tax-exclusive — the majority real-world state today", () => {
      stubNavigatorLanguage("en-US");
      stripeTaxEnabledMock.mockReturnValue(false);
      render(<Harness userTier="free" />);
      const renewal = screen.getByTestId("upsell-renewal-note");
      expect(renewal).toHaveTextContent(/Price excludes any applicable taxes\./i);
    });
  });

  it("ENG-1241: defaultPeriod='annual' (onboarding See Pro) preselects annual + leads with the 7-day trial", () => {
    // Decision 4 — the onboarding "See Pro" step opens the dialog with
    // the trial-eligible (annual) SKU preselected so the trial is the
    // offer the user sees, and the disclosure leads with the 7-day trial
    // (legal C1/C2). from="onboarding" attributes the funnel (legal C10).
    render(<Harness userTier="free" from="onboarding" defaultPeriod="annual" />);
    const monthlyBtn = screen.getByTestId("upsell-period-monthly");
    const annualBtn = screen.getByTestId("upsell-period-annual");
    expect(annualBtn).toHaveAttribute("aria-selected", "true");
    expect(monthlyBtn).toHaveAttribute("aria-selected", "false");
    // Annual disclosure leads with the trial (only shown when the trial
    // SKU is selected — legal C2).
    const renewal = screen.getByTestId("upsell-renewal-note");
    expect(renewal).toHaveTextContent(
      /7-day free trial — no payment due today, first charge on Day 7/i,
    );
    // paywall_viewed carries from=onboarding for skip-rate measurement.
    const viewed = trackCalls.filter((c) => c.event === "paywall_viewed");
    expect(viewed).toHaveLength(1);
    expect(viewed[0].payload).toMatchObject({ from: "onboarding" });
  });

  it("ENG-1241 legal C6: the AI photo feature says 'estimated macros', never 'verified macros'", () => {
    render(<Harness userTier="free" />);
    expect(
      screen.getByText(/Snap a plate and get estimated macros/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/verified macros/i)).not.toBeInTheDocument();
  });

  it("session cap suppresses a second auto-open but bypassSessionCap shows it", () => {
    // First open marks the session.
    const { unmount } = render(<Harness userTier="free" bypassSessionCap={false} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    unmount();

    // Second open without bypass — suppressed.
    const second = render(<Harness userTier="free" bypassSessionCap={false} />);
    expect(second.container.querySelector('[role="dialog"]')).toBeNull();
    second.unmount();

    // Third open WITH bypass — shown (explicit intent tap).
    render(<Harness userTier="free" bypassSessionCap={true} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
