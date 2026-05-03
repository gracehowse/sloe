/**
 * AiPaywallDialog render + analytics test (Ship M2, 2026-04-18).
 *
 * The in-flow AI paywall dialog is the web counterpart of the new
 * mobile `AiPaywallSheet`. Both surfaces share `FEATURE_COPY` and the
 * three `ai_paywall_sheet_*` analytics events. These tests pin the
 * user-visible contract on the web side so a regression (wrong label,
 * wrong event name, missing event, double-fire on the "Not now" path)
 * fails CI before it ships.
 *
 * The mobile sheet cannot be rendered here (RN in jsdom) — mobile
 * structural parity is covered by
 * `apps/mobile/tests/unit/aiPaywallSheetShape.test.ts`.
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

// Import AFTER the mock so the dialog picks up the mocked track.
import { AiPaywallDialog } from "../../src/app/components/suppr/ai-paywall-dialog";

function Harness({
  initialOpen = true,
  feature = "voice_log" as "voice_log" | "photo_log",
}: {
  initialOpen?: boolean;
  feature?: "voice_log" | "photo_log";
}) {
  const [open, setOpen] = React.useState(initialOpen);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      <AiPaywallDialog open={open} onOpenChange={setOpen} feature={feature} />
    </>
  );
}

describe("AiPaywallDialog (Ship M2)", () => {
  beforeEach(() => {
    trackCalls.length = 0;
  });

  it("renders voice_log copy verbatim and the shared 'See Pro plans' primary CTA label", () => {
    render(<Harness feature="voice_log" />);
    expect(screen.getByText("Voice logging is a Pro feature")).toBeInTheDocument();
    expect(
      screen.getByText(/Describe what you ate, and we'll estimate macros/i),
    ).toBeInTheDocument();
    // M2 renamed "See plans" → "See Pro plans" to match the mobile sheet.
    const cta = screen.getByRole("link", { name: /See Pro plans/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute("href", "/pricing?from=voice_log");
    expect(screen.queryByRole("link", { name: /^See plans$/i })).not.toBeInTheDocument();
  });

  it("renders photo_log copy verbatim and routes the CTA to /pricing?from=photo_log", () => {
    // 2026-05-02 — copy updated to reference the user's just-experienced
    // free taster (5/week). The dialog now lands ONLY after exhaustion
    // (PhotoLogDialog calls onUpgradeRequired on 403). See
    // `docs/decisions/2026-05-02-photo-log-free-taster.md`.
    render(<Harness feature="photo_log" />);
    expect(screen.getByText("Get unlimited photo logs with Pro")).toBeInTheDocument();
    expect(
      screen.getByText(/You've used all 5 of your free photo logs this week/i),
    ).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: /See Pro plans/i });
    expect(cta).toHaveAttribute("href", "/pricing?from=photo_log");
  });

  it("fires ai_paywall_sheet_viewed exactly once on open with the correct feature", () => {
    render(<Harness feature="voice_log" />);
    const viewed = trackCalls.filter(
      (c) => c.event === "ai_paywall_sheet_viewed",
    );
    expect(viewed).toHaveLength(1);
    expect(viewed[0].payload).toEqual({ feature: "voice_log" });
  });

  it("fires ai_paywall_sheet_dismissed with reason=not_now when 'Not now' is clicked, and does NOT double-fire as backdrop", async () => {
    const user = userEvent.setup();
    render(<Harness feature="voice_log" />);
    await user.click(screen.getByRole("button", { name: /Not now/i }));

    const dismissed = trackCalls.filter(
      (c) => c.event === "ai_paywall_sheet_dismissed",
    );
    expect(dismissed).toHaveLength(1);
    expect(dismissed[0].payload).toEqual({
      feature: "voice_log",
      reason: "not_now",
    });
  });

  it("fires ai_paywall_sheet_dismissed with reason=backdrop on Escape key (Radix collapses overlay click / Escape / programmatic close)", async () => {
    render(<Harness feature="photo_log" />);
    // Sanity — the dialog mounted (2026-05-02 copy).
    expect(screen.getByText("Get unlimited photo logs with Pro")).toBeInTheDocument();
    // Escape on Radix dialog triggers onOpenChange(false) with no explicit reason.
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
      code: "Escape",
    });

    const dismissed = trackCalls.filter(
      (c) => c.event === "ai_paywall_sheet_dismissed",
    );
    expect(dismissed).toHaveLength(1);
    expect(dismissed[0].payload).toEqual({
      feature: "photo_log",
      reason: "backdrop",
    });
  });

  it("fires ai_paywall_sheet_cta_tapped with action=see_plans when the primary CTA is tapped", async () => {
    const user = userEvent.setup();
    render(<Harness feature="voice_log" />);
    // The CTA is an <a> with an href — userEvent's default click would
    // try to navigate jsdom. Using fireEvent.click keeps the test
    // focused on the analytics fire (the href presence is asserted
    // separately above).
    fireEvent.click(screen.getByRole("link", { name: /See Pro plans/i }));

    const cta = trackCalls.filter(
      (c) => c.event === "ai_paywall_sheet_cta_tapped",
    );
    expect(cta).toHaveLength(1);
    expect(cta[0].payload).toEqual({
      feature: "voice_log",
      action: "see_plans",
    });
    // Silence unused userEvent var (kept imported for parity with
    // sibling tests that follow the same pattern).
    void user;
  });

  it("re-opening after a close fires a fresh ai_paywall_sheet_viewed event (no StrictMode duplication)", async () => {
    const user = userEvent.setup();
    render(<Harness initialOpen={true} feature="voice_log" />);

    // First open — 1 view event.
    expect(
      trackCalls.filter((c) => c.event === "ai_paywall_sheet_viewed"),
    ).toHaveLength(1);

    // Close via Not now.
    await user.click(screen.getByRole("button", { name: /Not now/i }));
    // Re-open.
    await user.click(screen.getByRole("button", { name: /Open dialog/i }));

    // Second open — exactly 1 additional view event (total 2).
    expect(
      trackCalls.filter((c) => c.event === "ai_paywall_sheet_viewed"),
    ).toHaveLength(2);
  });
});
