// @vitest-environment jsdom
/**
 * ENG-813 (Redesign — Design Direction 2026) — edit-entry + saved-meal
 * portion sheet polish.
 *
 * These two sheets are the surfaces the user touches most during the daily
 * loop. The redesign applies three things behind the redesign flags, with
 * the OLD path kept alive in the `else`:
 *   1. The element→sheet morph on open (`redesign_motion`) — the sheet panel
 *      springs in via `useSheetMorph`; the Modal's own slide is turned OFF
 *      when motion is on so the spring is the sole driver.
 *   2. Soft resting-card elevation (`design_system_elevation`, via
 *      `useCardElevation`) on the sheet's content cards — the saved-meal
 *      macro read-out card and the edit-entry inputs drop their hairline
 *      border for the tonal lift / soft shadow.
 *   3. A quiet log-confirm haptic on portion recalc + the commit CTA — the
 *      same Light-impact "confirm" feel everywhere a value is committed.
 *
 * Coverage:
 *   SavedMealPortionSheet
 *     - commit CTA fires `onConfirm(mult)` with the chosen multiplier
 *     - portion recalc (a chip tap) fires the quiet confirm haptic (motion on)
 *     - commit CTA fires the confirm haptic on tap (motion on)
 *     - motion OFF → no haptic on recalc; Modal keeps `animationType="slide"`
 *   TodayEditMealModal (V2)
 *     - Save CTA fires `onSave`
 *     - portion recalc fires the confirm haptic (motion on)
 *     - motion OFF → no haptic on recalc
 *
 * `useCardElevation` is mocked to a deterministic shape so the test doesn't
 * have to spin up the theme + flag stack just to exercise the sheet logic;
 * its own behaviour is covered by `elevationToken.test.ts` + SupprCard tests.
 */
import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

void React;

// ── shared mocks ────────────────────────────────────────────────────────────

vi.mock("expo-haptics", () => ({
  selectionAsync: vi.fn(async () => undefined),
  impactAsync: vi.fn(async () => undefined),
  notificationAsync: vi.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success" },
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#0f172a",
    textSecondary: "#475569",
    textTertiary: "#94a3b8",
    card: "#ffffff",
    cardElevated: "#F6F5F2",
    cardBorder: "#e4e4ec",
    border: "#e4e4ec",
    background: "#FBF8F3",
    inputBg: "#f0ece4",
  }),
}));

// Deterministic elevation shape — the flag-ON light path (soft shadow, no
// border). The hook's own dark/flag-off branching is covered elsewhere.
vi.mock("@/hooks/useCardElevation", () => ({
  useCardElevation: () => ({
    shadowStyle: { shadowColor: "#1c1916", shadowOpacity: 0.08, shadowRadius: 12 },
    useBorder: false,
    liftBg: undefined,
  }),
  CARD_HAIRLINE: 0.5,
}));

import { isFeatureEnabled } from "@/lib/analytics";
import { SavedMealPortionSheet } from "../../components/today/SavedMealPortionSheet";
import { TodayEditMealModal } from "../../components/today/TodayEditMealModal";
import type { SavedMeal } from "@suppr/nutrition-core/savedMeals";
import type { JournalMeal } from "../../lib/nutritionJournal";

const flagFn = isFeatureEnabled as unknown as ReturnType<typeof vi.fn>;

const SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

const SAVED_MEAL: SavedMeal = {
  id: "saved-1",
  name: "Peanut Butter Smoothie",
  defaultMealSlot: "Snacks",
  items: [
    {
      id: "i1",
      position: 0,
      name: "Smoothie",
      calories: 350,
      protein: 20,
      carbs: 30,
      fat: 14,
      portionMultiplier: 1,
    } as never,
  ],
  createdAt: "2026-05-01T00:00:00.000Z",
  lastLoggedAt: "2026-05-10T00:00:00.000Z",
  logCount: 3,
};

const EDITING_MEAL: JournalMeal = {
  id: "m1",
  name: "Chicken & Orzo",
  recipeTitle: "Chicken & Orzo",
  time: "12:30",
  calories: 540,
  protein: 38,
  carbs: 52,
  fat: 18,
};

async function haptics() {
  return import("expo-haptics");
}

beforeEach(() => {
  flagFn.mockReset();
  flagFn.mockReturnValue(false);
});

// ── SavedMealPortionSheet ────────────────────────────────────────────────────

