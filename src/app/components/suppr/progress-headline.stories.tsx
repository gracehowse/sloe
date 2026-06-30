import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressHeadline } from "./progress-headline";
import { generateProgressCommentary } from "../../../lib/nutrition/progressCommentary";

/**
 * ProgressHeadline — engine-led "THIS WEEK" story at the top of Progress
 * (Surface E, D-2026-04-27-17). Presentation-only: it renders a fully-resolved
 * `ProgressCommentaryResult`. Mirror: `apps/mobile/components/today/ProgressHeadline.tsx`.
 *
 * Fixtures run the REAL `generateProgressCommentary` so the copy + confidence
 * chip + highlighted numerals match production exactly. Pins all three regimes
 * so Chromatic guards them as a durable regression layer:
 *
 *   - steady      → medium/high confidence, maintenance held vs last week.
 *   - adjustment  → maintenance moved > 30 kcal vs last week.
 *   - calibrating → low confidence / no estimate yet (warm-up tone, Low chip).
 */
const steady = generateProgressCommentary({
  current: { tdee: 2180, confidence: "high", loggingDays: 24 },
  prevWeekTdee: 2185,
});

const adjustment = generateProgressCommentary({
  current: { tdee: 2310, confidence: "medium", loggingDays: 18 },
  prevWeekTdee: 2180,
  avgIntakeOnLossWeeksKcal: 1980,
});

const calibrating = generateProgressCommentary({
  current: { tdee: 2050, confidence: "low", loggingDays: 5 },
});

const meta = {
  title: "Suppr/ProgressHeadline",
  component: ProgressHeadline,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  args: { commentary: steady },
  decorators: [
    (Story) => (
      <div style={{ width: 380, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgressHeadline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Steady: Story = {
  name: "Steady (high confidence)",
  args: { commentary: steady },
};

export const Adjustment: Story = {
  name: "Adjustment (maintenance moved)",
  args: { commentary: adjustment },
};

export const Calibrating: Story = {
  name: "Calibrating (warming up)",
  args: { commentary: calibrating },
};
