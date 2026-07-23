import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressWeekSection } from "./ProgressWeekSection";
import { hierarchyBaseProps } from "./_storyFixtures";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Progress/Hierarchy/ProgressWeekSection",
  component: ProgressWeekSection,
  tags: ["autodocs"],
  decorators: [(Story) => (<MobileStoryThemeProvider><div style={{ width: 360, padding: 16, background: "#F7F6FA" }}><Story /></div></MobileStoryThemeProvider>)],
  parameters: { layout: "fullscreen" },
  args: hierarchyBaseProps().week!,
} satisfies Meta<typeof ProgressWeekSection>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default = {} as Story;
export const Building: Story = { args: { ...hierarchyBaseProps().week!, adherencePct: null } };