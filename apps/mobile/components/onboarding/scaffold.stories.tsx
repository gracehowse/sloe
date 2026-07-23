import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStepHeader } from "./scaffold";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Onboarding/scaffold",
  component: MobileStepHeader,
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
  args: { overline: "Step 3 of 12", title: "What's your goal?", subtitle: "We'll tailor calories and macros." },
} satisfies Meta<typeof MobileStepHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithSubtitle = {} as Story;
export const TitleOnly: Story = { args: { subtitle: undefined } };
