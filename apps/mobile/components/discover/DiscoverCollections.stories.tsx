import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DiscoverCollections } from "./DiscoverCollections";
import { MOCK_RECIPE } from "../_mobileStoryDecorators";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Discover/DiscoverCollections",
  component: DiscoverCollections,
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
  args: { recipes: [MOCK_RECIPE], onSelectCategory: () => undefined },
} satisfies Meta<typeof DiscoverCollections>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const EmptyFeed: Story = { args: { recipes: [] } };
