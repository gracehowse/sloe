import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { GoalOptionList } from "./GoalPaceControls";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Recap/GoalPaceControls",
  component: GoalOptionList,
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
  args: { value: "cut", onChange: () => undefined },
} satisfies Meta<typeof GoalOptionList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Cut = {} as Story;
export const Bulk: Story = { args: { value: "bulk" } };
