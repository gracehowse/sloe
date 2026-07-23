import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { PlanEmptySlotV3 } from "./PlanEmptySlotV3";

const meta = {
  title: "Mobile/Plan/PlanEmptySlotV3",
  component: PlanEmptySlotV3,
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
  args: { slot: "Dinner", onPress: () => undefined },
} satisfies Meta<typeof PlanEmptySlotV3>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dinner: Story = {};
export const Breakfast: Story = { args: { slot: "Breakfast" } };
