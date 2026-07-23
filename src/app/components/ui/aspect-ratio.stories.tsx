import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AspectRatio } from "./aspect-ratio";

const meta = {
  component: AspectRatio,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Locks children to a fixed width:height ratio (Radix Aspect Ratio). Useful for recipe photos and media placeholders.",
      },
    },
  },
} satisfies Meta<typeof AspectRatio>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SixteenByNine: Story = {
  args: {
    ratio: 16 / 9,
    className: "w-full max-w-md overflow-hidden rounded-xl bg-muted",
    children: (
      <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
        16:9 media
      </div>
    ),
  },
};

export const Square: Story = {
  args: {
    ratio: 1,
    className: "w-48 overflow-hidden rounded-xl bg-muted",
    children: (
      <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
        1:1
      </div>
    ),
  },
};
