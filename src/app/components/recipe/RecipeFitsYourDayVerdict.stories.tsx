import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { computeFitsYourDayVerdict } from "@/lib/recipe/recipeDetailLayout";
import { RecipeFitsYourDayVerdict } from "./RecipeFitsYourDayVerdict";

const fitsVerdict = computeFitsYourDayVerdict({ kcal: 420, targetCals: 1850 })!;
const tightVerdict = computeFitsYourDayVerdict({ kcal: 920, targetCals: 1850 })!;
const overVerdict = computeFitsYourDayVerdict({ kcal: 1900, targetCals: 1850 })!;

const meta = {
  title: "Suppr/Recipe/RecipeFitsYourDayVerdict",
  component: RecipeFitsYourDayVerdict,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    verdict: fitsVerdict,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RecipeFitsYourDayVerdict>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FitsYourDay: Story = {};

export const TightFit: Story = {
  args: { verdict: tightVerdict },
};

export const OverDailyTarget: Story = {
  args: { verdict: overVerdict },
};
