/**
 * ENG-1642 — `SharedMealAcceptHost` (web accept flow for `/m/<token>` share
 * links / the signed-out resume rail).
 *
 * Mocks `useAppData` / `useAuthSession` / `next/navigation` / the Supabase
 * browser client / `mealShareClient` so the flow can be driven without a
 * live session or network. Pins:
 *
 *  (a) `?mealShare` is consumed once — `getMealShare` is called with the
 *      NORMALISED token (lowercase 32-hex, dashes stripped) even when the
 *      URL param arrives dashed/uppercase — and the dialog opens on "ok";
 *  (b) the signed-out pending-storage token is drained (read + erased) even
 *      when a `?mealShare` URL param is ALSO present — both get erased, and
 *      the URL param wins for which token is actually looked up;
 *  (c) expired / revoked / invalid each toast the exact canonical copy and
 *      never open the dialog;
 *  (d) the whole accept flow — lookup through confirm — never gates on the
 *      `meal_share_links_v1` flag, pinning that redemption is deliberately
 *      un-gated regardless of the create-side flag's state;
 *  (e) confirming calls `addLoggedMealForDate` once per item with source
 *      `"shared_meal"`, and the meal payload never carries an `eatenAt` key
 *      (ENG-1107 lesson — the recipient's row anchors purely on the chosen
 *      day key).
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

void React;

const {
  mockAddLoggedMealForDate,
  mockRouterReplace,
  mockGetMealShare,
  mockTakePendingMealShare,
  mockToastError,
  mockToastSuccess,
  mockTrack,
  mockIsFeatureEnabled,
} = vi.hoisted(() => ({
  mockAddLoggedMealForDate: vi.fn(),
  mockRouterReplace: vi.fn(),
  mockGetMealShare: vi.fn(),
  mockTakePendingMealShare: vi.fn(() => null as string | null),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockTrack: vi.fn(),
  // Always OFF for this whole suite — the accept flow under test must work
  // identically regardless, which is exactly finding (d)'s pin.
  mockIsFeatureEnabled: vi.fn(() => false),
}));

let searchParamsValue = new URLSearchParams();
const pathnameValue = "/home";

vi.mock("../../src/context/AppDataContext.tsx", () => ({
  useAppData: () => ({ addLoggedMealForDate: mockAddLoggedMealForDate }),
}));

vi.mock("../../src/context/AuthSessionContext.tsx", () => ({
  useAuthSession: () => ({ authedUserId: null }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockRouterReplace }),
  usePathname: () => pathnameValue,
  useSearchParams: () => searchParamsValue,
}));

vi.mock("../../src/lib/analytics/track.ts", () => ({
  track: mockTrack,
  isFeatureEnabled: mockIsFeatureEnabled,
}));

vi.mock("../../src/lib/supabase/browserClient.ts", () => ({
  supabase: { rpc: vi.fn() },
}));

vi.mock("../../src/lib/share/mealShareClient.ts", () => ({
  getMealShare: mockGetMealShare,
  takePendingMealShare: mockTakePendingMealShare,
  createMealShare: vi.fn(),
  revokeMealShare: vi.fn(),
  storePendingMealShare: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: mockToastError, success: mockToastSuccess },
}));

import { SharedMealAcceptHost } from "../../src/app/components/suppr/shared-meal-accept-host";
import type { MealSharePayload } from "../../src/lib/share/mealShareLink";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function okPayload(overrides: Partial<MealSharePayload> = {}): MealSharePayload {
  return {
    title: "Lunch on the go",
    mealSlot: "Lunch",
    items: [
      { recipeTitle: "Chicken salad", calories: 420, protein: 38, carbs: 20, fat: 18 },
    ],
    sharedBy: "Grace",
    createdAt: "2026-07-22T09:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  mockAddLoggedMealForDate.mockClear();
  mockRouterReplace.mockClear();
  mockGetMealShare.mockReset();
  mockTakePendingMealShare.mockReset();
  mockTakePendingMealShare.mockReturnValue(null);
  mockToastError.mockClear();
  mockToastSuccess.mockClear();
  mockTrack.mockClear();
  mockIsFeatureEnabled.mockClear();
  searchParamsValue = new URLSearchParams();
});

afterEach(() => {
  vi.clearAllMocks();
  mockIsFeatureEnabled.mockReturnValue(false);
});

describe("SharedMealAcceptHost — ?mealShare consumption", () => {
  it("normalises a dashed/uppercase URL token before calling getMealShare, and opens the dialog on ok", async () => {
    searchParamsValue = new URLSearchParams(
      "mealShare=A1B2-C3D4-A1B2-C3D4-A1B2-C3D4-A1B2-C3D4",
    );
    mockGetMealShare.mockResolvedValue({ status: "ok", payload: okPayload() });

    render(<SharedMealAcceptHost />);

    await screen.findByText("Add shared meal to your log");

    expect(mockGetMealShare).toHaveBeenCalledTimes(1);
    expect(mockGetMealShare).toHaveBeenCalledWith(
      expect.anything(),
      "a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4",
    );
    // The one-shot param is erased so a refresh/back can't replay it.
    expect(mockRouterReplace).toHaveBeenCalledWith("/home", { scroll: false });
  });

  it("consumes the URL param exactly once even if props/effects re-run", async () => {
    searchParamsValue = new URLSearchParams(
      "mealShare=a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4",
    );
    mockGetMealShare.mockResolvedValue({ status: "ok", payload: okPayload() });

    const { rerender } = render(<SharedMealAcceptHost />);
    await screen.findByText("Add shared meal to your log");
    rerender(<SharedMealAcceptHost />);

    await waitFor(() => expect(mockGetMealShare).toHaveBeenCalledTimes(1));
  });

  it("an unnormalisable token (wrong length) never calls getMealShare and toasts the invalid copy", async () => {
    searchParamsValue = new URLSearchParams("mealShare=notavalidtoken");

    render(<SharedMealAcceptHost />);

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith("This share link isn't valid"));
    expect(mockGetMealShare).not.toHaveBeenCalled();
  });
});

describe("SharedMealAcceptHost — signed-out pending-storage resume rail", () => {
  it("drains the pending token even when a ?mealShare URL param is ALSO present — both are erased, URL param wins", async () => {
    searchParamsValue = new URLSearchParams(
      "mealShare=a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4",
    );
    mockTakePendingMealShare.mockReturnValue("b2c3d4e5b2c3d4e5b2c3d4e5b2c3d4e5");
    mockGetMealShare.mockResolvedValue({ status: "ok", payload: okPayload() });

    render(<SharedMealAcceptHost />);

    await screen.findByText("Add shared meal to your log");

    // Storage read (and thus erased, per takePendingMealShare's own
    // read-then-clear contract) regardless of the URL param's presence.
    expect(mockTakePendingMealShare).toHaveBeenCalledTimes(1);
    // The URL token — not the pending one — is the one actually looked up.
    expect(mockGetMealShare).toHaveBeenCalledWith(
      expect.anything(),
      "a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4",
    );
    // The URL param is erased too (the query-string eraser fires).
    expect(mockRouterReplace).toHaveBeenCalledWith("/home", { scroll: false });
  });

  it("falls back to the pending token when no URL param is present", async () => {
    searchParamsValue = new URLSearchParams();
    mockTakePendingMealShare.mockReturnValue("b2c3d4e5b2c3d4e5b2c3d4e5b2c3d4e5");
    mockGetMealShare.mockResolvedValue({ status: "ok", payload: okPayload() });

    render(<SharedMealAcceptHost />);

    await screen.findByText("Add shared meal to your log");
    expect(mockGetMealShare).toHaveBeenCalledWith(
      expect.anything(),
      "b2c3d4e5b2c3d4e5b2c3d4e5b2c3d4e5",
    );
    // No URL param was consumed, so the query-string eraser never fires.
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it("does nothing when neither a URL param nor a pending token exists", async () => {
    searchParamsValue = new URLSearchParams();
    mockTakePendingMealShare.mockReturnValue(null);

    render(<SharedMealAcceptHost />);

    await waitFor(() => expect(mockTakePendingMealShare).toHaveBeenCalledTimes(1));
    expect(mockGetMealShare).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });
});

describe("SharedMealAcceptHost — expired/revoked/invalid toast copy (exact, no dialog)", () => {
  it.each([
    ["expired", "This share link has expired"],
    ["revoked", "This link was removed by its owner"],
    ["invalid", "This share link isn't valid"],
  ] as const)("status %s toasts exactly %s and never opens the dialog", async (status, copy) => {
    searchParamsValue = new URLSearchParams(
      "mealShare=a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4",
    );
    mockGetMealShare.mockResolvedValue({ status });

    render(<SharedMealAcceptHost />);

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(copy));
    expect(screen.queryByText("Add shared meal to your log")).toBeNull();
  });
});

describe("SharedMealAcceptHost — meal_share_links_v1 flag OFF (redemption deliberately ungated)", () => {
  it("completes lookup -> dialog -> confirm with the flag OFF, and never checks it anywhere in the path", async () => {
    searchParamsValue = new URLSearchParams(
      "mealShare=a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4",
    );
    mockGetMealShare.mockResolvedValue({ status: "ok", payload: okPayload() });
    const user = userEvent.setup();

    render(<SharedMealAcceptHost />);
    await screen.findByText("Add shared meal to your log");

    await user.click(screen.getByRole("button", { name: /add to my log/i }));

    expect(mockAddLoggedMealForDate).toHaveBeenCalledTimes(1);
    // isFeatureEnabled is never asked about the meal-share creation flag on
    // this recipient-side path — SharedMealAcceptHost's accept flow doesn't
    // read MEAL_SHARE_FLAG at all (only link CREATION does).
    expect(mockIsFeatureEnabled).not.toHaveBeenCalledWith("meal_share_links_v1");
  });
});

describe("SharedMealAcceptHost — confirm", () => {
  it("calls addLoggedMealForDate once per item with source 'shared_meal' and no eatenAt on the payload", async () => {
    searchParamsValue = new URLSearchParams(
      "mealShare=a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4",
    );
    mockGetMealShare.mockResolvedValue({
      status: "ok",
      payload: okPayload({
        items: [
          { recipeTitle: "Chicken salad", calories: 420, protein: 38, carbs: 20, fat: 18 },
          { recipeTitle: "Rice", calories: 200, protein: 4, carbs: 44, fat: 1 },
        ],
      }),
    });
    const user = userEvent.setup();

    render(<SharedMealAcceptHost />);
    await screen.findByText("Add shared meal to your log");

    await user.click(screen.getByRole("button", { name: /add to my log/i }));

    expect(mockAddLoggedMealForDate).toHaveBeenCalledTimes(2);
    for (const call of mockAddLoggedMealForDate.mock.calls) {
      const [dayKey, meal, source] = call;
      expect(DATE_KEY_RE.test(dayKey)).toBe(true);
      expect(source).toBe("shared_meal");
      expect("eatenAt" in meal).toBe(false);
    }
    expect(mockAddLoggedMealForDate.mock.calls[0]![1]).toMatchObject({
      recipeTitle: "Chicken salad",
      calories: 420,
    });
    expect(mockAddLoggedMealForDate.mock.calls[1]![1]).toMatchObject({
      recipeTitle: "Rice",
      calories: 200,
    });

    expect(mockToastSuccess).toHaveBeenCalledWith("Added to your log");
    expect(mockTrack).toHaveBeenCalledWith("shared_meal_logged", {
      surface: "web_accept_dialog",
      itemCount: 2,
      slot: expect.any(String),
    });
  });
});
