import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { PlanToolsV3 } from "./PlanToolsV3";

const noop = () => undefined;

const meta = {
  title: "Mobile/Plan/PlanToolsV3",
  component: PlanToolsV3,
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
    batchCookSubtitle: "4 portions · scale shopping",
    shoppingItemCount: 12,
    servingCount: 2,
    onOpenBatchCook: noop,
    onOpenShopping: noop,
  },
} satisfies Meta<typeof PlanToolsV3>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithItems: Story = {};

export const EmptyBasket: Story = { args: { shoppingItemCount: 0 } };
