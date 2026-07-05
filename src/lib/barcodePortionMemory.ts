/**
 * Barcode portion memory (audit/2026-04-30 — competitive parity vs MFP / Cal AI).
 *
 * When the same barcode is logged repeatedly, the portion picker should
 * default to the user's previously-chosen grams instead of the food's
 * reference serving. Entries auto-expire after 90 days so a stale "always
 * 30 g" doesn't follow a user forever after they switch product variants.
 *
 * This module is the canonical home for the storage-independent pieces
 * (key building, TTL, payload validation, the clamp-to-serving-options
 * algorithm) — shared with mobile's `apps/mobile/lib/barcodePortionMemory.ts`
 * (ENG-1358; the two were previously a byte-identical hand-mirrored copy).
 * The read/write functions below stay **synchronous** and web-only on
 * purpose: `window.localStorage` is sync, and
 * `src/app/components/suppr/today-barcode-dialog.tsx` calls
 * `getRememberedPortion` / `recordPortion` without `await`. Making the
 * public API async here would silently turn a `number | null` return into
 * an un-awaited `Promise` at that call site. Mobile's AsyncStorage is
 * inherently async, so its wrapper stays async and imports the shared pure
 * helpers below — see that file for the parallel contract.
 */

const KEY_PREFIX = "barcode_portion_v1:";
const TTL_MS = 90 * 24 * 60 * 60 * 1000;

export type StoredBarcodePortion = { grams: number; ts: number };

export function isStoredBarcodePortion(value: unknown): value is StoredBarcodePortion {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.grams === "number" && Number.isFinite(v.grams) && v.grams > 0
    && typeof v.ts === "number" && Number.isFinite(v.ts);
}

/** Conservative cap so a malicious / accidental long string can't blow up
 *  storage. Real EAN/UPC barcodes are <= 14 digits. */
export function normaliseBarcode(raw: string): string | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  if (t.length > 64) return null;
  return t;
}

export function barcodePortionStorageKey(code: string): string {
  return KEY_PREFIX + code;
}

export function barcodePortionKeyPrefix(): string {
  return KEY_PREFIX;
}

export function isBarcodePortionExpired(stored: StoredBarcodePortion, now: number = Date.now()): boolean {
  return now - stored.ts > TTL_MS;
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
  for (const opt of servingOptions) {
    if (!Number.isFinite(opt.grams) || opt.grams <= 0) continue;
    const delta = Math.abs(opt.grams - remembered);
    if (delta < 0.5) { bestGrams = opt.grams; break; }
    if (delta < bestDelta) {
      bestDelta = delta;
      bestGrams = opt.grams;
    }
  }
  return bestGrams;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function recordPortion(barcode: string, grams: number): void {
  const code = normaliseBarcode(barcode);
  if (!code) return;
  if (!Number.isFinite(grams) || grams <= 0) return;
  const ls = getStorage();
  if (!ls) return;
  try {
    const payload: StoredBarcodePortion = { grams: Math.round(grams * 10) / 10, ts: Date.now() };
    ls.setItem(barcodePortionStorageKey(code), JSON.stringify(payload));
  } catch {
    // ignore — non-critical
  }
}

export function getRememberedPortion(barcode: string): number | null {
  const code = normaliseBarcode(barcode);
  if (!code) return null;
  const ls = getStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(barcodePortionStorageKey(code));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredBarcodePortion(parsed)) return null;
    if (isBarcodePortionExpired(parsed)) {
      try { ls.removeItem(barcodePortionStorageKey(code)); } catch { /* ignore */ }
      return null;
    }
    return parsed.grams;
  } catch {
    return null;
  }
}

/** Test-only — clear all remembered barcode portions. */
export function _resetRememberedPortionsForTests(): void {
  const ls = getStorage();
  if (!ls) return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k && k.startsWith(KEY_PREFIX)) toRemove.push(k);
    }
    for (const k of toRemove) ls.removeItem(k);
  } catch {
    // ignore
  }
}
