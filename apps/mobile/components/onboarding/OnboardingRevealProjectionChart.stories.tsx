import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingRevealProjectionChart } from "./OnboardingRevealProjectionChart";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Onboarding/OnboardingRevealProjectionChart",
  component: OnboardingRevealProjectionChart,
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
  args: { projection: { startMarker: { kg: 68, label: "Now" }, endMarker: { kg: 62, label: "Goal" }, sparkline: [{ kg: 68 }, { kg: 66.5 }, { kg: 62 }], weeksToGoal: 12, goalLabel: "Lose steadily" } },
} satisfies Meta<typeof OnboardingRevealProjectionChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoseGoal = {} as Story;
export const LongHorizon: Story = { args: { projection: { ...{ startMarker: { kg: 68, label: "Now" }, endMarker: { kg: 62, label: "Goal" }, sparkline: [{ kg: 68 }, { kg: 66.5 }, { kg: 62 }], weeksToGoal: 12, goalLabel: "Lose steadily" }, weeksToGoal: 24 } } };
