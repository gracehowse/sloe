import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DiscoverImportCard } from "./discover-import-card";

const meta = {
  title: "Suppr/DiscoverImportCard",
  component: DiscoverImportCard,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile1" },
    docs: {
      description: {
        component:
          "Mobile-web Discover import slab — viral-hook CTA to paste or share a recipe link.",
      },
    },
  },
  args: {
    onOpenImport: () => undefined,
  },
} satisfies Meta<typeof DiscoverImportCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OnDiscoverBackground: Story = {
  decorators: [
    (Story) => (
      <div style={{ background: "var(--background)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
};