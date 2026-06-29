/**
 * ResetPlan sheet copy + mode (ENG-1261 / B28).
 * Prototype: `docs/ux/redesign/v3/Sloe-App.html` `ResetPlan` (~L6441–6467).
 */
export type ResetPlanMode = "keep" | "clear";

export const RESET_PLAN_SHEET_COPY = {
  title: "Reset this week's plan",
  insight:
    "This rebuilds your meal plan for the week. It won't touch your targets or your account — just the planned meals.",
  keep: {
    title: "Keep what I've logged",
    subtitle: "Re-plan only the meals you haven't cooked yet",
  },
  clear: {
    title: "Clear and start fresh",
    subtitle: "Remove this week's planned meals and rebuild from scratch",
  },
  clearWarning:
    "Planned (uncooked) meals for this week will be removed. Logged meals stay in your diary.",
  cancel: "Cancel",
  confirm: "Reset plan",
  toastKeep: "Re-planning your week…",
  toastClear: "Plan cleared — rebuilding…",
} as const;

export const RESET_PLAN_CONFIRM_FLAG = "reset_plan_confirm_v1";
