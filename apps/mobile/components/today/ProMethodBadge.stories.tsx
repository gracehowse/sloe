import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { ProMethodBadge } from "./ProMethodBadge";

const meta = {
  title: "Mobile/Today/ProMethodBadge",
  component: ProMethodBadge,
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
  
} satisfies Meta<typeof ProMethodBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithMargin: Story = { args: { style: { marginLeft: 8 } } };
