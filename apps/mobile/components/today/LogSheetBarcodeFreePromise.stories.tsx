import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { LogSheetBarcodeFreePromise } from "./LogSheetBarcodeFreePromise";

const meta = {
  title: "Mobile/Today/LogSheetBarcodeFreePromise",
  component: LogSheetBarcodeFreePromise,
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
  args: { onOpen: () => undefined },
} satisfies Meta<typeof LogSheetBarcodeFreePromise>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Interactive: Story = { args: { onOpen: () => alert("Open barcode") } };
