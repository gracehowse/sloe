import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QuickLogButton } from "./quick-log-button";

const meta = {
  title: "Suppr/QuickLogButton",
  component: QuickLogButton,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Compact one-tap Log control for suggestion surfaces — ghost or on-image scrim.",
      },
    },
  },
} satisfies Meta<typeof QuickLogButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ghost: Story = {
  args: {
    appearance: "ghost",
    ariaLabel: "Log miso salmon bowl",
    onLog: () => undefined,
  },
};

export const OnImage: Story = {
  name: "On image (scrim)",
  args: {
    appearance: "onImage",
    ariaLabel: "Log miso salmon bowl",
    onLog: () => undefined,
  },
  decorators: [
    (Story) => (
      <div
        style={{
          padding: 24,
          borderRadius: 12,
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--primary) 40%, black), #1a1a1a)",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export const AsyncLog: Story = {
  name: "Async commit (spinner)",
  args: {
    appearance: "ghost",
    ariaLabel: "Log miso salmon bowl",
    onLog: () =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 2000);
      }),
  },
};
