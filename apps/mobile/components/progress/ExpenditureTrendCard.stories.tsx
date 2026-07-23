import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ExpenditureTrendCard } from "./ExpenditureTrendCard";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Progress/ExpenditureTrendCard",
  component: ExpenditureTrendCard,
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
  args: { maintenanceKcal: 2200, adaptiveKcal: 2073, confidence: "high" },
} satisfies Meta<typeof ExpenditureTrendCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Adaptive = {} as Story;
export const FormulaOnly: Story = { args: { adaptiveKcal: null, confidence: "low" } };
