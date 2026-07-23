import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ImportRecentImports } from "./import-recent-imports";

const meta = {
  title: "Suppr/ImportRecentImports",
  component: ImportRecentImports,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: "Recent imports list on the import idle surface.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ImportRecentImports>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithItems: Story = {
  args: {
    items: [
      { name: "One-pot lentil curry", source: "tiktok", time: "2 hours ago" },
      { name: "Sourdough focaccia", source: "instagram", time: "Yesterday" },
      { name: "Chicken shawarma bowl", source: "web", time: "Mon" },
    ],
  },
};

export const SingleItem: Story = {
  args: {
    items: [{ name: "Banana bread", source: "youtube", time: "Just now" }],
  },
};
