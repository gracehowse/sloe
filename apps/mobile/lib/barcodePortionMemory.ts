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
 */

const KEY_PREFIX = "barcode_portion_v1:";
const TTL_MS = 90 * 24 * 60 * 60 * 1000;

type Stored = { grams: number; ts: number };

function isStored(value: unknown): value is Stored {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.grams === "number" && Number.isFinite(v.grams) && v.grams > 0
    && typeof v.ts === "number" && Number.isFinite(v.ts);
}

function normaliseBarcode(raw: string): string | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  // Conservative cap so a malicious / accidental long string can't blow
  // up AsyncStorage. Real EAN/UPC barcodes are <= 14 digits.
  if (t.length > 64) return null;
  return t;
}

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
    const payload: Stored = { grams: Math.round(grams * 10) / 10, ts: Date.now() };
    await AsyncStorage.setItem(KEY_PREFIX + code, JSON.stringify(payload));
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
    const raw = await AsyncStorage.getItem(KEY_PREFIX + code);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isStored(parsed)) return null;
    if (Date.now() - parsed.ts > TTL_MS) {
      // Expired — drop it so we don't keep returning it.
      await AsyncStorage.removeItem(KEY_PREFIX + code);
      return null;
    }
    return parsed.grams;
  } catch {
    return null;
  }
}

/**
 * Clamp a remembered portion to one of the food's available serving
 * options when servings are defined. If the remembered grams matches
 * an option (within 0.5 g), use it as-is; otherwise return the closest
 * option's grams. When no servingOptions are provided, the remembered
 * grams pass through unchanged (the picker is a free numeric input).
 */
export function clampRememberedToServingOptions(
  remembered: number,
  servingOptions: ReadonlyArray<{ grams: number }> | null | undefined,
): number {
  if (!Number.isFinite(remembered) || remembered <= 0) return remembered;
  if (!servingOptions || servingOptions.length === 0) return remembered;
  let bestGrams = remembered;
  let bestDelta = Number.POSITIVE_INFINITY;
  let exact = false;
  for (const opt of servingOptions) {
    if (!Number.isFinite(opt.grams) || opt.grams <= 0) continue;
    const delta = Math.abs(opt.grams - remembered);
    if (delta < 0.5) { exact = true; bestGrams = opt.grams; break; }
    if (delta < bestDelta) {
      bestDelta = delta;
      bestGrams = opt.grams;
    }
  }
  return exact ? bestGrams : bestGrams;
}

/** Test-only — clear all remembered barcode portions. */
export async function _resetRememberedPortionsForTests(): Promise<void> {
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(KEY_PREFIX));
    if (ours.length > 0) await AsyncStorage.multiRemove(ours);
  } catch {
    // ignore
  }
}
