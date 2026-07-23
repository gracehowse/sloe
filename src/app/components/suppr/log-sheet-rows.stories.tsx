import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BrowseRow, LibraryRow } from "./log-sheet-rows";

const meta = {
  title: "Suppr/LogSheetRows",
  component: LibraryRow,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: "LogSheet browse and library rows with optional food thumbnails.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LibraryRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LibraryRowDefault: Story = {
  name: "Library row",
  args: {
    recipe: {
      id: "r_salmon_bowl",
      title: "Miso salmon rice bowl",
      kcalPerPortion: 642,
      mealTag: "Dinner",
    },
    slotName: "Dinner",
    onPick: () => undefined,
  },
};

export const BrowseRowDefault: Story = {
  name: "Browse row",
  args: {
    recipe: {
      id: "r_chicken",
      title: "Chicken breast, grilled",
      kcalPerPortion: 165,
      mealTag: "Lunch",
    },
    slotName: "Lunch",
    onPick: () => undefined,
  },
  render: () => (
    <BrowseRow
      title="Chicken breast, grilled"
      kcal={165}
      source="usda"
      slotName="Lunch"
      onPick={() => undefined}
    />
  ),
};
