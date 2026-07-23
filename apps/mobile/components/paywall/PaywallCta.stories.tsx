import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PaywallCta } from "./PaywallCta";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Paywall/PaywallCta",
  component: PaywallCta,
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
  args: { loading: false, onPress: () => undefined, label: "Start free trial" },
} satisfies Meta<typeof PaywallCta>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const Loading: Story = { args: { loading: true } };
