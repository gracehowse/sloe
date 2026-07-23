import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressAverageAdherence } from "./ProgressAverageAdherence";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Progress/ProgressAverageAdherence",
  component: ProgressAverageAdherence,
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
  args: { adherencePct: 82, label: "This month" },
} satisfies Meta<typeof ProgressAverageAdherence>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const Low: Story = { args: { adherencePct: 54 } };
