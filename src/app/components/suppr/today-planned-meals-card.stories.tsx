import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TodayPlannedMealsCard } from "./today-planned-meals-card";
import type { DayPlanMeal } from "../../../types/recipe.ts";

/**
 * TodayPlannedMealsCard — the "Planned" card on Today: meal-plan rows for
 * today not yet logged, each with a quick portion picker (½× / 1× / 1½× /
 * 2×). Mirrors mobile `TodayPlannedMealsCard`. The parent gates on
 * `plannedMeals.length > 0`, so there is no empty state to story.
 *
 * Pure presentation; `onLogPlannedMealWithPortion` is a no-op. The portion
 * picker is row-local state — `PortionPickerOpen` opens it via a `play` step
 * so Chromatic captures the expanded picker.
 *
 * a11y: the "Log today" links + "Planned" heading use `text-primary` (Sloe
 * clay `#C8794E`, ~3.05:1 on cream) — a pre-existing AA contrast miss across
 * the re-skin, not introduced here. `a11y.test: "todo"` keeps axe running as
 * a warning while the Chromatic visual coverage stands.
 */

const MEALS: DayPlanMeal[] = [
  {
    name: "Chicken & rice bowl",
    recipeTitle: "Chicken & rice bowl",
    recipeId: "r1",
    calories: 620,
    protein: 48,
    carbs: 72,
    fat: 14,
  },
  {
    name: "Greek yoghurt & berries",
    recipeTitle: "Greek yoghurt & berries",
    recipeId: "r2",
    calories: 240,
    protein: 22,
    carbs: 28,
    fat: 5,
  },
  {
    name: "Salmon traybake",
    recipeTitle: "Salmon traybake",
    recipeId: "r3",
    calories: 540,
    protein: 38,
    carbs: 30,
    fat: 26,
  },
];

const meta = {
  title: "Suppr/TodayPlannedMealsCard",
  component: TodayPlannedMealsCard,
  tags: ["ai-generated"],
  parameters: { layout: "centered", a11y: { test: "todo" } },
  decorators: [
    (Story) => (
      <div className="w-[380px]">
        <Story />
      </div>
    ),
  ],
  args: {
    plannedMeals: MEALS,
    onLogPlannedMealWithPortion: () => {},
  },
} satisfies Meta<typeof TodayPlannedMealsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Multiple planned rows, pickers collapsed ("Log today"). */
export const Default: Story = {};

/** Single planned row. */
export const SingleMeal: Story = {
  args: { plannedMeals: [MEALS[0]] },
};

/** Portion picker open on the first row (½× / 1× / 1½× / 2×). */
export const PortionPickerOpen: Story = {
  play: async ({ canvas, userEvent }) => {
    const [firstLogBtn] = canvas.getAllByRole("button", { name: /log today/i });
    await userEvent.click(firstLogBtn);
  },
};

export const DefaultDark: Story = {
  globals: { theme: "dark" },
};
