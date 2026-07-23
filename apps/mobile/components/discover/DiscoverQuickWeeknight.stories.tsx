import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DiscoverQuickWeeknight } from "./DiscoverQuickWeeknight";
import { MOCK_RECIPE } from "../_mobileStoryDecorators";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Discover/DiscoverQuickWeeknight",
  component: DiscoverQuickWeeknight,
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
  args: { recipes: [MOCK_RECIPE], onPressRecipe: () => undefined },
} satisfies Meta<typeof DiscoverQuickWeeknight>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const FirstPlacement: Story = { args: { placement: "first" as const } };
