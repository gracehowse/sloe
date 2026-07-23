import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecipeHeroMetaRow } from "./RecipeHeroMetaRow";

const ingredients = [
  { name: "salmon fillet", amount: "2", unit: "" },
  { name: "miso paste", amount: "2", unit: "tbsp" },
  { name: "rice", amount: "1", unit: "cup" },
];

const meta = {
  title: "Suppr/Recipe/RecipeHeroMetaRow",
  component: RecipeHeroMetaRow,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    prepMin: 10,
    cookMin: 18,
    kcal: 520,
    servings: 4,
    baseServings: 4,
    ingredients,
    isPro: true,
    onUpgrade: () => {},
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420, padding: 16, borderRadius: 16, background: "var(--primary-deep)" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RecipeHeroMetaRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProWithCost: Story = {};

export const FreeLockedCost: Story = {
  args: { isPro: false },
};
