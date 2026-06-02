import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SupprCard } from "./suppr-card";

const meta = {
  component: SupprCard,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof SupprCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = {
  args: {
    tone: "neutral",
    children: <p className="text-sm text-foreground">Plan your week in one place.</p>,
  },
};

export const PrimarySoft: Story = {
  args: {
    tone: "primary",
    children: <p className="text-sm text-foreground">Bonus day — targets scaled for recovery.</p>,
  },
};

export const PrimaryNoBorder: Story = {
  args: {
    tone: "primary",
    border: false,
    children: <p className="text-sm text-foreground">Primary, no border</p>,
  },
};

export const SuccessNoBorder: Story = {
  args: {
    tone: "success",
    border: false,
    children: <p className="text-sm text-foreground">Success, no border</p>,
  },
};

export const PrimaryGradientNoBorder: Story = {
  args: {
    tone: "primary",
    gradient: true,
    border: false,
    children: <p className="text-sm text-foreground">Gradient without border</p>,
  },
};

export const PrimaryGradient: Story = {
  args: {
    tone: "primary",
    gradient: true,
    padding: "lg",
    children: <p className="text-sm font-medium text-foreground">North-star highlight card</p>,
  },
};

export const Success: Story = {
  args: {
    tone: "success",
    children: <p className="text-sm text-foreground">You hit your protein target.</p>,
  },
};

export const Warning: Story = {
  args: {
    tone: "warning",
    children: <p className="text-sm text-foreground">Over your calorie target.</p>,
  },
};

export const Magenta: Story = {
  args: {
    tone: "magenta",
    children: <p className="text-sm text-foreground">AI-generated recipe</p>,
  },
};

export const SheetElevation: Story = {
  args: {
    elevation: "sheet",
    tone: "neutral",
    children: <p className="text-sm text-foreground">Sheet elevation</p>,
  },
};

export const FloatElevation: Story = {
  args: {
    elevation: "float",
    tone: "neutral",
    children: <p className="text-sm text-foreground">Float elevation</p>,
  },
};

export const NoBorder: Story = {
  args: {
    border: false,
    tone: "neutral",
    children: <p className="text-sm text-foreground">Borderless card</p>,
  },
};

export const WarningNoBorder: Story = {
  args: {
    tone: "warning",
    border: false,
    children: <p className="text-sm text-foreground">Warning without border</p>,
  },
};

export const MagentaNoBorder: Story = {
  args: {
    tone: "magenta",
    border: false,
    children: <p className="text-sm text-foreground">Magenta without border</p>,
  },
};

export const Flat: Story = {
  args: {
    elevation: "none",
    tone: "neutral",
    children: <p className="text-sm text-foreground">No shadow</p>,
  },
};

/**
 * `card` tier with `design_system_elevation` forced ON → the soft-elevation
 * branch: the hairline border is dropped, the resting shadow becomes
 * `--elev-card-soft`, and `data-soft-elevation="true"` is emitted. Covers the
 * `softElevation === true` branch in `suppr-card.tsx` (the elevation migration,
 * lines 159-161 + 175) so the 100% Storybook branch gate holds. Uses the same
 * per-story `window.__SUPPR_FORCE_FLAGS__` hook as `suppr-mark` / Playwright's
 * forceFlagsOn (track.ts); `beforeEach` cleanup resets it so the flag never
 * leaks to the sibling stories, which must keep rendering the flat treatment.
 */
export const CardSoftElevation: Story = {
  args: {
    elevation: "card",
    tone: "neutral",
    children: <p className="text-sm text-foreground">Soft resting elevation (flag on)</p>,
  },
  beforeEach() {
    const w = window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> };
    w.__SUPPR_FORCE_FLAGS__ = { design_system_elevation: true };
    return () => {
      delete w.__SUPPR_FORCE_FLAGS__;
    };
  },
};

/**
 * The four accent tones (plus the primary-gradient variant) rendered WITH their
 * hairline border. Uses a non-`card` elevation so `softElevation` is false and
 * the border is kept (soft elevation drops it). Covers the
 * `border ? token : "transparent"` TRUE branch for primary / success / warning /
 * magenta (`suppr-card.tsx` 111/116/121/126) AND the primary-gradient border
 * branch (line 103) — all uncovered since Redesign 2026 defaults card elevation
 * to soft (borderless). One story, no flag-forcing needed.
 */
export const TonesBordered: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {(["primary", "success", "warning", "magenta"] as const).map((tone) => (
        <SupprCard key={tone} tone={tone} elevation="sheet">
          <span className="text-sm text-foreground">{tone} tone, bordered</span>
        </SupprCard>
      ))}
      <SupprCard tone="primary" gradient elevation="sheet">
        <span className="text-sm text-foreground">primary gradient, bordered</span>
      </SupprCard>
    </div>
  ),
};
