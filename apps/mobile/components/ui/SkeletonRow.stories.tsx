import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { SkeletonCard, SkeletonRow } from "./SkeletonRow";

const meta = {
  title: "Mobile/UI/SkeletonRow",
  component: SkeletonRow,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={{ width: 360, padding: 16, background: "#F7F6FA" }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Loading silhouettes for meal rows and recipe cards — 700ms shimmer (static under reduce-motion).",
      },
    },
  },
} satisfies Meta<typeof SkeletonRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Row: Story = {};

export const RowSingleLine: Story = {
  args: { lines: 1 },
};

export const RowNoThumb: Story = {
  args: { thumb: false },
};

export const Card: Story = {
  render: () => <SkeletonCard />,
};

export const CardNoHero: Story = {
  render: () => <SkeletonCard hero={false} lines={3} />,
};
