import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PaywallComparison } from "./PaywallComparison";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Paywall/PaywallComparison",
  component: PaywallComparison,
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
  
} satisfies Meta<typeof PaywallComparison>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const DarkTheme: Story = { decorators: [(Story) => (<MobileStoryThemeProvider scheme="dark"><div style={{ width: 360, padding: 16, background: "#1A1A1E" }}><Story /></div></MobileStoryThemeProvider>)] };
