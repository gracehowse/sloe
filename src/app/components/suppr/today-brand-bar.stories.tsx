import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TodayBrandBar } from "./today-brand-bar";

const meta = {
  title: "Suppr/TodayBrandBar",
  component: TodayBrandBar,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 390, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TodayBrandBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSpacing: Story = {
  args: { className: "mb-4" },
};
