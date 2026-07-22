import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CancelExportPromptSheet } from "./CancelExportPromptSheet";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Settings/CancelExportPromptSheet",
  component: CancelExportPromptSheet,
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
  args: { visible: true, onStay: () => undefined, onLeave: () => undefined },
} satisfies Meta<typeof CancelExportPromptSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open = {} as Story;
export const Hidden: Story = { args: { visible: false } };
