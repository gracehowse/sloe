import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { PostLogSuggestionToast } from "./PostLogSuggestionToast";

const meta = {
  title: "Mobile/Today/PostLogSuggestionToast",
  component: PostLogSuggestionToast,
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
  args: { visible: true, line: "Logged chicken rice bowl", autoFadeMs: 6000, onDismiss: () => undefined },
} satisfies Meta<typeof PostLogSuggestionToast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Visible: Story = {};
export const Hidden: Story = { args: { visible: false } };
