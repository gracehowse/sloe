import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { CountBadge } from "./CountBadge";
import { chromaticVisualContract } from "../../../../.storybook/chromaticVisualContract";

const meta = {
  title: "Mobile/UI/CountBadge",
  component: CountBadge,
  tags: ["autodocs", ...chromaticVisualContract.tags],
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
    ...chromaticVisualContract.parameters,
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Anatomy role **CountBadge** — tab/segment count pill. Shared by SubTabPill + SegmentedTrack so Shopping/Cookbook counts cannot drift. See `docs/design/2026-07-22-ui-anatomy-program.md`.",
      },
    },
  },
} satisfies Meta<typeof CountBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: { count: 3 },
};

export const Active: Story = {
  args: { count: 12, active: true },
};

export const Capped: Story = {
  args: { count: 1200, active: false },
};
