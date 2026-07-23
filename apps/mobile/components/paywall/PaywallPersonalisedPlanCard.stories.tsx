import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PaywallPersonalisedPlanCard } from "./PaywallPersonalisedPlanCard";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Paywall/PaywallPersonalisedPlanCard",
  component: PaywallPersonalisedPlanCard,
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
  args: { targetCalories: 1500, proteinG: 120, goalLabel: "Lose steadily" },
} satisfies Meta<typeof PaywallPersonalisedPlanCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const Maintain: Story = { args: { goalLabel: "Maintain weight", targetCalories: 2100 } };
