import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { PlanMealSectionV3 } from "./PlanMealSectionV3";

const noop = () => undefined;

const meta = {
  title: "Mobile/Plan/PlanMealSectionV3",
  component: PlanMealSectionV3,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={{ width: 360, padding: 16, background: "#F7F6FA" }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: { layout: "fullscreen" },
  args: {
    plan: null,
    selectedDayIndex: 0,
    weekDates: [new Date("2026-06-16T12:00:00"), new Date("2026-06-17T12:00:00")],
    filter: "All",
    onOpenMeal: noop,
    onAddToSlot: noop,
  },
} satisfies Meta<typeof PlanMealSectionV3>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyPlan: Story = {};

export const LunchFilter: Story = { args: { filter: "Lunch" } };
