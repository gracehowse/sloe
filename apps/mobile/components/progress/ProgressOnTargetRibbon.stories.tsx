import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressOnTargetRibbon } from "./ProgressOnTargetRibbon";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Progress/ProgressOnTargetRibbon",
  component: ProgressOnTargetRibbon,
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
  args: { onTargetDays: 5, totalDays: 7 },
} satisfies Meta<typeof ProgressOnTargetRibbon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StrongWeek = {} as Story;
export const MixedWeek: Story = { args: { onTargetDays: 3 } };
