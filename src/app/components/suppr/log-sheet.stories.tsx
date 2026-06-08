import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LogSheet, type LogSheetProps } from "./log-sheet";

/**
 * ENG-773 — log-time meal-slot selector visual proof.
 *
 * The host (`NutritionTracker`) gates the `slot` row behind the
 * `log-sheet-slot-selector` feature flag, so the flag-ON appearance
 * can't be screenshotted from the real authed app without enabling the
 * flag in PostHog. These stories wire the `slot` prop directly (flag-
 * independent) so the selector renders in its real `<LogSheet>` context
 * for pixel + a11y review.
 *
 * `a11y.context` scopes the axe run to just the slot row so the
 * automated contrast check validates the canonical soft-tint +
 * foreground selection language (the whole drawer is out of scope here).
 *
 * Stories use `desktop` (centred 480×640 modal) for a clean crop; the
 * slot-row markup is identical in the mobile bottom-sheet layout.
 */

const SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

const baseArgs: LogSheetProps = {
  open: true,
  onOpenChange: () => {},
  desktop: true,
  search: { onOpen: () => {} },
  barcode: { onOpen: () => {} },
  recent: { entries: [], onPick: () => {} },
  saved: { meals: [], onPick: () => {} },
  voice: { onStart: () => {} },
  photo: { onCapture: () => {} },
};

const meta = {
  title: "Suppr/LogSheet slot selector",
  component: LogSheet,
  tags: ["ai-generated"],
  parameters: {
    layout: "fullscreen",
    // Scope the automated a11y (contrast) check to the new selector row
    // only — the rest of the drawer is exercised by its own tests.
    a11y: { context: '[data-slot="log-sheet-slot-row"]' },
  },
  args: baseArgs,
} satisfies Meta<typeof LogSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

function slot(current: (typeof SLOTS)[number]): LogSheetProps["slot"] {
  return { current, options: SLOTS, onChange: () => {} };
}

export const Breakfast: Story = { args: { slot: slot("Breakfast") } };
export const Lunch: Story = { args: { slot: slot("Lunch") } };
export const Dinner: Story = { args: { slot: slot("Dinner") } };
export const Snacks: Story = { args: { slot: slot("Snacks") } };

/** Sloe DS reskin proof — full entry sheet with Recent / Saved browse +
 *  Pro-locked voice/photo right-edge icons. Pins the plum serif header,
 *  cream search slab, and damson Pro badges for pixel review. */
export const SloeEntrySheet: Story = {
  args: {
    slot: slot("Lunch"),
    recent: {
      entries: [
        { id: "r1", title: "Greek yogurt", kcal: 130, source: "off", bucket: "today" },
        { id: "r2", title: "Oats with banana", kcal: 320, source: "usda", bucket: "week" },
      ],
      onPick: () => {},
    },
    saved: {
      meals: [{ id: "m1", title: "My usual oatmeal", kcal: 380, source: "manual" }],
      onPick: () => {},
    },
    voice: { onStart: () => {}, locked: true },
    photo: { onCapture: () => {}, locked: true },
    onAddManually: () => {},
  },
};

/** S13 logged-confirmation (Figma 202:2) — the calm success state after a
 *  log commits. Presentation-only; the host owns persistence. */
export const LoggedConfirmation: Story = {
  args: {
    confirmation: {
      title: "Greek yogurt",
      kcal: 130,
      slot: "Breakfast",
      source: "off",
      onDone: () => {},
      onUndo: () => {},
    },
  },
};

/** Dark theme — confirms the soft tint + foreground label survives the
 *  dark surface (the active label switches to the dark foreground). */
export const LunchDark: Story = {
  args: { slot: slot("Lunch") },
  globals: { theme: "dark" },
};
