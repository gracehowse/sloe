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
  // The confirmation state REPLACES the slot-selector row, so the meta-level
  // `a11y.context` ([data-slot="log-sheet-slot-row"]) matches nothing here and
  // axe errors with "No elements found for include in frame Context". Re-scope
  // the a11y run to the confirmation card this story actually renders.
  parameters: {
    a11y: { context: '[data-slot="log-sheet-confirmation"]' },
  },
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

/**
 * ENG-1643 — the log-session tray (immediate-commit multi-add receipt).
 * Flag-independent (the tray renders whenever the host threads the
 * `sessionTray` prop, exactly as `LogSheet` receives it in real use — the
 * `log_session_tray_v1` gate lives in the HOST, not here), so these stories
 * pin the tray's real states for pixel review without a PostHog ramp.
 * Spec: `docs/specs/2026-07-21-log-session-tray.md`.
 */
const trayItem = (
  over: Partial<import("../../../lib/nutrition/logSessionTray").LogSessionTrayItem>,
): import("../../../lib/nutrition/logSessionTray").LogSessionTrayItem => ({
  mealId: "m1",
  title: "Chicken breast, grilled",
  kcal: 165,
  protein: 31,
  carbs: 0,
  fat: 3.6,
  slot: "Lunch",
  kcalIsVerified: true,
  ...over,
});

export const SessionTrayCollapsed: Story = {
  parameters: { a11y: { context: '[data-testid="log-session-tray"]' } },
  args: {
    slot: slot("Lunch"),
    sessionTray: {
      items: [trayItem({ mealId: "m1" })],
      pendingUndoIds: [],
      onUndo: () => {},
      onDone: () => {},
    },
  },
};

export const SessionTrayMultiItem: Story = {
  parameters: { a11y: { context: '[data-testid="log-session-tray"]' } },
  args: {
    slot: slot("Lunch"),
    sessionTray: {
      items: [
        trayItem({ mealId: "m1" }),
        trayItem({
          mealId: "m2",
          title: "Brown rice, cooked",
          kcal: 216,
          protein: 5,
          carbs: 45,
          fat: 1.8,
          kcalIsVerified: true,
        }),
        trayItem({
          mealId: "m3",
          title: "Steamed broccoli",
          kcal: 55,
          protein: 3.7,
          carbs: 11,
          fat: 0.6,
          kcalIsVerified: false,
        }),
      ],
      pendingUndoIds: [],
      onUndo: () => {},
      onDone: () => {},
      onSaveMeal: () => {},
    },
  },
};

/** Expanded panel, forced open via `expanded` play-arg equivalent — Storybook
 *  can't drive internal component state directly, so this story renders the
 *  same multi-item tray and a play function clicks the collapsed bar to open
 *  it, pinning the row list + totals footer + Save-as-usual-meal CTA. */
export const SessionTrayExpanded: Story = {
  ...SessionTrayMultiItem,
  parameters: {
    ...SessionTrayMultiItem.parameters,
    a11y: { context: '[data-testid="log-session-tray"]' },
  },
  play: async ({ canvasElement }) => {
    const { within, userEvent } = await import("@storybook/test");
    const canvas = within(canvasElement);
    const bar = await canvas.findByTestId("log-session-tray-bar");
    await userEvent.click(bar);
  },
};

/** Multi-slot session (an item logged to Breakfast, another to Lunch) — pins
 *  the per-row " · {Slot}" suffix that only renders when the tray spans more
 *  than one slot. */
export const SessionTrayMultiSlot: Story = {
  ...SessionTrayExpanded,
  args: {
    slot: slot("Lunch"),
    sessionTray: {
      items: [
        trayItem({ mealId: "m1", title: "Oatmeal, cooked", kcal: 158, protein: 6, carbs: 27, fat: 3, slot: "Breakfast" }),
        trayItem({ mealId: "m2", title: "Chicken breast, grilled", slot: "Lunch" }),
      ],
      pendingUndoIds: [],
      onUndo: () => {},
      onDone: () => {},
    },
  },
};
