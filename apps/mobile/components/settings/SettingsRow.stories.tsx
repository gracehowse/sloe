import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Bell } from "lucide-react-native";
import { SettingsRow } from "./SettingsRow";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Settings/SettingsRow",
  component: SettingsRow,
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
  args: { icon: Bell, iconColor: "#3B2A4D", label: "Notifications", sub: "Reminders and weekly recap", onPress: () => undefined },
} satisfies Meta<typeof SettingsRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const Destructive: Story = { args: { label: "Delete account", badge: "Danger" } };
