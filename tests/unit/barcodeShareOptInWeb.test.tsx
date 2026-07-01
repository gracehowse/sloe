// @vitest-environment jsdom
/**
 * BarcodeShareOptIn (web) — parity twin of the mobile opt-in (ENG-1247). Protects
 * the legal-reviewed posture: approved copy renders; "Keep it private" never calls
 * onShare; "Share it" shows the honest pending-until-verified card; a plausibility
 * BLOCK hides the success card and surfaces the reasons; the "How this is used"
 * link points at the disclosed policy anchor.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { BarcodeShareOptIn } from "../../src/app/components/suppr/BarcodeShareOptIn";

const track = vi.fn();
vi.mock("../../src/lib/analytics/track", () => ({
  track: (...args: unknown[]) => track(...args),
}));
vi.mock("../../src/lib/analytics/events", () => ({
  AnalyticsEvents: { food_contribution_opt_in: "food_contribution_opt_in" },
}));

void React;

describe("BarcodeShareOptIn (web)", () => {
  it("renders the legal-reviewed opt-in copy + the policy link", () => {
    render(<BarcodeShareOptIn onShare={async () => ({ ok: true })} onDone={() => {}} />);
    expect(screen.getByText(/Add this to Sloe.s shared food database/)).toBeTruthy();
    expect(screen.getByText(/Nothing else from your account is shared/)).toBeTruthy();
    expect(screen.getByText("Share it")).toBeTruthy();
    expect(screen.getByText("Keep it private")).toBeTruthy();
    const link = screen.getByText("How this is used").closest("a");
    expect(link?.getAttribute("href")).toBe("/privacy#community-food-database");
  });

  it("'Keep it private' calls onDone and NEVER calls onShare", () => {
    const onShare = vi.fn(async () => ({ ok: true }));
    const onDone = vi.fn();
    render(<BarcodeShareOptIn onShare={onShare} onDone={onDone} />);
    fireEvent.click(screen.getByLabelText("Keep it private"));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onShare).not.toHaveBeenCalled();
  });

  it("'Share it' calls onShare and shows the honest pending-until-verified card", async () => {
    const onShare = vi.fn(async () => ({ ok: true }));
    render(
      <BarcodeShareOptIn barcode="5012345678900" onShare={onShare} onDone={() => {}} />,
    );
    fireEvent.click(screen.getByLabelText("Share it"));
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Saved .* thank you/)).toBeTruthy();
    expect(screen.getByText(/it becomes the entry everyone sees/)).toBeTruthy();
    expect(track).toHaveBeenCalledWith("food_contribution_opt_in", {
      barcode: "5012345678900",
      policy_version: "2026-06-27",
    });
  });

  it("a plausibility BLOCK hides the success card and shows the inline reasons", async () => {
    const onShare = vi.fn(async () => ({
      ok: false,
      error: "plausibility_blocked",
      reasons: ["Calories look too high for these macros."],
    }));
    render(<BarcodeShareOptIn onShare={onShare} onDone={() => {}} />);
    fireEvent.click(screen.getByLabelText("Share it"));
    expect(await screen.findByText("These numbers look off")).toBeTruthy();
    expect(screen.getByText(/Calories look too high/)).toBeTruthy();
    expect(screen.queryByText(/Saved .* thank you/)).toBeNull();
  });
});
