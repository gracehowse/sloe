/**
 * Pending Siri / deep-link action queue — Batch 5.12.
 *
 * The `_layout.tsx` URL listener parses an incoming `suppr://…` link and
 * either navigates (for `today_remaining`) or enqueues a pending mutation
 * for the Today tab to flush. This split keeps the layout provider-free —
 * it doesn't need access to the Today hook state — and lets both a cold-
 * start deep link and a warm "url" event converge on the same handler.
 *
 * Queue shape is a single-slot "latest wins" — we only ever hold one
 * pending action so a rapid double-tap can't silently double-log water.
 * Today drains the slot atomically (`consumePendingSiriAction`).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SiriAction } from "@suppr/nutrition-core/siriDeepLinks";

const KEY = "pm:siri:pendingAction";
/** Anything older than 5 minutes is stale — don't fire a log_water that
 *  the user triggered an hour ago and forgot about. */
const MAX_AGE_MS = 5 * 60_000;

type Envelope = {
  queuedAt: number;
  action: SiriAction;
};

export async function setPendingSiriAction(action: SiriAction): Promise<void> {
  try {
    const envelope: Envelope = { queuedAt: Date.now(), action };
    await AsyncStorage.setItem(KEY, JSON.stringify(envelope));
  } catch {
    // Swallow — the action came from a user gesture and a failed
    // persistence shouldn't tear down the app.
  }
}

/**
 * Atomically reads and clears the slot. Returns `null` when the slot is
 * empty, unparseable, or older than `MAX_AGE_MS`.
 */
export async function consumePendingSiriAction(): Promise<SiriAction | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as Envelope;
    if (!parsed || typeof parsed.queuedAt !== "number") return null;
    if (Date.now() - parsed.queuedAt > MAX_AGE_MS) return null;
    return parsed.action;
  } catch {
    return null;
  }
}
