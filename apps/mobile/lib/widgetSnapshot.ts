/**
 * Widget snapshot — mobile wrapper for Batch 5.12.
 *
 * Pure schema + `buildWidgetSnapshot` live in the shared helper
 * (`src/lib/nutrition/widgetSnapshot.ts`); this wrapper adds the I/O:
 *
 *   - `writeWidgetSnapshot` persists the snapshot to AsyncStorage (always)
 *     and — best-effort — to a shared App Group-accessible file when
 *     `expo-file-system` is available. A native iOS widget extension reads
 *     the file via the App Group container; when only AsyncStorage is
 *     written the native extension can read the JSON via the same storage
 *     key through the `MMKV`/`NSUserDefaults` bridge (future work).
 *
 * Persistence never throws — hydration / UI never has to guard the write.
 * The caller should debounce at ~500 ms to avoid flooding disk on every
 * keystroke of a macro edit.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  buildWidgetSnapshot,
  SUPPR_WIDGET_SNAPSHOT_FILENAME,
  SUPPR_WIDGET_SNAPSHOT_KEY,
  WIDGET_TAP_DEEP_LINK,
  type WidgetSnapshot,
  type WidgetSnapshotInput,
} from "@suppr/nutrition-core/widgetSnapshot";

export {
  buildWidgetSnapshot,
  SUPPR_WIDGET_SNAPSHOT_FILENAME,
  SUPPR_WIDGET_SNAPSHOT_KEY,
  WIDGET_TAP_DEEP_LINK,
  type WidgetSnapshot,
  type WidgetSnapshotInput,
};

/**
 * Full filesystem path the native iOS widget extension should read from
 * (once wired). Exported so the Swift side and the docs stay in sync.
 * Best-effort — returns `null` when `expo-file-system` isn't available
 * at runtime (e.g. Expo Go without the module).
 */
export function getWidgetSnapshotFilePath(): string | null {
  try {
    // Dynamic require so typecheck + unit tests (node environment) don't
    // fail when the optional native module isn't resolvable.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const FileSystem = require("expo-file-system");
    const base: unknown = FileSystem?.documentDirectory ?? FileSystem?.Paths?.document;
    if (typeof base !== "string" || !base) return null;
    // documentDirectory typically ends with "/".
    return `${base.replace(/\/$/, "")}/${SUPPR_WIDGET_SNAPSHOT_FILENAME}`;
  } catch {
    return null;
  }
}

/**
 * Persist the snapshot. Always writes AsyncStorage; best-effort writes to
 * disk for the native widget extension to consume via App Group once wired.
 * Never throws — returns `{ ok, writtenToFile }` so the caller can surface
 * soft failures in analytics if desired.
 */
export async function writeWidgetSnapshot(
  snapshot: WidgetSnapshot,
): Promise<{ ok: boolean; writtenToFile: boolean }> {
  const json = JSON.stringify(snapshot);
  let asyncOk = false;
  let writtenToFile = false;

  try {
    await AsyncStorage.setItem(SUPPR_WIDGET_SNAPSHOT_KEY, json);
    asyncOk = true;
  } catch (err) {
    // Swallow — widget freshness is best-effort.
    if (__DEV__) console.warn("[widgetSnapshot] AsyncStorage write failed:", err);
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const FileSystem = require("expo-file-system");
    const path = getWidgetSnapshotFilePath();
    if (path && typeof FileSystem?.writeAsStringAsync === "function") {
      await FileSystem.writeAsStringAsync(path, json);
      writtenToFile = true;
    }
  } catch (err) {
    if (__DEV__) console.warn("[widgetSnapshot] file write failed:", err);
  }

  return { ok: asyncOk, writtenToFile };
}

/**
 * Read back the last-written snapshot (used by tests / debug screens).
 * Returns `null` when nothing has been written or the payload is invalid
 * JSON. Never throws.
 */
export async function readWidgetSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(SUPPR_WIDGET_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as WidgetSnapshot;
  } catch {
    return null;
  }
}
