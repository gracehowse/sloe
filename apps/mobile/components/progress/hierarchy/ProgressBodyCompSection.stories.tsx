import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressBodyCompSection } from "./ProgressBodyCompSection";
import { hierarchyBaseProps } from "./_storyFixtures";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Progress/Hierarchy/ProgressBodyCompSection",
  component: ProgressBodyCompSection,
  tags: ["autodocs"],
  decorators: [(Story) => (<MobileStoryThemeProvider><div style={{ width: 360, padding: 16, background: "#F7F6FA" }}><Story /></div></MobileStoryThemeProvider>)],
  parameters: { layout: "fullscreen" },
  args: hierarchyBaseProps().bodyComp!,
} satisfies Meta<typeof ProgressBodyCompSection>;

export default meta;
type Story = StoryObj<typeof meta>;
export const FreeTier = {} as Story;
export const ProTier: Story = { args: { ...hierarchyBaseProps().bodyComp!, userTier: "pro" } };