import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WeightCelebrationOverlays } from "./WeightCelebrationOverlays";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Progress/WeightCelebrationOverlays",
  component: WeightCelebrationOverlays,
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
  args: { milestoneKg: 70, visible: true, onDismiss: () => undefined },
} satisfies Meta<typeof WeightCelebrationOverlays>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Visible = {} as Story;
export const Hidden: Story = { args: { visible: false } };
