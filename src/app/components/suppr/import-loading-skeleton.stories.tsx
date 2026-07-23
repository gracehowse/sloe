import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ImportLoadingSkeleton } from "./import-loading-skeleton";

const meta = {
  title: "Suppr/ImportLoadingSkeleton",
  component: ImportLoadingSkeleton,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Recipe URL import loading — skeleton silhouettes plus rotating status narration.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 480, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ImportLoadingSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Importing: Story = {
  args: { phase: "importing" },
};

export const CheckingClipboard: Story = {
  name: "Checking clipboard",
  args: { phase: "checking" },
};
