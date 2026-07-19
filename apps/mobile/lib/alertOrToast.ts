import { Alert } from "react-native";

import { isFeatureEnabled } from "@/lib/analytics";
import type { ToastVariant } from "@/components/ui/Toast";
import type { UseToastResult } from "@/hooks/useToast";

type ShowToast = UseToastResult["showToast"];

/**
 * ENG-1344 — flag-gated helper: shows a toast via the caller's `showToast`
 * (from `useToast()`) when `plan_alert_to_toast_v1` is on, else falls back
 * to the original blocking `Alert.alert(title, message)` unchanged.
 *
 * Takes `showToast` directly (not the whole `useToast()` result) so a
 * `useCallback` calling this can list `toast.showToast` — a stable
 * reference — in its deps instead of the whole toast state object, which is
 * a fresh reference every render and would defeat the memoization.
 *
 * Only for genuinely non-blocking, single-button alerts (informational /
 * success / error). Never call this for a destructive or branching
 * (Cancel/OK, Cancel/Delete) confirm — those must stay `Alert.alert` always,
 * flag or no flag, since a toast auto-fades and can't offer a choice.
 */
export function alertOrToast(
  showToast: ShowToast,
  title: string,
  message: string,
  variant: ToastVariant = "info",
): void {
  if (isFeatureEnabled("plan_alert_to_toast_v1")) {
    showToast(`${title} — ${message.charAt(0).toLowerCase()}${message.slice(1)}`, { variant });
  } else {
    Alert.alert(title, message);
  }
}
