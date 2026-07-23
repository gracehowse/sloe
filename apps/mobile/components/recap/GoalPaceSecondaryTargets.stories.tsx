import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { GoalPaceSecondaryTargets } from "./GoalPaceSecondaryTargets";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Recap/GoalPaceSecondaryTargets",
  component: GoalPaceSecondaryTargets,
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
  args: { proteinG: 120, carbsG: 150, fatG: 55 },
} satisfies Meta<typeof GoalPaceSecondaryTargets>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const HighProtein: Story = { args: { proteinG: 150 } };
