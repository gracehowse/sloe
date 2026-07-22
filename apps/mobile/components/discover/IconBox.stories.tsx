import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import IconBox from "./IconBox";
import { Sparkles } from "lucide-react-native";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Discover/IconBox",
  component: IconBox,
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
  
} satisfies Meta<typeof IconBox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <IconBox color="#3B2A4D"><Sparkles size={18} color="#3B2A4D" /></IconBox> };
export const Large: Story = { render: () => <IconBox color="#6B9080" size={40}><Sparkles size={22} color="#6B9080" /></IconBox> };
