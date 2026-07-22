import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { SupprButton } from "./SupprButton";

const meta = {
  title: "Mobile/UI/SupprButton",
  component: SupprButton,
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
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Anatomy role **CommitPill** (`variant=\"primary\"`) / **GhostPill** (`variant=\"ghost\"`) — the shared mobile CTA primitive. One solid primary per screen; ghost for secondary/tertiary. See `docs/design/2026-07-22-ui-anatomy-program.md`.",
      },
    },
  },
} satisfies Meta<typeof SupprButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { variant: "primary", label: "Log it", onPress: () => undefined },
};

export const Ghost: Story = {
  args: { variant: "ghost", label: "Not now", onPress: () => undefined },
};

export const Loading: Story = {
  args: { variant: "primary", label: "Saving", loading: true },
};

export const Small: Story = {
  args: { variant: "primary", size: "sm", label: "Save", onPress: () => undefined },
};

export const Disabled: Story = {
  args: { variant: "primary", label: "Unavailable", disabled: true },
};
