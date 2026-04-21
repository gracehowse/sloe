/**
 * /pricing promo-code expander — D9 W1+W2 (2026-04-21).
 *
 * Pins:
 *  1. Collapsed-by-default — trigger visible, input + Apply not yet.
 *  2. Expanding reveals input + Apply.
 *  3. Success branches (fresh + already-redeemed) call `toast.success`.
 *  4. Error branches map each `RedeemPromoResult.error` to its expected
 *     copy via `toast.error` — including `not_authenticated` →
 *     "Sign in to redeem a code." per OD3 (public /pricing route).
 *  5. Source-level check: the old "Redeem it in Settings" footnote is
 *     gone from `app/pricing/page.tsx` (task W2).
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

void React;

const redeemPromoCode = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("../../src/context/AppDataContext.tsx", () => ({
  useAppData: () => ({ redeemPromoCode }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import { PromoCodeBlock } from "../../app/pricing/PromoCodeBlock.tsx";

describe("PromoCodeBlock (D9 W1)", () => {
  beforeEach(() => {
    redeemPromoCode.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("is collapsed by default — input and Apply are not rendered", () => {
    render(<PromoCodeBlock />);
    expect(screen.getByRole("button", { name: /have a promo code/i })).toBeTruthy();
    expect(screen.queryByLabelText(/promo code/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /^apply$/i })).toBeNull();
  });

  it("expands to reveal the input and Apply button when toggled", () => {
    render(<PromoCodeBlock />);
    fireEvent.click(screen.getByRole("button", { name: /have a promo code/i }));
    expect(screen.getByLabelText(/promo code/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^apply$/i })).toBeTruthy();
  });

  it("shows a success toast when redemption succeeds", async () => {
    redeemPromoCode.mockResolvedValue({ ok: true, tier: "pro", alreadyRedeemed: false });
    render(<PromoCodeBlock />);
    fireEvent.click(screen.getByRole("button", { name: /have a promo code/i }));
    fireEvent.change(screen.getByLabelText(/promo code/i), { target: { value: "SUPPR_PRO" } });
    fireEvent.click(screen.getByRole("button", { name: /^apply$/i }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Plan updated: pro"));
    expect(redeemPromoCode).toHaveBeenCalledWith("SUPPR_PRO");
  });

  it("shows the already-redeemed success variant when the API flags it", async () => {
    redeemPromoCode.mockResolvedValue({ ok: true, tier: "pro", alreadyRedeemed: true });
    render(<PromoCodeBlock />);
    fireEvent.click(screen.getByRole("button", { name: /have a promo code/i }));
    fireEvent.change(screen.getByLabelText(/promo code/i), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: /^apply$/i }));
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        "Plan confirmed: pro (this code was already applied to your account).",
      ),
    );
  });

  it.each([
    ["not_authenticated", "Sign in to redeem a code."],
    ["invalid_or_expired", "That code is not valid or has expired."],
    ["already_redeemed", "You have already redeemed this code."],
    ["not_deployed", "Promo codes aren't available in this build yet."],
  ])("maps error branch %s to the expected toast copy", async (error, expected) => {
    redeemPromoCode.mockResolvedValue({ ok: false, error });
    render(<PromoCodeBlock />);
    fireEvent.click(screen.getByRole("button", { name: /have a promo code/i }));
    fireEvent.change(screen.getByLabelText(/promo code/i), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: /^apply$/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(expected));
  });
});

describe("/pricing page footnote removal (D9 W2)", () => {
  const SRC = readFileSync(join(process.cwd(), "app/pricing/page.tsx"), "utf8");

  it("no longer shows the 'Redeem it in Settings' footnote", () => {
    expect(SRC).not.toContain("Redeem it in");
    expect(SRC).not.toContain("/home?view=settings");
  });

  it("mounts the new <PromoCodeBlock /> instead", () => {
    expect(SRC).toContain("<PromoCodeBlock />");
  });
});
