import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DiscoverMoreIdeaRow } from "./DiscoverMoreIdeaRow";
import { MOCK_RECIPE } from "../_mobileStoryDecorators";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Discover/DiscoverMoreIdeaRow",
  component: DiscoverMoreIdeaRow,
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
  args: { item: MOCK_RECIPE, idx: 0, onPress: () => undefined },
} satisfies Meta<typeof DiscoverMoreIdeaRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const SecondRow: Story = { args: { idx: 1 } };
