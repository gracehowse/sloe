import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { AdjustConstraintsSheet } from "./AdjustConstraintsSheet";

const meta = {
  title: "Mobile/Plan/AdjustConstraintsSheet",
  component: AdjustConstraintsSheet,
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
  args: {
    visible: true,
    initial: { maxPrepMins: 45, budgetPerDay: 2000, proteinMinG: 100 },
    onSave: () => undefined,
    onClose: () => undefined,
  },
} satisfies Meta<typeof AdjustConstraintsSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OpenDefaults: Story = {};
export const Saving: Story = { args: { saving: true } };
