import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { BrowseRow, LibraryRow } from "./LogSheetRows";

const noop = () => undefined;

const meta = {
  title: "Mobile/Today/LogSheetRows",
  component: LibraryRow,
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
} satisfies Meta<typeof LibraryRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LibraryRowStory: Story = {
  render: () => (
    <LibraryRow
      recipe={{
        id: "r1",
        title: "Spaghetti bolognese",
        kcalPerPortion: 780,
        thumbnail: null,
        mealTag: "Dinner",
      }}
      onPick={noop}
      slotName="Dinner"
    />
  ),
};

export const BrowseRowStory: Story = {
  render: () => (
    <BrowseRow
      title="Greek yogurt"
      kcal={120}
      source="manual"
      onPick={noop}
      slotName="Breakfast"
    />
  ),
};
