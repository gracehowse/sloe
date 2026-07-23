import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CookStepPageIndicator } from "./CookStepPageIndicator";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Cook/CookStepPageIndicator",
  component: CookStepPageIndicator,
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
  args: { currentIndex: 1, totalSteps: 5 },
} satisfies Meta<typeof CookStepPageIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MiddleStep = {} as Story;
export const LastStep: Story = { args: { currentIndex: 4 } };
