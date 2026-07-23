import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CookHandsfreeBanner } from "./CookHandsfreeBanner";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Cook/CookHandsfreeBanner",
  component: CookHandsfreeBanner,
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
  args: { visible: true },
} satisfies Meta<typeof CookHandsfreeBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Visible = {} as Story;
export const Hidden: Story = { args: { visible: false } };
