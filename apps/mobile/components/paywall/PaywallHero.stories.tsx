import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PaywallHero } from "./PaywallHero";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Paywall/PaywallHero",
  component: PaywallHero,
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
  args: { headline: "Eat well. Stay on track.", subhead: "Recipes, logging, and progress in one calm app." },
} satisfies Meta<typeof PaywallHero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const ShortCopy: Story = { args: { subhead: undefined } };
