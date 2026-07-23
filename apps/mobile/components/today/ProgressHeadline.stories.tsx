import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { ProgressCommentaryResult } from "@/lib/progressCommentary";
const commentary: ProgressCommentaryResult = {
  eyebrow: "This week",
  headline: "You're building a steady rhythm",
  body: "You logged 5 of 7 days and averaged 1850 kcal — close to your 2000 kcal target.",
  numerals: [{ text: "5", start: 9, end: 10 }, { text: "1850", start: 38, end: 42 }],
  confidence: "high",
};

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { ProgressHeadline } from "./ProgressHeadline";

const meta = {
  title: "Mobile/Today/ProgressHeadline",
  component: ProgressHeadline,
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
  args: { commentary },
} satisfies Meta<typeof ProgressHeadline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HighConfidence: Story = {};
export const LowConfidence: Story = {
  args: { commentary: { ...commentary, confidence: "low", body: "Keep logging — your story unlocks after 3 days." } },
};
