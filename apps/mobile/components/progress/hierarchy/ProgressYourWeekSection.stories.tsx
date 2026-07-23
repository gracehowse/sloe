import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressYourWeekSection } from "./ProgressYourWeekSection";
import { hierarchyBaseProps } from "./_storyFixtures";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Progress/Hierarchy/ProgressYourWeekSection",
  component: ProgressYourWeekSection,
  tags: ["autodocs"],
  decorators: [(Story) => (<MobileStoryThemeProvider><div style={{ width: 360, padding: 16, background: "#F7F6FA" }}><Story /></div></MobileStoryThemeProvider>)],
  parameters: { layout: "fullscreen" },
  args: hierarchyBaseProps().yourWeek!,
} satisfies Meta<typeof ProgressYourWeekSection>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default = {} as Story;
export const QuietWeek: Story = { args: { ...hierarchyBaseProps().yourWeek!, shareText: null, usualMealLine: null } };