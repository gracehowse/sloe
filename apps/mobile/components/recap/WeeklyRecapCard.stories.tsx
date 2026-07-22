import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import WeeklyRecapCard from "./WeeklyRecapCard";
import { DIGEST_SUCCESS_ARGS } from "../_mobileStoryDecorators";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Recap/WeeklyRecapCard",
  component: WeeklyRecapCard,
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
  args: { ...DIGEST_SUCCESS_ARGS },
} satisfies Meta<typeof WeeklyRecapCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const LowActivity: Story = { args: { daysLogged: 2, headline: "A lighter week." } };
