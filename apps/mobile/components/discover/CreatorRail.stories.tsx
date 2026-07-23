import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CreatorRail } from "./CreatorRail";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Discover/CreatorRail",
  component: CreatorRail,
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
  args: { creators: [{ id: "c1", handle: "mob", displayName: "Mob Kitchen", avatarUrl: null }], onSelect: () => undefined },
} satisfies Meta<typeof CreatorRail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const TwoCreators: Story = { args: { creators: [{ id: "c1", handle: "mob", displayName: "Mob Kitchen", avatarUrl: null }, { id: "c2", handle: "sloe", displayName: "Sloe Kitchen", avatarUrl: null }] } };
