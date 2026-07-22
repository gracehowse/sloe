import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { HierarchyOverline } from "./HierarchyOverline";

const meta = {
  title: "Mobile/Progress/Hierarchy/HierarchyOverline",
  component: HierarchyOverline,
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
} satisfies Meta<typeof HierarchyOverline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <HierarchyOverline>Your progress</HierarchyOverline> };
export const Energy: Story = { render: () => <HierarchyOverline>Energy balance</HierarchyOverline> };
