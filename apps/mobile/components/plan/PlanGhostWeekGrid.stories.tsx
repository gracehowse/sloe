import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { PlanGhostWeekGrid } from "./PlanGhostWeekGrid";

const weekDates = Array.from({ length: 7 }, (_, i) => new Date(2026, 6, 20 + i));

const meta = {
  title: "Mobile/Plan/PlanGhostWeekGrid",
  component: PlanGhostWeekGrid,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The ghosted week rendered under PlanEmptyWeekCard when nothing is planned — the shape of what 'Generate this week' produces. Non-interactive by design; one image to assistive tech.",
      },
    },
  },
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={{ width: 360, padding: 16, background: "#F7F6FA" }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  args: { weekDates, slots: ["Breakfast", "Lunch", "Dinner"] },
} satisfies Meta<typeof PlanGhostWeekGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A four-slot plan (Snacks enabled) — the pills come from the plan's own
 *  slot count, not a hard-coded three. */
export const FourSlots: Story = {
  args: { slots: ["Breakfast", "Lunch", "Dinner", "Snacks"] },
};

export const DarkTheme: Story = {
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider scheme="dark">
        <div style={{ width: 360, padding: 16, background: "#1A1A1E" }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
};
