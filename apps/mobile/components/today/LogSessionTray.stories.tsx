import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { LogSessionTrayItem } from "@suppr/nutrition-core/logSessionTray";
const trayItem = (over: Partial<LogSessionTrayItem> = {}): LogSessionTrayItem => ({
  mealId: "m1", title: "Chicken breast", kcal: 165, protein: 31, carbs: 0, fat: 3.6, slot: "Lunch", kcalIsVerified: true, ...over,
});

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { LogSessionTray } from "./LogSessionTray";

const meta = {
  title: "Mobile/Today/LogSessionTray",
  component: LogSessionTray,
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
    items: [trayItem(), trayItem({ mealId: "m2", title: "Brown rice", kcal: 216, protein: 5, carbs: 45, fat: 1.8 })],
    pendingUndoIds: [],
    onUndo: noop,
    onDone: noop,
  },
} satisfies Meta<typeof LogSessionTray>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MultiItem: Story = {};
export const SingleItem: Story = { args: { items: [trayItem()] } };
