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

describe("UpgradePaywallDialog (PR-01 post-collapse, 2026-04-28)", () => {
  beforeEach(() => {
    trackCalls.length = 0;
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
    expect(renewal).toHaveTextContent(/Prices include any applicable VAT/i);
    expect(renewal).toHaveTextContent(/7-day refund policy/i);
    // ENG-1285: monthly stays trial-less — no trial claim on the
    // default (monthly) disclosure.
    expect(renewal).not.toHaveTextContent(/free trial/i);
    // PR-01: Base must not appear in the disclosure.
    expect(renewal).not.toHaveTextContent(/Suppr Base/i);
    expect(renewal).not.toHaveTextContent(/keep base/i);
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
