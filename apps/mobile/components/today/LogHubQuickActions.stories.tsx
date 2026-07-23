import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { LogHubQuickActions } from "./LogHubQuickActions";

const meta = {
  title: "Mobile/Today/LogHubQuickActions",
  component: LogHubQuickActions,
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
  args: { onLogUsual: () => undefined, onCopyYesterday: () => undefined, onDuplicateDay: () => undefined },
} satisfies Meta<typeof LogHubQuickActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllActions: Story = {};
export const LogUsualOnly: Story = { args: { onCopyYesterday: undefined, onDuplicateDay: undefined } };
