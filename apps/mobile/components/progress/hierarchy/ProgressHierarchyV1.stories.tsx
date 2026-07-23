import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { ProgressHierarchyV1 } from "./ProgressHierarchyV1";
import { hierarchyBaseProps } from "./_storyFixtures";

const meta = {
  title: "Mobile/Progress/Hierarchy/ProgressHierarchyV1",
  component: ProgressHierarchyV1,
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
  args: hierarchyBaseProps(),
} satisfies Meta<typeof ProgressHierarchyV1>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const TrendsOnly: Story = { args: hierarchyBaseProps({ mode: "trends_only" }) };
