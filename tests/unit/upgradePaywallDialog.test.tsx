/**
 * UpgradePaywallDialog render + analytics test (Claude Design 2026-04-20).
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
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

void React;

type TrackCall = { event: string; payload?: Record<string, unknown> };
const trackCalls: TrackCall[] = [];

vi.mock("../../src/lib/analytics/track.ts", () => ({
  track: (event: string, payload?: Record<string, unknown>) => {
    trackCalls.push({ event, payload });
  },
}));

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

import { UpgradePaywallDialog } from "../../src/app/components/suppr/upgrade-paywall-dialog";

function Harness({
  initialOpen = true,
  userTier = "free",
  from = "meal_planner",
  bypassSessionCap = true,
}: {
  initialOpen?: boolean;
  userTier?: "free" | "base" | "pro";
  from?: React.ComponentProps<typeof UpgradePaywallDialog>["from"];
  bypassSessionCap?: boolean;
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
      />
    </>
  );
}

describe("UpgradePaywallDialog (Claude Design 2026-04-20)", () => {
  beforeEach(() => {
    trackCalls.length = 0;
    try {
      window.sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });

  it("renders the hero pitch, five feature rows, and a 'Most popular' Base pricing card", () => {
    render(<Harness />);
    // "The full meal planning loop" intentionally renders twice — once
    // in the hero title and once in the pricing card's tagline — so
    // we assert via the heading role for the hero copy specifically.
    expect(
      screen.getByRole("heading", { name: /The full meal planning loop/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Plans that hit your macros\. Shopping list from your plan/i),
    ).toBeInTheDocument();

    // The five Base-tier feature rows, verbatim from the prototype.
    expect(
      screen.getByText("Meal plans matched to your macros"),
    ).toBeInTheDocument();
    expect(screen.getByText("Shopping list from your plan")).toBeInTheDocument();
    expect(screen.getByText("Cook mode with timers")).toBeInTheDocument();
    expect(screen.getByText("Import from any source")).toBeInTheDocument();
    expect(screen.getByText("Unlimited saved recipes")).toBeInTheDocument();

    // Pricing card.
    expect(screen.getByText("Most popular")).toBeInTheDocument();
    // The primary CTA label carries the live tier price (pulled from
    // PRICING_TIERS — region-aware per CLAUDE.md). We assert only
    // the "Continue with Base · " prefix here so this test doesn't
    // break the day the tier price changes; a separate pricing-SSOT
    // test pins the exact value.
    expect(
      screen.getByRole("button", { name: /Continue with Base · /i }),
    ).toBeInTheDocument();
  });

  it("fires paywall_viewed exactly once on open with the `from` attribution", () => {
    render(<Harness />);
    const viewed = trackCalls.filter((c) => c.event === "paywall_viewed");
    expect(viewed).toHaveLength(1);
    expect(viewed[0].payload).toEqual({
      from: "meal_planner",
      tier: "base",
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
    expect(screen.queryByText("The full meal planning loop")).not.toBeInTheDocument();
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

  // --------------------------------------------------------------------
  // D12 (2026-04-21) — dynamic tier-aware upsell additions.
  // --------------------------------------------------------------------

  it("fires upsell_variant_shown alongside paywall_viewed for Variant A (free)", () => {
    render(<Harness userTier="free" />);
    const shown = trackCalls.filter((c) => c.event === "upsell_variant_shown");
    expect(shown).toHaveLength(1);
    expect(shown[0].payload).toEqual({
      variant: "free_to_base",
      from: "meal_planner",
      surface: "upgrade_dialog",
      platform: "web",
      user_tier: "free",
    });
    // Legacy event still fires alongside.
    expect(trackCalls.filter((c) => c.event === "paywall_viewed")).toHaveLength(1);
  });

  it("renders Variant B (Base → Pro) copy, CTAs, and locked renewal note for base users", () => {
    render(<Harness userTier="base" from="settings" />);
    expect(
      screen.getByRole("heading", { name: /Log faster\. Let the AI do the work\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText("AI photo meal recognition")).toBeInTheDocument();
    expect(screen.getByText("Voice food logging")).toBeInTheDocument();
    expect(screen.getByText("Everything in Base")).toBeInTheDocument();
    expect(screen.getByText("Priority email support")).toBeInTheDocument();
    // Base/pro should be labelled correctly, not "Most popular".
    expect(screen.queryByText("Most popular")).not.toBeInTheDocument();
    // Primary CTA is the Pro upgrade, not Base.
    expect(
      screen.getByRole("button", { name: /Upgrade to Pro · /i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Stay on Base$/i })).toBeInTheDocument();
    // T24 (full-sweep 2026-04-24): full CMA disclosure replaces the
    // previous one-line note. The "You keep Base if you downgrade"
    // line is FALSE per docs/decisions/2026-04-21-pro-downgrade-path.md
    // and must still not appear.
    const renewal = screen.getByTestId("upsell-renewal-note");
    expect(renewal).toHaveTextContent(
      /Suppr Pro renews automatically at .* per month until cancelled\./i,
    );
    expect(renewal).toHaveTextContent(/Cancel anytime/i);
    expect(renewal).toHaveTextContent(/refund policy/i);
    expect(renewal).not.toHaveTextContent(/keep base/i);
  });

  it("fires upsell_variant_shown with variant=base_to_pro for base users", () => {
    render(<Harness userTier="base" from="voice_log" />);
    const shown = trackCalls.filter((c) => c.event === "upsell_variant_shown");
    expect(shown).toHaveLength(1);
    expect(shown[0].payload).toEqual({
      variant: "base_to_pro",
      from: "voice_log",
      surface: "upgrade_dialog",
      platform: "web",
      user_tier: "base",
    });
  });

  it("Variant B 'Stay on Base' fires upsell_variant_dismissed with reason=secondary_cta", async () => {
    const user = userEvent.setup();
    render(<Harness userTier="base" from="settings" />);
    await user.click(screen.getByRole("button", { name: /^Stay on Base$/i }));

    const dismissed = trackCalls.filter(
      (c) => c.event === "upsell_variant_dismissed",
    );
    expect(dismissed).toHaveLength(1);
    expect(dismissed[0].payload).toEqual({
      variant: "base_to_pro",
      from: "settings",
      reason: "secondary_cta",
      surface: "upgrade_dialog",
      platform: "web",
      user_tier: "base",
    });
    // Legacy paywall_dismissed still fires alongside (reason mapped to
    // `continue_free` for dashboard continuity).
    const legacy = trackCalls.filter((c) => c.event === "paywall_dismissed");
    expect(legacy).toHaveLength(1);
    expect(legacy[0].payload).toEqual({ from: "settings", reason: "continue_free" });
  });

  it("Pro users render nothing — the dialog has no next tier to pitch", () => {
    render(<Harness userTier="pro" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // And no analytics emits at all.
    expect(trackCalls).toHaveLength(0);
  });

  it("Free user on a Pro-gated trigger surface sees Variant A with the pro-gated note", () => {
    render(<Harness userTier="free" from="voice_log" />);
    // Still Variant A — Base must be pitched before Pro.
    expect(
      screen.getByRole("heading", { name: /The full meal planning loop/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Voice and photo logging require Pro\. Base unlocks everything else\./i,
      ),
    ).toBeInTheDocument();
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

  it("T24: tapping Annual swaps the price + period across CTA, card, and disclosure", async () => {
    const user = userEvent.setup();
    render(<Harness userTier="free" />);

    await user.click(screen.getByTestId("upsell-period-annual"));

    // CTA renews to per-year and shows the annual price.
    expect(
      screen.getByRole("button", { name: /Continue with Base · £29\.99\/year/i }),
    ).toBeInTheDocument();

    // Disclosure now reads "per year" + alt monthly equivalence line.
    const renewal = screen.getByTestId("upsell-renewal-note");
    expect(renewal).toHaveTextContent(/per year/i);
    expect(renewal).toHaveTextContent(/until cancelled/i);
    expect(renewal).toHaveTextContent(/£3\.99 per month on the monthly plan/i);
  });

  it("T24: full CMA disclosure includes renews-until-cancelled, cancel path, refund policy", () => {
    render(<Harness userTier="free" />);
    const renewal = screen.getByTestId("upsell-renewal-note");
    expect(renewal).toHaveTextContent(
      /Suppr Base renews automatically at .* per month until cancelled\./i,
    );
    expect(renewal).toHaveTextContent(/Cancel anytime from Account → Billing/i);
    expect(renewal).toHaveTextContent(/Prices include any applicable VAT/i);
    expect(renewal).toHaveTextContent(/7-day refund policy/i);
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
