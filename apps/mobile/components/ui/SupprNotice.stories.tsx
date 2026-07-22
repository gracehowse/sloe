import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ChevronRight, Sparkles } from "lucide-react";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { SupprNotice } from "./SupprNotice";
import { chromaticVisualContract } from "../../../../.storybook/chromaticVisualContract";

const meta = {
  title: "Mobile/UI/SupprNotice",
  component: SupprNotice,
  tags: ["autodocs", "chromatic"],
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
    ...chromaticVisualContract.parameters,
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Anatomy role **Notice** (mobile) — *the system speaking*. Quiet fill, radius 24. Distinct from Card (user content). Answers: purple nudge vs white meals card.",
      },
    },
  },
} satisfies Meta<typeof SupprNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Invitation: Story = {
  args: {
    accessibilityLabel: "Pick recipes for your library",
    onPress: () => undefined,
    icon: <Sparkles size={18} color="#3B2A4D" />,
    trailing: <ChevronRight size={18} color="#6B6570" />,
    children: "Pick a few recipes — we'll suggest from there.",
  },
};

export const Dismissible: Story = {
  args: {
    onDismiss: () => undefined,
    children: "Connect Apple Health to auto-fill steps.",
  },
};
