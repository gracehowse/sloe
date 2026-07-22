import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";

import { LogSheetDescribeFlow } from "./log-sheet-describe-flow";
import type { AiLoggedItem } from "../../../lib/nutrition/aiLogging";

const PARSED_ITEMS: AiLoggedItem[] = [
  {
    name: "Scrambled eggs",
    unit: "2 large",
    calories: 180,
    protein: 12,
    carbs: 2,
    fat: 14,
    confidence: 0.82,
    source: "voice",
  },
  {
    name: "Sourdough toast",
    unit: "1 slice",
    calories: 95,
    protein: 3,
    carbs: 18,
    fat: 1,
    confidence: 0.45,
    source: "voice",
  },
];

const meta = {
  title: "Suppr/LogSheetDescribeFlow",
  component: LogSheetDescribeFlow,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Inline natural-language describe flow inside the web Log sheet.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, background: "var(--bg)" }}>
        <Story />
      </div>
    ),
  ],
  args: {
    sheetOpen: true,
    onParse: async () => ({ ok: true as const, items: PARSED_ITEMS }),
    onCommit: () => undefined,
    collapsedEntryHidden: true,
    expandSignal: 1,
  },
} satisfies Meta<typeof LogSheetDescribeFlow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ExpandedInput: Story = {};

export const ProLocked: Story = {
  args: {
    locked: true,
    onPaywall: () => undefined,
  },
};

export const ReviewStage: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByTestId("log-sheet-describe-input");
    await userEvent.type(input, "2 eggs and toast");
    await userEvent.click(await canvas.findByTestId("log-sheet-describe-parse"));
    await canvas.findByTestId("log-sheet-describe-review");
  },
};
