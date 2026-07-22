import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AllWeightDataSheet } from "./AllWeightDataSheet";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Progress/AllWeightDataSheet",
  component: AllWeightDataSheet,
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
  args: { visible: true, onClose: () => undefined, entries: [{ date: "2026-07-15", kg: 72.4 }] },
} satisfies Meta<typeof AllWeightDataSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open = {} as Story;
export const Empty: Story = { args: { entries: [] } };
