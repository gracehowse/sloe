import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { LoggedConfirmation } from "./LogSheetConfirmation";

const meta = {
  title: "Mobile/Today/LogSheetConfirmation",
  component: LoggedConfirmation,
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
  args: {
    confirmation: {
      title: "Greek yogurt",
      kcal: 120,
      kcalIsVerified: true,
      slot: "Breakfast",
      source: "manual",
      onDone: noop,
      onUndo: noop,
    },
  },
} satisfies Meta<typeof LoggedConfirmation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithUndo: Story = {};
export const DoneOnly: Story = {
  args: { confirmation: { title: "Avocado toast", kcal: 285, kcalIsVerified: false, slot: "Lunch", source: "manual", onDone: noop } },
};
