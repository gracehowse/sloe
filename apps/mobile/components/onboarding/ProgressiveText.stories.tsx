import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import ProgressiveText from "./ProgressiveText";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Onboarding/ProgressiveText",
  component: ProgressiveText,
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
  args: { text: "Still reach your goals", style: { color: "#3B2A4D" } },
} satisfies Meta<typeof ProgressiveText>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const LongCopy: Story = { args: { text: "A calm plan for the week ahead." } };
