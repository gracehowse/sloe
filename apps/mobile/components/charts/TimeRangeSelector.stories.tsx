import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import TimeRangeSelector from "./TimeRangeSelector";
import { Colors } from "@/constants/theme";
const c = Colors.light;
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Charts/TimeRangeSelector",
  component: TimeRangeSelector,
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
  args: { selected: "1M" as const, onSelect: () => undefined, cardColor: c.card, textColor: c.text, secondaryColor: c.textSecondary },
} satisfies Meta<typeof TimeRangeSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const DisabledRanges: Story = { args: { selected: "1W" as const, disabledRanges: new Set(["12M" as const]) } };
