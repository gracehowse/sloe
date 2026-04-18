/**
 * TodayAddMealDialog render test (Post-ship #5 / C1a, 2026-04-18).
 *
 * Guards the rewire that deleted the inline USDA-only "search" tab in
 * favour of the shared `<FoodSearch>` component (which surfaces custom
 * foods at the top of results). The dialog now exposes only Recipe
 * and Manual tabs, plus a dedicated "Search foods" CTA that the host
 * wires to open `<FoodSearch>` standalone. This test protects:
 *
 *   - No "Search" tab button is rendered (the inline search UI is
 *     gone).
 *   - The "Search foods" CTA is present and fires `onOpenSearch` on
 *     click.
 *   - Recipe ↔ Manual tab switching still works.
 *   - Cancel fires `onOpenChange(false)`.
 *
 * Custom-food surfacing itself is covered end-to-end by the
 * `foodSearchFitThisIn.test.tsx` suite (FoodSearch component).
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  TodayAddMealDialog,
  type AddMealMode,
} from "../../src/app/components/suppr/today-add-meal-dialog";

// Ensure JSX runtime finds React under vitest/jsdom.
void React;

type HarnessProps = {
  onOpenSearch?: () => void;
  onSubmit?: () => void;
  onOpenChange?: (open: boolean) => void;
};

function Harness({ onOpenSearch, onSubmit, onOpenChange }: HarnessProps) {
  const [open, setOpen] = React.useState(true);
  const [addMode, setAddMode] = React.useState<AddMealMode>("recipe");
  const [mealSlot, setMealSlot] = React.useState("Breakfast");
  const [recipeId, setRecipeId] = React.useState("");
  const [recipePortionMultiplier, setRecipePortionMultiplier] = React.useState(1);
  const [manualName, setManualName] = React.useState("");
  const [manualCalories, setManualCalories] = React.useState(0);
  const [manualProtein, setManualProtein] = React.useState(0);
  const [manualCarbs, setManualCarbs] = React.useState(0);
  const [manualFat, setManualFat] = React.useState(0);
  const [manualFiber, setManualFiber] = React.useState(0);
  const [manualWater, setManualWater] = React.useState(0);
  const [timeLabel, setTimeLabel] = React.useState("12:00 PM");

  return (
    <TodayAddMealDialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange?.(o);
        setOpen(o);
      }}
      selectedDate={new Date("2026-04-18T12:00:00Z")}
      mealSlot={mealSlot}
      onMealSlotChange={setMealSlot}
      addMode={addMode}
      onAddModeChange={setAddMode}
      recipeId={recipeId}
      onRecipeIdChange={setRecipeId}
      recipeOptions={[]}
      savedRecipesEmpty
      recipePortionMultiplier={recipePortionMultiplier}
      onRecipePortionMultiplierChange={(next) =>
        setRecipePortionMultiplier(
          typeof next === "function"
            ? (next as (p: number) => number)(recipePortionMultiplier)
            : next,
        )
      }
      manualName={manualName}
      onManualNameChange={setManualName}
      manualCalories={manualCalories}
      onManualCaloriesChange={setManualCalories}
      manualProtein={manualProtein}
      onManualProteinChange={setManualProtein}
      manualCarbs={manualCarbs}
      onManualCarbsChange={setManualCarbs}
      manualFat={manualFat}
      onManualFatChange={setManualFat}
      manualFiber={manualFiber}
      onManualFiberChange={setManualFiber}
      manualWater={manualWater}
      onManualWaterChange={setManualWater}
      timeLabel={timeLabel}
      onTimeLabelChange={setTimeLabel}
      onSubmit={onSubmit ?? (() => {})}
      onOpenSearch={onOpenSearch ?? (() => {})}
    />
  );
}

describe("TodayAddMealDialog (C1a rewire)", () => {
  it("does not render the legacy inline 'Search' tab button", () => {
    render(<Harness />);
    // The old tab row was `[Recipe] [Manual food] [Search]`. After the
    // rewire the Search tab button is gone entirely — the only way to
    // search now is the dedicated CTA (tested below).
    const tabButtons = screen
      .getAllByRole("button")
      .filter((b) => /^(Recipe|Manual food|Search)$/.test(b.textContent?.trim() ?? ""));
    const labels = tabButtons.map((b) => b.textContent?.trim());
    expect(labels).toEqual(["Recipe", "Manual food"]);
  });

  it("fires `onOpenSearch` when the 'Search foods' CTA is clicked", async () => {
    const user = userEvent.setup();
    const onOpenSearch = vi.fn();
    render(<Harness onOpenSearch={onOpenSearch} />);

    // The CTA's aria-label names the three search sources so screen
    // readers explain the hand-off. The button text itself is a
    // shorter "Search foods (includes your custom foods)".
    const cta = screen.getByRole("button", {
      name: /Search foods including your custom foods/i,
    });
    await user.click(cta);

    expect(onOpenSearch).toHaveBeenCalledTimes(1);
  });

  it("lets the user switch between Recipe and Manual tabs", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // Default = Recipe. The manual-food Food name input only renders
    // under the Manual tab, so flipping tabs is observable.
    expect(screen.queryByPlaceholderText(/Greek yogurt with berries/i)).toBeNull();

    await user.click(screen.getByRole("button", { name: /^Manual food$/ }));
    expect(screen.getByPlaceholderText(/Greek yogurt with berries/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Recipe$/ }));
    expect(screen.queryByPlaceholderText(/Greek yogurt with berries/i)).toBeNull();
  });

  it("fires `onOpenChange(false)` when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: /^Cancel$/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
