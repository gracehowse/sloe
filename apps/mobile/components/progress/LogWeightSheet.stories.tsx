import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LogWeightSheet } from "./LogWeightSheet";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Progress/LogWeightSheet",
  component: LogWeightSheet,
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
  args: { visible: true, onClose: () => undefined, onSave: () => undefined, initialKg: 72.4 },
} satisfies Meta<typeof LogWeightSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open = {} as Story;
export const Imperial: Story = { args: { isImperial: true } };
