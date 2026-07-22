import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import DayStrip from "./DayStrip";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Charts/DayStrip",
  component: DayStrip,
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
  args: { selectedDate: new Date("2026-07-12T12:00:00"), weekStartDay: "monday" as const, loggedDays: new Set(["2026-07-10", "2026-07-11"]), onSelectDate: () => undefined, onOpenCalendar: () => undefined, textColor: "#3B2A4D", secondaryColor: "#9B95A6" },
} satisfies Meta<typeof DayStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const WithFreezes: Story = { args: { protectedDateKeys: new Set(["2026-07-10"]) } };
