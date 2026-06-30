import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TodayFirstMealEmptyState } from "./today-first-meal-empty-state";

/**
 * TodayFirstMealEmptyState — cold-start card under the calorie ring when the
 * user has logged 0 meals today and has no journal history. Mirrors mobile
 * `apps/mobile/components/today/TodayFirstMealEmptyState.tsx`. Pins the states
 * so Chromatic guards them as a durable regression layer:
 *
 *   - Brand-new account → supportive copy + the IG/TikTok recipe-paste tip.
 *   - Returning (not brand-new) → no tip, supportive copy only.
 *   - Tip dismissed → tip suppressed even for a brand-new account.
 */
const meta = {
  title: "Suppr/TodayFirstMealEmptyState",
  component: TodayFirstMealEmptyState,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  args: {
    onLogMeal: () => {},
    onDismissTip: () => {},
    isBrandNew: true,
    tipDismissed: false,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TodayFirstMealEmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BrandNewWithTip: Story = {
  name: "Brand new (with paste tip)",
  args: { isBrandNew: true, tipDismissed: false },
};

export const Returning: Story = {
  name: "Returning (no tip)",
  args: { isBrandNew: false, tipDismissed: false },
};

export const TipDismissed: Story = {
  name: "Brand new, tip dismissed",
  args: { isBrandNew: true, tipDismissed: true },
};
