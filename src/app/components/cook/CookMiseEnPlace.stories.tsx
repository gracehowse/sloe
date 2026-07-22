import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CookMiseEnPlace } from "./CookMiseEnPlace";
import type { CookIngredientChecklistItem } from "./CookIngredientChecklist";

const SAMPLE_ITEMS: CookIngredientChecklistItem[] = [
  { name: "Spaghetti", amountLabel: "400 g" },
  { name: "Eggs", amountLabel: "4 large" },
  { name: "Pecorino", amountLabel: "100 g, finely grated" },
  { name: "Black pepper", amountLabel: "freshly cracked" },
];

const meta = {
  title: "Host/Cook/CookMiseEnPlace",
  component: CookMiseEnPlace,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          'Pre-step "Gather your ingredients" screen before cook-mode steps — checklist + Start cooking CTA.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="min-h-[640px] bg-background">
        <Story />
      </div>
    ),
  ],
  args: {
    recipeId: "storybook-carbonara",
    recipeTitle: "Weeknight carbonara",
    items: SAMPLE_ITEMS,
    onContinueToSteps: () => undefined,
  },
} satisfies Meta<typeof CookMiseEnPlace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutTitle: Story = {
  name: "Without recipe title",
  args: {
    recipeTitle: undefined,
  },
};
