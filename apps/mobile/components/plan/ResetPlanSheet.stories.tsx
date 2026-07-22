import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { ResetPlanSheet } from "./ResetPlanSheet";

const meta = {
  title: "Mobile/Plan/ResetPlanSheet",
  component: ResetPlanSheet,
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
  args: { visible: true, onClose: () => undefined, onConfirm: () => undefined },
} satisfies Meta<typeof ResetPlanSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};
export const Loading: Story = { args: { loading: true } };
