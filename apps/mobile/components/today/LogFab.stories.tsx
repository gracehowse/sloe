import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { LogFab } from "./LogFab";

const meta = {
  title: "Mobile/Today/LogFab",
  component: LogFab,
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
  args: { onPress: () => undefined, visible: true },
} satisfies Meta<typeof LogFab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Visible: Story = {};
export const Hidden: Story = { args: { visible: false } };
