import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecipeUnderlaySurface } from "./RecipeUnderlaySurface";

const meta = {
  title: "Suppr/RecipeUnderlaySurface",
  component: RecipeUnderlaySurface,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Client wrapper that paints the deterministic recipe underlay tint behind hero imagery.",
      },
    },
  },
  args: {
    id: "story-recipe-1",
    title: "Charred miso aubergine bowl",
    tags: ["Japanese", "vegan"],
    className: "flex h-48 w-80 items-center justify-center rounded-[24px]",
    children: (
      <span className="text-sm font-medium text-foreground/70">Underlay surface</span>
    ),
  },
} satisfies Meta<typeof RecipeUnderlaySurface>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CompactThumb: Story = {
  args: {
    id: "story-recipe-2",
    title: "Lemon herb chicken",
    className: "flex h-20 w-20 items-center justify-center rounded-xl",
    children: null,
  },
};
