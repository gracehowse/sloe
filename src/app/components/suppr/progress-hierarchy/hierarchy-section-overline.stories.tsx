import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { HierarchySectionOverline } from "./hierarchy-section-overline";

const meta = {
  title: "Suppr/ProgressHierarchy/HierarchySectionOverline",
  component: HierarchySectionOverline,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: "Shared overline treatment for the five hierarchy-v1 Progress sections.",
      },
    },
  },
} satisfies Meta<typeof HierarchySectionOverline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { label: "This week" },
};

export const ProSuffix: Story = {
  name: "Pro suffix",
  args: { label: "Body composition · Pro", testID: "hierarchy-overline-pro" },
};
