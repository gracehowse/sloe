import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DiscoverRecipeImage } from "./discover-recipe-image";

const meta = {
  title: "Suppr/DiscoverRecipeImage",
  component: DiscoverRecipeImage,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Discover card hero/thumb — Next image when URL is valid, cuisine-tint fallback otherwise.",
      },
    },
  },
  args: {
    id: "recipe-miso-salmon",
    title: "Miso salmon bowl",
  },
} satisfies Meta<typeof DiscoverRecipeImage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HeroFallback: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export const HeroWithPhoto: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    image: "https://images.unsplash.com/photo-1467003909583-e00203781689?w=800&h=500&fit=crop",
  },
};

export const ThumbFallback: Story = {
  args: {
    variant: "thumb",
  },
};

export const InformativeAlt: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    decorative: false,
    image: "https://images.unsplash.com/photo-1467003909583-e00203781689?w=800&h=500&fit=crop",
  },
};