describe("SavedMealPortionSheet — ENG-813 redesign", () => {
  function renderSheet(overrides?: Partial<React.ComponentProps<typeof SavedMealPortionSheet>>) {
    const onConfirm = vi.fn();
    const onChangeSlot = vi.fn();
    const onClose = vi.fn();
    const utils = render(
      <SavedMealPortionSheet
        meal={SAVED_MEAL}
        slot="Snacks"
        slots={SLOTS}
        onChangeSlot={onChangeSlot}
        onConfirm={onConfirm}
        onClose={onClose}
        {...overrides}
      />,
    );
    return { ...utils, onConfirm, onChangeSlot, onClose };
  }

  it("commit CTA fires onConfirm with the current multiplier", () => {
    flagFn.mockReturnValue(true); // redesign_motion on
    const { getByTestId, onConfirm } = renderSheet();
    fireEvent.press(getByTestId("saved-portion-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(1); // resets to 1× on open
  });

  it("portion recalc fires the quiet confirm haptic when motion is on", async () => {
    flagFn.mockReturnValue(true);
    const H = await haptics();
    (H.impactAsync as ReturnType<typeof vi.fn>).mockClear();
    const { getByTestId } = renderSheet();
    // Tap the 2× quick chip — a committed recalc, not a keystroke.
    fireEvent.press(getByTestId("saved-portion-chip-2"));
    expect(H.impactAsync).toHaveBeenCalledWith("medium");
  });

  it("commit CTA fires the confirm haptic on press-in when motion is on", async () => {
    flagFn.mockReturnValue(true);
    const H = await haptics();
    (H.impactAsync as ReturnType<typeof vi.fn>).mockClear();
    const { getByTestId } = renderSheet();
    fireEvent(getByTestId("saved-portion-confirm"), "pressIn");
    expect(H.impactAsync).toHaveBeenCalledWith("medium");
  });

  it("motion OFF — no haptic on recalc and onConfirm still works", async () => {
    flagFn.mockReturnValue(false);
    const H = await haptics();
    (H.impactAsync as ReturnType<typeof vi.fn>).mockClear();
    const { getByTestId, onConfirm } = renderSheet();
    fireEvent.press(getByTestId("saved-portion-chip-2"));
    expect(H.impactAsync).not.toHaveBeenCalled();
    fireEvent.press(getByTestId("saved-portion-confirm"));
    expect(onConfirm).toHaveBeenCalledWith(2);
  });
});

// ── TodayEditMealModal (V2) ──────────────────────────────────────────────────

describe("TodayEditMealModal V2 — ENG-813 redesign", () => {
  function renderModal(overrides?: Partial<React.ComponentProps<typeof TodayEditMealModal>>) {
    const onSave = vi.fn();
    const onDelete = vi.fn();
    const onClose = vi.fn();
    const onApplyPortionMultiplier = vi.fn();
    const noop = vi.fn();
    const utils = render(
      <TodayEditMealModal
        enabled
        editingMeal={EDITING_MEAL}
        slots={SLOTS}
        editSlot="Lunch"
        onEditSlotChange={noop}
        editPortion="1"
        onEditPortionChange={noop}
        onApplyPortionMultiplier={onApplyPortionMultiplier}
        editTitle="Chicken & Orzo"
        onEditTitleChange={noop}
        editKcal="540"
        onEditKcalChange={noop}
        editProtein="38"
        onEditProteinChange={noop}
        editCarbs="52"
        onEditCarbsChange={noop}
        editFat="18"
        onEditFatChange={noop}
        editEatenAtTime="12:30"
        onEditEatenAtTimeChange={noop}
        onSave={onSave}
        onDelete={onDelete}
        onClose={onClose}
        styles={{}}
        cardColor="#fff"
        borderColor="#e4e4ec"
        inputBgColor="#f0ece4"
        textColor="#0f172a"
        textSecondaryColor="#475569"
        textTertiaryColor="#94a3b8"
        {...overrides}
      />,
    );
    return { ...utils, onSave, onDelete, onApplyPortionMultiplier };
  }

  it("Save CTA fires onSave", () => {
    flagFn.mockReturnValue(true);
    const { getByLabelText, onSave } = renderModal();
    fireEvent.press(getByLabelText("Save changes"));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("portion recalc applies the multiplier and fires the confirm haptic when motion is on", async () => {
    flagFn.mockReturnValue(true);
    const H = await haptics();
    (H.impactAsync as ReturnType<typeof vi.fn>).mockClear();
    const { getByTestId, onApplyPortionMultiplier } = renderModal();
    fireEvent.press(getByTestId("edit-entry-portion-chip-2"));
    expect(onApplyPortionMultiplier).toHaveBeenCalledWith(2);
    // ENG-1342 — portion commit routes through useHaptics().confirm() (Medium).
    expect(H.impactAsync).toHaveBeenCalledWith("medium");
  });

  it("motion OFF — recalc still applies but fires no haptic", async () => {
    flagFn.mockReturnValue(false);
    const H = await haptics();
    (H.impactAsync as ReturnType<typeof vi.fn>).mockClear();
    const { getByTestId, onApplyPortionMultiplier } = renderModal();
    fireEvent.press(getByTestId("edit-entry-portion-chip-2"));
    expect(onApplyPortionMultiplier).toHaveBeenCalledWith(2);
    expect(H.impactAsync).not.toHaveBeenCalled();
  });

  // ENG-1247 — the serif kcal hero + protein/carbs/fat triple. Grace's scope:
  // adopt the prototype's calories-headline hierarchy but KEEP every value a
  // direct input (never regress to display-only tiles). This guards that the
  // four nutrition fields render and that editing any of them stays wired.
  it("renders all four nutrition fields and keeps every value editable", () => {
    flagFn.mockReturnValue(true);
    const onEditKcalChange = vi.fn();
    const onEditProteinChange = vi.fn();
    const onEditCarbsChange = vi.fn();
    const onEditFatChange = vi.fn();
    const { getByLabelText } = renderModal({
      onEditKcalChange,
      onEditProteinChange,
      onEditCarbsChange,
      onEditFatChange,
    });
    // The kcal hero shows the current value and is still a real input.
    expect(getByLabelText("Calories").props.value).toBe("540");
    expect(getByLabelText("Protein").props.value).toBe("38");
    expect(getByLabelText("Carbs").props.value).toBe("52");
    expect(getByLabelText("Fat").props.value).toBe("18");
    fireEvent.changeText(getByLabelText("Calories"), "600");
    expect(onEditKcalChange).toHaveBeenCalledWith("600");
    fireEvent.changeText(getByLabelText("Protein"), "40");
    expect(onEditProteinChange).toHaveBeenCalledWith("40");
  });
});
