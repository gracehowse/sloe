import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CreatorProfileHeader } from "./CreatorProfileHeader";

const meta = {
  title: "Suppr/Creator/CreatorProfileHeader",
  component: CreatorProfileHeader,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    creator: {
      display_name: "Priya Patel",
      handle: "priyaeats",
      bio: "Whole-food recipes with honest macros — mostly plants, always flavour.",
      avatar_url: null,
      is_verified: true,
    },
  },
  decorators: [(Story) => <div style={{ maxWidth: 420 }}><Story /></div>],
} satisfies Meta<typeof CreatorProfileHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const V3LeftAligned: Story = {
  args: {
    creator: {
      display_name: "Priya Patel",
      handle: "priyaeats",
      bio: "Whole-food recipes with honest macros — mostly plants, always flavour.",
      avatar_url: null,
      is_verified: true,
    },
  },
};

export const WithoutBio: Story = {
  args: {
    creator: {
      display_name: "Alex Chen",
      handle: "alexchefs",
      bio: null,
      avatar_url: null,
      is_verified: false,
    },
  },
};
