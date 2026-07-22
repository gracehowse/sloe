import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CookbookImportReviewRow } from "./CookbookImportReviewRow";
import { storyCookbookRecipe } from "./_storyFixtures";

const meta = {
  title: "Suppr/CookbookImport/CookbookImportReviewRow",
  component: CookbookImportReviewRow,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    item: storyCookbookRecipe("r1", "Miso-glazed salmon"),
    excluded: false,
    nutritionMode: "match",
    onToggle: () => {},
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CookbookImportReviewRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SelectedMatchMode: Story = {};

export const ExcludedAuthorMode: Story = {
  args: {
    excluded: true,
    nutritionMode: "author",
  },
};
