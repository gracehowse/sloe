import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DeleteAccountSheet } from "./DeleteAccountSheet";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Settings/DeleteAccountSheet",
  component: DeleteAccountSheet,
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
  args: { visible: true, onClose: () => undefined, onConfirmDelete: () => undefined, loading: false },
} satisfies Meta<typeof DeleteAccountSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open = {} as Story;
export const Deleting: Story = { args: { loading: true } };
