import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MacroTotalGrid, type MacroTotalCell } from "./MacroTotalGrid";

const CELLS: MacroTotalCell[] = [
  { key: "protein", label: "Protein", grams: 41.2, cssVar: "var(--macro-protein)" },
  { key: "carbs", label: "Carbs", grams: 58, cssVar: "var(--macro-carbs)" },
  { key: "fat", label: "Fat", grams: 22.4, cssVar: "var(--macro-fat)" },
  { key: "fiber", label: "Fibre", grams: 9.1, cssVar: "var(--macro-fiber)" },
];

const meta = {
  title: "Suppr/MacroTotalGrid",
  component: MacroTotalGrid,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Four-cell macro summary grid for the meal-nutrition dialog — optional tap-through to macro breakdown.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    cells: CELLS,
  },
} satisfies Meta<typeof MacroTotalGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Static: Story = {};

export const Interactive: Story = {
  args: {
    onMacroTap: () => undefined,
  },
};
