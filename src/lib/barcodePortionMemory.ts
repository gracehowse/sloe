/**
 * Barcode portion memory — web mirror of `apps/mobile/lib/barcodePortionMemory.ts`.
 * Same shape, same TTL, same clamp logic; storage backend is `localStorage`
 * (per-browser) so the web barcode dialog also pre-fills the user's last
 * portion size. Audit/2026-04-30 — competitive parity vs MFP / Cal AI.
 *
 * Falls back to a no-op when `localStorage` is unavailable (SSR, private
 * mode, exotic embeds) so callers can use it unconditionally.
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
  if (t.length > 64) return null;
  return t;
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
    const payload: Stored = { grams: Math.round(grams * 10) / 10, ts: Date.now() };
    ls.setItem(KEY_PREFIX + code, JSON.stringify(payload));
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
    const raw = ls.getItem(KEY_PREFIX + code);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isStored(parsed)) return null;
    if (Date.now() - parsed.ts > TTL_MS) {
      try { ls.removeItem(KEY_PREFIX + code); } catch { /* ignore */ }
      return null;
    }
    return parsed.grams;
  } catch {
    return null;
  }
}

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
