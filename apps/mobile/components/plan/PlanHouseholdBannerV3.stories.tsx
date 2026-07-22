import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { PlanHouseholdBannerV3 } from "./PlanHouseholdBannerV3";

const noop = () => undefined;

const meta = {
  title: "Mobile/Plan/PlanHouseholdBannerV3",
  component: PlanHouseholdBannerV3,
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
  args: {
    members: [
      { initial: "G", isOwner: true },
      { initial: "A", isOwner: false },
    ],
    servingCount: 2,
    names: "Grace, Alex",
    mismatchEaters: null,
    onPress: noop,
  },
} satisfies Meta<typeof PlanHouseholdBannerV3>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MatchedHousehold: Story = {};

export const ServingMismatch: Story = { args: { mismatchEaters: 3, servingCount: 2 } };
