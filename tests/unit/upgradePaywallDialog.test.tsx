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

function Harness({ initialOpen = true }: { initialOpen?: boolean }) {
  const [open, setOpen] = React.useState(initialOpen);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <UpgradePaywallDialog open={open} onOpenChange={setOpen} from="meal_planner" />
    </>
  );
}

describe("UpgradePaywallDialog (Claude Design 2026-04-20)", () => {
  beforeEach(() => {
    trackCalls.length = 0;
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
      screen.getByText(/Plans that hit your macros, one-tap shopping lists/i),
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
});
