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
 * `design_system_brandmark` is retired (ENG-1651, vestigial-reference cleanup
 * — the brand mark unified unconditionally 2026-06-04, zero live
 * `isFeatureEnabled` call sites remain in `suppr-mark.tsx`). Forcing the flag
 * via `window.__SUPPR_FORCE_FLAGS__` below is now a no-op: both stories render
 * the identical Sloe wordmark as the plain `Mark` story above. Kept as
 * duplicate coverage rather than deleted, since removing them changes nothing
 * about what's under test.
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

/** See `MarkBrandmarkOn` — same no-op force flag, opposite value. */
export const MarkBrandmarkOff: Story = {
  beforeEach() {
    const w = window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> };
    w.__SUPPR_FORCE_FLAGS__ = { design_system_brandmark: false };
    return () => {
      delete w.__SUPPR_FORCE_FLAGS__;
    };
  },
};
