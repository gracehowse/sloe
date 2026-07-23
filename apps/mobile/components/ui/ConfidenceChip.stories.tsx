import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { ConfidenceChip } from "./ConfidenceChip";

const meta = {
  title: "Mobile/UI/ConfidenceChip",
  component: ConfidenceChip,
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
          "Anatomy role **ConfidenceChip** — neutral grey TDEE confidence pill (low/medium/high). NOT a warning state; distinct from SearchResultConfidenceChip. See `docs/design/2026-07-22-ui-anatomy-program.md`.",
      },
    },
  },
} satisfies Meta<typeof ConfidenceChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Low: Story = {
  args: { level: "low" },
};

export const Medium: Story = {
  args: { level: "medium" },
};

export const High: Story = {
  args: { level: "high" },
};

export const CustomLabel: Story = {
  args: { level: "medium", label: "Confidence from last weigh-in" },
};
