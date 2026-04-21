/**
 * Mobile-side persistence for the Apple Health per-type sync prefs
 * + last-synced timestamp.
 *
 * The shared SSOT (`src/lib/health/syncTypes.ts`) owns the list of
 * types, their labels, and whether each type is supported. This file
 * owns the *storage*: AsyncStorage keys, getters, setters, defaults.
 *
 * The read path of `syncHealthData` consults these prefs so a branch
 * whose toggle is off gets skipped at runtime. That wiring lives in
 * `apps/mobile/lib/healthSync.ts` and is covered by
 * `apps/mobile/tests/unit/healthSyncTypePrefsGating.test.ts`.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  HEALTH_SYNC_TYPES,
  defaultHealthSyncTypePrefs,
  type HealthSyncTypeKey,
} from "../../../src/lib/health/syncTypes";

/** Stable AsyncStorage key. `_v1` so a shape migration can move us to
 *  `_v2` without clobbering existing user prefs. */
const STORAGE_KEY = "health_sync_type_prefs_v1";
/** ISO timestamp of the last successful `syncHealthData` run. Surfaced
 *  in the Connected card as "Last synced X ago". */
const LAST_SYNC_AT_KEY = "health_last_sync_at_v1";

export type HealthSyncTypePrefs = Record<HealthSyncTypeKey, boolean>;

/** Read the full prefs map. Unknown keys from stored JSON are ignored
 *  (SSOT wins). Missing keys fall back to defaults. Never throws. */
export async function getHealthSyncTypePrefs(): Promise<HealthSyncTypePrefs> {
  const defaults = defaultHealthSyncTypePrefs();
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return defaults;
    const out = { ...defaults };
    for (const t of HEALTH_SYNC_TYPES) {
      const v = (parsed as Record<string, unknown>)[t.key];
      if (typeof v === "boolean") {
        // Never let an unsupported type be stored as `true` — even if
        // the user somehow persisted one, the UI should keep it off.
        out[t.key] = t.supported ? v : false;
      }
    }
    return out;
  } catch {
    return defaults;
  }
}

/** Write a single type's toggle. Unsupported types are a no-op so a
 *  mis-wired caller can't silently enable a branch the sync doesn't
 *  implement. Never throws. */
export async function setHealthSyncTypePref(
  key: HealthSyncTypeKey,
  value: boolean,
): Promise<void> {
  const def = HEALTH_SYNC_TYPES.find((t) => t.key === key);
  if (!def) return;
  if (!def.supported && value) {
    // Refuse to turn on an unsupported type.
    return;
  }
  try {
    const current = await getHealthSyncTypePrefs();
    current[key] = value;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Swallow — the toggle row will re-read on next mount.
  }
}

/** Record "sync completed" now. Used by the Connected card's "Last
 *  synced X ago" line. */
export async function markHealthSyncedNow(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SYNC_AT_KEY, new Date().toISOString());
  } catch {
    // Non-critical; card will show "just now" from in-memory state.
  }
}

/** Read the last-synced ISO timestamp. Returns `null` if never synced
 *  (or on any read error). */
export async function getHealthLastSyncAt(): Promise<Date | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SYNC_AT_KEY);
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isFinite(d.getTime()) ? d : null;
  } catch {
    return null;
  }
}

/**
 * Render a relative "time ago" string for the last-synced card line.
 * Pure; covered by `healthSyncRelativeTimeAgo.test.ts`.
 *
 *   `< 30s` → "just now"
 *   `< 1h`  → "X minutes ago" / "1 minute ago"
 *   `< 1d`  → "X hours ago"   / "1 hour ago"
 *   else    → "X days ago"    / "1 day ago"
 */
export function relativeTimeAgo(from: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - from.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return "just now";
  const seconds = Math.round(diffMs / 1000);
  if (seconds < 30) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
