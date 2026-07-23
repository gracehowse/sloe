import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressEnergySection } from "./ProgressEnergySection";
import { hierarchyBaseProps } from "./_storyFixtures";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Progress/Hierarchy/ProgressEnergySection",
  component: ProgressEnergySection,
  tags: ["autodocs"],
  decorators: [(Story) => (<MobileStoryThemeProvider><div style={{ width: 360, padding: 16, background: "#F7F6FA" }}><Story /></div></MobileStoryThemeProvider>)],
  parameters: { layout: "fullscreen" },
  args: hierarchyBaseProps().energy!,
} satisfies Meta<typeof ProgressEnergySection>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default = {} as Story;
export const ThinData: Story = { args: { ...hierarchyBaseProps().energy!, hasEnoughData: false } };