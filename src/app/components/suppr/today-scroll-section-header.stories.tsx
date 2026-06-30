import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TodayScrollSectionHeader } from "./today-scroll-section-header";

/**
 * TodayScrollSectionHeader — Sloe Today scroll section title (Newsreader
 * serif title + optional date subline, 20px before the first card). Parity:
 * `apps/mobile/components/today/TodayScrollSectionHeader.tsx`. Pins both copy
 * shapes so Chromatic guards them as a durable regression layer:
 *
 *   - With subtitle → title + long-date subline (scrolled section context).
 *   - Title only → used on full Today scroll where the hero shows the date.
 */
const meta = {
  title: "Suppr/TodayScrollSectionHeader",
  component: TodayScrollSectionHeader,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  args: {
    title: "Activity",
    subtitle: "Sunday, 21 June",
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TodayScrollSectionHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithSubtitle: Story = {
  name: "With date subtitle",
  args: { title: "Activity", subtitle: "Sunday, 21 June" },
};

export const TitleOnly: Story = {
  name: "Title only",
  args: { title: "Hydration & stimulants", subtitle: undefined },
};
