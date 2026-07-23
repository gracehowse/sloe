import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { WhereThisComesFromSheet } from "./WhereThisComesFromSheet";

const meta = {
  title: "Mobile/Today/WhereThisComesFromSheet",
  component: WhereThisComesFromSheet,
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
    visible: true,
    onClose: noop,
    headline: "492 kcal · Active 11 · Resting 481",
    source: "Apple Health",
    range: "Today, 00:00 – 14:32",
    lastSyncedAtMs: Date.now() - 3600000,
    footerExplainer: "Numbers update when Apple Health does.",
    primaryCta: { label: "Sync now", onPress: noop },
    backgroundColor: c.background,
    cardColor: c.card,
    cardBorderColor: c.border,
    textColor: c.text,
    textSecondaryColor: c.textSecondary,
    textTertiaryColor: c.textTertiary,
  },
} satisfies Meta<typeof WhereThisComesFromSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AppleHealth: Story = {};
export const ManualEstimate: Story = {
  args: { source: "Manual estimate", range: undefined, primaryCta: undefined },
};
