/**
 * BarcodeShareOptIn (mobile) — the explicit community-contribution opt-in shown
 * after a not-found barcode is logged PRIVATELY (ENG-1247). Protects the legal-
 * reviewed posture (docs/decisions/2026-06-27-shared-food-db-contribution-opt-in.md):
 *  - the approved opt-in copy renders
 *  - "Keep it private" calls onDone and NEVER writes to the shared store
 *  - "Share it" submits to user_foods (submitFoodCorrection) and shows the honest
 *    "pending-until-verified" success card
 *  - a plausibility BLOCK hides the success card and surfaces the inline reasons
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

const submitFoodCorrection = vi.fn();
vi.mock("@/lib/verifyRecipe", () => ({
  submitFoodCorrection: (...args: unknown[]) => submitFoodCorrection(...args),
}));
// The component imports the real `@/lib/supabase`, which eagerly creates a
// Supabase client at module load — stub it so the suite doesn't throw
// "supabaseUrl is required" on import. The consent write is shared-module logic
// tested elsewhere; here it just needs to succeed so the share flow proceeds.
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
const setCommunityShareConsent = vi.fn(async () => ({ ok: true }));
vi.mock("@suppr/shared/foodCorrection/communityShareConsent", () => ({
  setCommunityShareConsent: (...args: unknown[]) => setCommunityShareConsent(...args),
}));
vi.mock("@/lib/supprWeb", () => ({ getSupprWebBase: () => "https://getsloe.com" }));
vi.mock("@/context/theme", () => ({
  useAccent: () => ({ primary: "#5B3B6E", primaryForeground: "#FFFFFF", success: "#5E7C5A" }),
}));

import { BarcodeShareOptIn } from "../../components/barcode/BarcodeShareOptIn";

const ENTRY = {
  barcode: "5012345678900",
  name: "Test cereal bar",
  calories: 200,
  protein: 10,
  carbs: 20,
  fat: 8,
};

describe("BarcodeShareOptIn", () => {
  beforeEach(() => submitFoodCorrection.mockReset());

  it("renders the legal-reviewed opt-in copy", () => {
    const { getByText } = render(<BarcodeShareOptIn entry={ENTRY} userId="u1" onDone={() => {}} />);
    expect(getByText(/Add this to Sloe.s shared food database/)).toBeTruthy();
    expect(getByText(/Nothing else from your account is shared/)).toBeTruthy();
    expect(getByText("✓ Logged to your tracker")).toBeTruthy();
    expect(getByText("Share it")).toBeTruthy();
    expect(getByText("Keep it private")).toBeTruthy();
  });

  it("'Keep it private' calls onDone and NEVER writes to the shared store", () => {
    const onDone = vi.fn();
    const { getByLabelText } = render(<BarcodeShareOptIn entry={ENTRY} userId="u1" onDone={onDone} />);
    fireEvent.press(getByLabelText("Keep it private"));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(submitFoodCorrection).not.toHaveBeenCalled();
  });

  it("'Share it' submits the entry to user_foods and shows the honest success card", async () => {
    submitFoodCorrection.mockResolvedValue({ ok: true });
    const { getByLabelText, findByText, getByText } = render(
      <BarcodeShareOptIn entry={ENTRY} userId="u1" onDone={() => {}} />,
    );
    fireEvent.press(getByLabelText("Share it"));
    // The share handler awaits the consent write before submitting, so wait for
    // the success card to appear before asserting the submission fired.
    expect(await findByText(/Saved .* thank you/)).toBeTruthy();
    expect(submitFoodCorrection).toHaveBeenCalledWith(
      expect.objectContaining({ barcode: ENTRY.barcode, name: ENTRY.name, calories: 200, userId: "u1" }),
    );
    // honest: pending-until-verified, not "everyone sees it now"
    expect(getByText(/it becomes the entry everyone sees/)).toBeTruthy();
  });

  it("a plausibility BLOCK hides the success card and shows the inline reasons", async () => {
    submitFoodCorrection.mockResolvedValue({
      ok: false,
      error: "plausibility_blocked",
      reasons: ["Calories look too high for these macros."],
    });
    const { getByLabelText, findByText, getByText, queryByText } = render(
      <BarcodeShareOptIn entry={ENTRY} userId="u1" onDone={() => {}} />,
    );
    fireEvent.press(getByLabelText("Share it"));
    expect(await findByText("These numbers look off")).toBeTruthy();
    expect(getByText(/Calories look too high/)).toBeTruthy();
    expect(queryByText(/Saved .* thank you/)).toBeNull();
  });
});
