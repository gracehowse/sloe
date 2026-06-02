// @vitest-environment jsdom
/**
 * `meal-nutrition` screen (mobile) — ENG-825 header + empty/error
 * unification with its macro-detail sibling.
 *
 * Before: the single-meal mode drove the NATIVE stack header via
 * `navigation.setOptions` (Ionicons back chevron + header-right "Edit"),
 * while the slot-aggregate mode used `PushScreenHeader` (lucide). The
 * error / no-slot states hand-rolled their own centred Ionicon + plain
 * "Go back" Pressable. Two header systems, two icon sets, two CTA
 * treatments across two sibling screens.
 *
 * After: every mode renders `PushScreenHeader`, and the error / no-slot
 * states render the shared `NutritionDetailEmptyState` card (lucide icon,
 * blue scale-press CTA). This test pins:
 *   1. The "missing meal" error path renders the shared error state
 *      (`meal-nutrition-error`) — i.e. the old Ionicons error layout is
 *      gone — with a "Go back" CTA wired to safe-back.
 *   2. The screen no longer touches the native navigation header
 *      (`useNavigation` is not imported / called).
 */
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import MealNutritionScreen from "../../app/meal-nutrition";

void React;

const backSpy = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn(() => ({})) })) },
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({ session: { user: { id: "test-user-id" } } }),
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));

vi.mock("@/hooks/use-safe-back", () => ({
  useSafeBack: () => backSpy,
}));

// No `id` / `slot` / `date` params → the "Missing meal" error branch.
vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), navigate: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useLocalSearchParams: () => ({}),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock("expo-haptics", () => ({
  selectionAsync: vi.fn(async () => undefined),
  impactAsync: vi.fn(async () => undefined),
  notificationAsync: vi.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success" },
}));

// `useNavigation` must NOT be reachable — if the screen still imported it
// from expo-router this mock would have to provide it. Its absence above
// (and the lack of a crash) is part of the guarantee.

afterEach(() => {
  backSpy.mockReset();
});

describe("meal-nutrition unified header / shared error state (mobile)", () => {
  it("renders the shared error empty-state for a missing meal", async () => {
    const { findByTestId, queryByText } = render(<MealNutritionScreen />);
    // The shared component renders this testID; the OLD Ionicons error
    // layout did not.
    expect(await findByTestId("meal-nutrition-error")).toBeTruthy();
    expect(queryByText("Meal not found")).toBeTruthy();
    expect(queryByText("Go back")).toBeTruthy();
  });

  it("the Go back CTA fires safe-back", async () => {
    const { findByLabelText } = render(<MealNutritionScreen />);
    const cta = await findByLabelText("Go back");
    fireEvent.press(cta);
    expect(backSpy).toHaveBeenCalledTimes(1);
  });
});
