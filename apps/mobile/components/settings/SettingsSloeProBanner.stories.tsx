import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SettingsSloeProBanner } from "./SettingsSloeProBanner";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Settings/SettingsSloeProBanner",
  component: SettingsSloeProBanner,
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
  args: { onPress: () => undefined },
} satisfies Meta<typeof SettingsSloeProBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const Compact: Story = { args: { compact: true } };
