import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PaywallTrustStrip } from "./PaywallTrustStrip";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Paywall/PaywallTrustStrip",
  component: PaywallTrustStrip,
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
  
} satisfies Meta<typeof PaywallTrustStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const Minimal: Story = { args: { showRating: false } };
