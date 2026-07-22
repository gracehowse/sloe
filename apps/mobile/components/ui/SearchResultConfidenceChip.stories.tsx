import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { SearchResultConfidenceChip } from "./SearchResultConfidenceChip";

const meta = {
  title: "Mobile/UI/SearchResultConfidenceChip",
  component: SearchResultConfidenceChip,
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
          "Search-result nutrition trust chip — Verified (structured) vs Estimated. Distinct from ConfidenceChip (TDEE low/medium/high). Callers must pass an honest tier.",
      },
    },
  },
} satisfies Meta<typeof SearchResultConfidenceChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Verified: Story = {
  args: { tier: "verified" },
};

export const Estimated: Story = {
  args: { tier: "estimated" },
};

export const WithSourceLabel: Story = {
  args: { tier: "verified", sourceLabel: "USDA" },
};
