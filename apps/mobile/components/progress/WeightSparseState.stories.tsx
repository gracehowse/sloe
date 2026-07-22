import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WeightSparseState } from "./WeightSparseState";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Progress/WeightSparseState",
  component: WeightSparseState,
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
  parameters: { layout: "fullscreen" },
  args: { points: 2, goalKg: 68, onLogWeight: () => undefined },
} satisfies Meta<typeof WeightSparseState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sparse = {} as Story;
export const NoGoal: Story = { args: { goalKg: null } };
