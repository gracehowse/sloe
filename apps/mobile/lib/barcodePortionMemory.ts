/**
 * Barcode portion memory (audit/2026-04-30 — competitive parity vs MFP / Cal AI).
 *
 * When the same barcode is logged repeatedly, the portion picker should
 * default to the user's previously-chosen grams instead of the food's
 * reference serving. This is the cheapest highest-leverage win flagged
 * by the product-lead audit: cuts taps per re-log of staples (yoghurt,
 * peanut butter, protein bars, etc.) and matches what users expect from
 * mature trackers.
 *
 * Persistence: AsyncStorage keyed by barcode (per device, not per user).
 * For TestFlight today this is single-tester, single-device — sufficient
 * for v1. Schema upgrade path (server-side `user_food_preferences`) is
 * a follow-up; the call sites here are stable so the storage backing
 * can swap without changing readers.
 *
 * Entries auto-expire after 90 days so a stale "always 30 g" doesn't
 * follow a user forever after they switch product variants.
 *
 * Key building, TTL, payload validation, and the clamp algorithm are
 * shared with the web wrapper (`src/lib/barcodePortionMemory.ts`, ENG-1358
 * — was a byte-identical hand-mirrored copy). The async, AsyncStorage-based
 * public API stays mobile-only because web's `localStorage` is sync and its
 * call sites don't await — see that file's header comment for why the two
 * public APIs can't be merged.
 */

import {
  barcodePortionStorageKey,
  barcodePortionKeyPrefix,
  clampRememberedToServingOptions,
  isBarcodePortionExpired,
  isStoredBarcodePortion,
  normaliseBarcode,
  type StoredBarcodePortion,
} from "@suppr/shared/barcodePortionMemory";

export { clampRememberedToServingOptions };

/**
 * Record the grams the user committed for this barcode.
 * Best-effort: any storage failure is swallowed — the log itself
 * already succeeded.
 */
export async function recordPortion(barcode: string, grams: number): Promise<void> {
  const code = normaliseBarcode(barcode);
  if (!code) return;
  if (!Number.isFinite(grams) || grams <= 0) return;
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const payload: StoredBarcodePortion = { grams: Math.round(grams * 10) / 10, ts: Date.now() };
    await AsyncStorage.setItem(barcodePortionStorageKey(code), JSON.stringify(payload));
  } catch {
    // ignore — non-critical
  }
}

/**
 * Returns the previously-logged grams for this barcode, or null when
 * no entry exists, the entry is malformed, or the entry has expired.
 */
export async function getRememberedPortion(barcode: string): Promise<number | null> {
  const code = normaliseBarcode(barcode);
  if (!code) return null;
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const raw = await AsyncStorage.getItem(barcodePortionStorageKey(code));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredBarcodePortion(parsed)) return null;
    if (isBarcodePortionExpired(parsed)) {
      // Expired — drop it so we don't keep returning it.
      await AsyncStorage.removeItem(barcodePortionStorageKey(code));
      return null;
    }
    return parsed.grams;
  } catch {
    return null;
  }
}

/** Test-only — clear all remembered barcode portions. */
export async function _resetRememberedPortionsForTests(): Promise<void> {
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const keys = await AsyncStorage.getAllKeys();
    const prefix = barcodePortionKeyPrefix();
    const ours = keys.filter((k) => k.startsWith(prefix));
    if (ours.length > 0) await AsyncStorage.multiRemove(ours);
  } catch {
    // ignore
  }
}
