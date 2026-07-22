import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { PlanSourceSelector } from "./PlanSourceSelector";

const noop = () => undefined;

const meta = {
  title: "Mobile/Plan/PlanSourceSelector",
  component: PlanSourceSelector,
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
    mode: "library",
    libraryCount: 24,
    discoverCount: 8,
    onChange: noop,
  },
} satisfies Meta<typeof PlanSourceSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LibrarySelected: Story = {};

export const DiscoveryEmpty: Story = { args: { discoverCount: 0 } };
