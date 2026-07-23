import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

import CopyMealCalendar from "./CopyMealCalendar";
const viewMonth = new Date("2026-06-01T12:00:00");
const min = new Date("2026-06-01T12:00:00");
const max = new Date("2026-06-30T12:00:00");

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Today/CopyMealCalendar",
  component: CopyMealCalendar,
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
  
} satisfies Meta<typeof CopyMealCalendar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PickTargetDay: Story = {
  render: () => (
    <CopyMealCalendar
      viewMonth={viewMonth}
      onChangeMonth={noop}
      targetKey="2026-06-22"
      onPick={noop}
      sourceDayKey="2026-06-21"
      sourceSlot="Lunch"
      targetSlot="Lunch"
      min={min}
      max={max}
      colors={{ text: c.text, textTertiary: c.textTertiary, primaryForeground: c.primaryForeground }}
    />
  ),
};
export const SameDayDisabled: Story = {
  render: () => (
    <CopyMealCalendar
      viewMonth={viewMonth}
      onChangeMonth={noop}
      targetKey="2026-06-21"
      onPick={noop}
      sourceDayKey="2026-06-21"
      sourceSlot="Lunch"
      targetSlot="Lunch"
      min={min}
      max={max}
      colors={{ text: c.text, textTertiary: c.textTertiary, primaryForeground: c.primaryForeground }}
    />
  ),
};
