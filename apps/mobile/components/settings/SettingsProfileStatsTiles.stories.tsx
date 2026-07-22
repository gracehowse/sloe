import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SettingsProfileStatsTiles } from "./SettingsProfileStatsTiles";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Settings/SettingsProfileStatsTiles",
  component: SettingsProfileStatsTiles,
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
  args: { stats: [{ label: "Recipes saved", value: "24" }, { label: "Days logged", value: "128" }] },
} satisfies Meta<typeof SettingsProfileStatsTiles>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const Sparse: Story = { args: { stats: [{ label: "Days logged", value: "3" }] } };
