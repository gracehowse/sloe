import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { SkeletonList } from "./LogSheetSkeletonList";

const meta = {
  title: "Mobile/Today/LogSheetSkeletonList",
  component: SkeletonList,
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
  
} satisfies Meta<typeof SkeletonList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <SkeletonList colors={c} /> };
export const Dark: Story = {
  render: () => <SkeletonList colors={Colors.dark} />,
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider scheme="dark">
        <div style={{ width: 360, padding: 16, background: "#1A1A1E" }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
};
