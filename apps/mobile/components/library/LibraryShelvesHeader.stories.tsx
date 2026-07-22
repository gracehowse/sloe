import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame, MOCK_RECIPE } from "../_mobileStoryDecorators";
import { LibraryShelvesHeader } from "./LibraryShelvesHeader";

const library = [
  MOCK_RECIPE,
  { ...MOCK_RECIPE, id: "r2", title: "Overnight oats", calories: 380, protein: 14 },
  { ...MOCK_RECIPE, id: "r3", title: "Chicken tray bake", calories: 610, protein: 52 },
  { ...MOCK_RECIPE, id: "r4", title: "Greek salad", calories: 290, protein: 12 },
];

const meta = {
  title: "Mobile/Library/LibraryShelvesHeader",
  component: LibraryShelvesHeader,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof LibraryShelvesHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllFilter: Story = {
  args: { filtered: library, category: "all", onPressRecipe: () => undefined },
};

export const HiddenOnCategory: Story = {
  args: { filtered: library, category: "dinner", onPressRecipe: () => undefined },
};
