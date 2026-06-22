import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ReportRecipeDialog } from "./report-recipe-dialog";

/**
 * ReportRecipeDialog — per-recipe "Report an issue" sheet (ENG-1225 #19).
 * Rendered open; `navigate` is stubbed so reason taps don't leave the story.
 */
const meta = {
  title: "Suppr/ReportRecipeDialog",
  component: ReportRecipeDialog,
  tags: ["ai-generated"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ReportRecipeDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    recipeId: "r_demo_123",
    recipeTitle: "Warm tahini grain bowl",
    navigate: (href: string) => console.log("navigate:", href),
  },
};
