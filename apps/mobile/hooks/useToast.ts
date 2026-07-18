import { useCallback, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react-native";

import type { ToastVariant } from "@/components/ui/Toast";

/**
 * useToast — host-owned visibility/message/variant state + auto-dismiss
 * timer for the shared `<Toast>` primitive (ENG-1344 first slice).
 *
 * Replace, not queue: calling `showToast` while a toast is already visible
 * replaces it immediately and resets the auto-dismiss clock — there is no
 * message queue. A screen that can trigger two toasts in quick succession
 * should render exactly ONE `<Toast>` fed by ONE `useToast()` instance so
 * the two calls share this replace behaviour rather than rendering two
 * independent overlays that can visually collide.
 */
const DEFAULT_AUTO_DISMISS_MS = 3000;

export interface ShowToastOptions {
  variant?: ToastVariant;
  /** Overrides the variant's default glyph. */
  icon?: LucideIcon;
  /** Per-call auto-dismiss override. Defaults to the hook's `autoDismissMs`. */
  durationMs?: number;
}

interface ToastState {
  visible: boolean;
  message: string | null;
  variant: ToastVariant;
  icon: LucideIcon | undefined;
}

export interface UseToastResult extends ToastState {
  showToast: (message: string, options?: ShowToastOptions) => void;
  dismissToast: () => void;
}

const INITIAL_STATE: ToastState = {
  visible: false,
  message: null,
  variant: "info",
  icon: undefined,
};

export function useToast(options?: { autoDismissMs?: number }): UseToastResult {
  const autoDismissMs = options?.autoDismissMs ?? DEFAULT_AUTO_DISMISS_MS;
  const [state, setState] = useState<ToastState>(INITIAL_STATE);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismissToast = useCallback(() => {
    clearTimer();
    setState((s) => (s.visible ? { ...s, visible: false } : s));
  }, [clearTimer]);

  const showToast = useCallback(
    (message: string, opts?: ShowToastOptions) => {
      clearTimer();
      setState({
        visible: true,
        message,
        variant: opts?.variant ?? "info",
        icon: opts?.icon,
      });
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setState((s) => ({ ...s, visible: false }));
      }, opts?.durationMs ?? autoDismissMs);
    },
    [autoDismissMs, clearTimer],
  );

  useEffect(() => clearTimer, [clearTimer]);

  return { ...state, showToast, dismissToast };
}

export default useToast;
