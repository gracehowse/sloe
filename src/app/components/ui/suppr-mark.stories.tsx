import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  SupprMark,
  SupprWordmark,
  SupprPlateMark,
  SupprPlateWordmark,
} from "./suppr-mark";

const meta = {
  component: SupprMark,
  tags: ["ai-generated"],
} satisfies Meta<typeof SupprMark>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Brand mark at the default 32px. */
export const Mark: Story = {};

/** Brand mark at an explicit size. */
export const MarkSized: Story = { args: { size: 48 } };

/** Mark + "Suppr" wordmark lockup (default 28px). */
export const Wordmark: Story = { render: () => <SupprWordmark /> };

/** Wordmark lockup at an explicit size. */
export const WordmarkSized: Story = { render: () => <SupprWordmark size={40} /> };

/** Plate variant of the mark (default 32px). */
export const PlateMark: Story = { render: () => <SupprPlateMark /> };

/** Plate mark at an explicit size. */
export const PlateMarkSized: Story = { render: () => <SupprPlateMark size={48} /> };

/** Plate mark + wordmark lockup (default 28px). */
export const PlateWordmark: Story = { render: () => <SupprPlateWordmark /> };

/** Plate wordmark lockup at an explicit size. */
export const PlateWordmarkSized: Story = {
  render: () => <SupprPlateWordmark size={40} />,
};

/**
 * `SupprMark` with `design_system_brandmark` forced ON → it routes through the
 * canonical plate-ring variant (the flag-on branch in SupprMark). Uses the same
 * `window.__SUPPR_FORCE_FLAGS__` hook as Playwright's forceFlagsOn / track.ts;
 * the `beforeEach` cleanup resets it so the flag never leaks to other stories.
 */
export const MarkBrandmarkOn: Story = {
  beforeEach() {
    const w = window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> };
    w.__SUPPR_FORCE_FLAGS__ = { design_system_brandmark: true };
    return () => {
      delete w.__SUPPR_FORCE_FLAGS__;
    };
  },
};

/**
 * `SupprMark` with `design_system_brandmark` forced OFF → the pre-redesign
 * legacy mark branch (`suppr-mark.tsx` 29-56, 69-70). Now that Redesign 2026
 * is default-ON, every un-forced story above renders the on-state, so this is
 * the only story exercising the off-path — required for the 100% branch gate.
 * Paired with `MarkBrandmarkOn` so both branches stay covered regardless of the
 * default flag state. Same per-story hook + cleanup.
 */
export const MarkBrandmarkOff: Story = {
  beforeEach() {
    const w = window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> };
    w.__SUPPR_FORCE_FLAGS__ = { design_system_brandmark: false };
    return () => {
      delete w.__SUPPR_FORCE_FLAGS__;
    };
  },
};
