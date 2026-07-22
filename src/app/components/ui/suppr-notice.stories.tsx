import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ChevronRight, Sparkles } from "lucide-react";
import { SupprNotice } from "./suppr-notice";
import { chromaticVisualContract } from "../../../../.storybook/chromaticVisualContract";

const meta = {
  component: SupprNotice,
  tags: ["autodocs", "chromatic"],
  parameters: {
    ...chromaticVisualContract.parameters,
    layout: "padded",
    docs: {
      description: {
        component:
          "Anatomy role **Notice** — *the system speaking* (nudges, hints, empty prompts). Quiet fill + radius 24. Distinct from **Card** (user content). See `docs/design/2026-07-22-ui-anatomy-program.md`.",
      },
    },
  },
} satisfies Meta<typeof SupprNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Invitation: Story = {
  args: {
    tone: "primary",
    variant: "block",
    leading: <Sparkles aria-hidden width={18} height={18} className="text-primary-solid" />,
    children: (
      <span className="flex items-center gap-2">
        <span className="flex-1">Pick a few recipes — we&apos;ll suggest from there.</span>
        <ChevronRight aria-hidden width={18} height={18} className="text-foreground-secondary" />
      </span>
    ),
  },
};

export const StaticHint: Story = {
  args: {
    tone: "neutral",
    variant: "inline",
    children: "Log your first meal — suggestions get smarter once we've seen you eat.",
  },
};

export const WarningInline: Story = {
  args: {
    tone: "warning",
    variant: "inline",
    children: "Connect Apple Health to auto-fill steps and workouts.",
  },
};
