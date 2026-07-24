import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressTabChrome } from "./progress-tab-chrome";

const meta = {
  title: "Suppr/ProgressTabChrome",
  component: ProgressTabChrome,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile1" },
    docs: {
      description: {
        component:
          "The Progress header — a thin wrapper over `ScreenChrome` so Progress cannot fork its own chrome. It forwards `scope`: `\"all\"` serves desktop too, which is what lets ProgressDashboard retire the two hand-rolled desktop header twins it used to carry; `\"mobile\"` is the legacy md:hidden path and the `design_consistency_v1` kill switch.",
      },
    },
  },
} satisfies Meta<typeof ProgressTabChrome>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    overline: "Your trends",
  },
};

export const WithSubtitle: Story = {
  args: {
    overline: "Your trends",
    subtitle: "Last 30 days",
  },
};

/**
 * `scope="all"` — the header serving desktop, static rather than sticky. This
 * is the composition that replaces ProgressDashboard's hand-rolled desktop
 * headers, so Progress reads as the same surface at every breakpoint.
 */
export const DesktopScope: Story = {
  args: {
    overline: "Your trends",
    subtitle: "Last 30 days",
    scope: "all",
  },
  parameters: { viewport: { defaultViewport: "responsive" } },
};
