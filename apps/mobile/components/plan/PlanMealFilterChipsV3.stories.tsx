import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { PlanMealFilterChipsV3 } from "./PlanMealFilterChipsV3";

const meta = {
  title: "Mobile/Plan/PlanMealFilterChipsV3",
  component: PlanMealFilterChipsV3,
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
  args: { selected: "All", onSelect: () => undefined },
} satisfies Meta<typeof PlanMealFilterChipsV3>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllSelected: Story = {};
export const DinnerFilter: Story = { args: { selected: "Dinner" } };
