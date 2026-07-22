import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { SloeImageNotice } from "./SloeImageNotice";

const meta = {
  title: "Mobile/Recipe/SloeImageNotice",
  component: SloeImageNotice,
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
} satisfies Meta<typeof SloeImageNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;

export const OnQuietBackground: Story = {
  name: "On quiet background",
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={{ width: 360, padding: 16, background: "#EDECEF" }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
};
