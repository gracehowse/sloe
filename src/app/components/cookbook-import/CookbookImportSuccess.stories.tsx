import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CookbookImportSuccess } from "./CookbookImportSuccess";

const meta = {
  title: "Suppr/CookbookImport/CookbookImportSuccess",
  component: CookbookImportSuccess,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    savedCount: 12,
    bookName: "Fast 800 Collection",
    partialSave: false,
    onViewLibrary: () => {},
    onBuildPlan: () => {},
  },
} satisfies Meta<typeof CookbookImportSuccess>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullSave: Story = {};

export const PartialSaveLimit: Story = {
  args: {
    savedCount: 3,
    partialSave: true,
  },
};
