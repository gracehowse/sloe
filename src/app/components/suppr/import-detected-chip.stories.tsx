import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ImportDetectedChip } from "./import-detected-chip";

/**
 * ImportDetectedChip (ENG-1225 #3) — the unified Import wedge's "Detected: …"
 * cue, one chip per input kind the shared classifier recognises.
 */
const meta = {
  title: "Suppr/ImportDetectedChip",
  component: ImportDetectedChip,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start", width: 360, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ImportDetectedChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Instagram: Story = { args: { input: "https://www.instagram.com/reel/Cabc123/" } };
export const TikTok: Story = { args: { input: "https://vm.tiktok.com/ZMabc/" } };
export const YouTube: Story = { args: { input: "https://youtu.be/abc123" } };
export const RecipeLink: Story = { args: { input: "https://www.bbcgoodfood.com/recipes/lasagne" } };
export const NutritionCsv: Story = {
  args: { input: "Date,Meal,Food,Calories,Protein (g)\n2026-06-20,Breakfast,Oats,320,12\n2026-06-20,Lunch,Salad,440,38" },
};
export const MealPlan: Story = {
  args: { input: "Monday\nBreakfast: eggs\nLunch: salad\nTuesday\nDinner: salmon" },
};
export const RecipeText: Story = { args: { input: "Tahini bowl\n2 tbsp tahini\n1 can chickpeas" } };
export const Empty: Story = { name: "Empty (renders nothing)", args: { input: "" } };
