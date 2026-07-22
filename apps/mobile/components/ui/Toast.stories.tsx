import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { Toast } from "./Toast";

const meta = {
  title: "Mobile/UI/Toast",
  component: Toast,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div
          style={{
            width: 360,
            padding: 16,
            background: "#F7F6FA",
            position: "relative",
            minHeight: 120,
          }}
        >
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Anatomy role **Toast** — calm auto-fading card overlay (info/success/error). Presentational only — pair with `useToast()` for lifecycle. See `docs/design/2026-07-22-ui-anatomy-program.md`.",
      },
    },
  },
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {
  args: {
    visible: true,
    message: "Meal logged",
    variant: "info",
  },
};

export const Success: Story = {
  args: {
    visible: true,
    message: "Plan regenerated",
    variant: "success",
  },
};

export const Error: Story = {
  args: {
    visible: true,
    message: "Could not save changes",
    variant: "error",
  },
};

export const WithUndo: Story = {
  args: {
    visible: true,
    message: "Meal removed",
    variant: "info",
    action: { label: "Undo", onPress: () => undefined },
    onDismiss: () => undefined,
  },
};

export const Bottom: Story = {
  args: {
    visible: true,
    message: "Copied to clipboard",
    variant: "success",
    position: "bottom",
    inset: 24,
  },
};
