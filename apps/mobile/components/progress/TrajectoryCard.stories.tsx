import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TrajectoryCard } from "./TrajectoryCard";
function buildByDay(count, kcal=1850){const byDay={};for(let i=0;i<count;i++)byDay[`2026-07-${String(i+1).padStart(2,"0")}`]=[{calories:kcal}];return byDay;}
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Progress/TrajectoryCard",
  component: TrajectoryCard,
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
  args: { latestWeightKg: 72.4, targetCalories: 2000, maintenanceTdeeKcal: 2350, goal: "lose", goalWeightKg: 68, byDay: buildByDay(6, 1820) },
} satisfies Meta<typeof TrajectoryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Projection = {} as Story;
export const Placeholder: Story = { args: { byDay: buildByDay(3) } };
