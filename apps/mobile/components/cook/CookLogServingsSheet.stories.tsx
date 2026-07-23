import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CookLogServingsSheet } from "./CookLogServingsSheet";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Cook/CookLogServingsSheet",
  component: CookLogServingsSheet,
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
  args: { visible: true, batchScale: 1, baseServings: 4, onConfirm: () => undefined, onClose: () => undefined },
} satisfies Meta<typeof CookLogServingsSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open = {} as Story;
export const BatchDouble: Story = { args: { batchScale: 2 } };
