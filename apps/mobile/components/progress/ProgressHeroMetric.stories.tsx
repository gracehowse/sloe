import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressHeroMetric } from "./ProgressHeroMetric";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Progress/ProgressHeroMetric",
  component: ProgressHeroMetric,
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
  args: { label: "Weight", value: "72.4 kg", delta: "-0.4 kg", trend: "down" },
} satisfies Meta<typeof ProgressHeroMetric>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Losing = {} as Story;
export const Flat: Story = { args: { delta: "0.0 kg", trend: "flat" } };
