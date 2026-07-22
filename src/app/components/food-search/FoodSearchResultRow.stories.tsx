import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FoodSearchResultRow } from "./FoodSearchResultRow";
import { STORY_OFF_SEARCH_RESULT, STORY_USDA_SEARCH_RESULT } from "./_storyFixtures";

const noop = () => {};

const meta = {
  title: "Suppr/FoodSearch/FoodSearchResultRow",
  component: FoodSearchResultRow,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    item: STORY_USDA_SEARCH_RESULT,
    loadingKey: null,
    menuOpenFor: null,
    onPick: noop,
    onQuickLog: noop,
    onToggleMenu: noop,
    onEditCustom: noop,
    onDeleteCustom: noop,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420, border: "1px solid var(--border)", borderRadius: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FoodSearchResultRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const VerifiedUsdaRow: Story = {};

export const EstimatedOffRow: Story = {
  args: {
    item: STORY_OFF_SEARCH_RESULT,
  },
};

export const LoadingRow: Story = {
  args: {
    loadingKey: STORY_USDA_SEARCH_RESULT.key,
  },
};
