/**
 * Household sharing grid — client-side persistence adapter.
 *
 * The persisted schema today (`households.share_lunch`) is a single
 * boolean, which cannot represent the 7×4 prototype grid. Until a
 * server-side grid schema ships, we persist the grid locally (per
 * household) using whichever storage adapter the caller passes in:
 * web → `window.localStorage`, mobile → a thin AsyncStorage wrapper.
 * Shared helpers here centralise the key + serialisation so the two
 * platforms cannot drift on key naming or shape.
 *
 * Key shape: `suppr.householdSharing.v1.{householdId}` — versioned
 * so a future migration can bump `v1` without deleting existing
 * grids by accident.
 */

import {
  HOUSEHOLD_DAY_IDS,
  HOUSEHOLD_SLOT_IDS,
  type HouseholdSharingState,
  type HouseholdSharingCell,
  type HouseholdSharingGrid,
  type HouseholdSharingPreset,
  emptyGrid,
} from "./sharingGrid";

export type SharingStorageAdapter = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

const VERSION = "v1";
const PREFIX = "suppr.householdSharing";

export function sharingStorageKey(householdId: string): string {
  return `${PREFIX}.${VERSION}.${householdId}`;
}

const VALID_PRESETS: ReadonlySet<HouseholdSharingPreset> = new Set([
  "all",
  "dinners",
  "weekends",
  "none",
  "custom",
]);

function normaliseCell(raw: unknown): HouseholdSharingCell {
  if (raw === "solo" || raw == null) return "solo";
  if (Array.isArray(raw)) {
    const ids = raw.filter((x): x is string => typeof x === "string" && x.length > 0);
    return ids.length ? ids : "solo";
  }
  return "solo";
}

function normaliseGrid(raw: unknown): HouseholdSharingGrid {
  const grid = emptyGrid();
  if (!raw || typeof raw !== "object") return grid;
  const obj = raw as Record<string, unknown>;
  for (const d of HOUSEHOLD_DAY_IDS) {
    const row = obj[d];
    if (!row || typeof row !== "object") continue;
    const rowObj = row as Record<string, unknown>;
    for (const s of HOUSEHOLD_SLOT_IDS) {
      grid[d][s] = normaliseCell(rowObj[s]);
    }
  }
  return grid;
}

export function parseSharingStateJson(raw: string | null | undefined): HouseholdSharingState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    const preset = typeof obj.preset === "string" && VALID_PRESETS.has(obj.preset as HouseholdSharingPreset)
      ? (obj.preset as HouseholdSharingPreset)
      : "dinners";
    const grid = normaliseGrid(obj.grid);
    return { preset, grid };
  } catch {
    return null;
  }
}

export function serialiseSharingState(state: HouseholdSharingState): string {
  return JSON.stringify({ preset: state.preset, grid: state.grid });
}

export async function readSharingState(
  storage: SharingStorageAdapter,
  householdId: string,
): Promise<HouseholdSharingState | null> {
  try {
    const raw = await storage.getItem(sharingStorageKey(householdId));
    return parseSharingStateJson(raw);
  } catch {
    // Fail closed — the caller will fall back to a preset default.
    return null;
  }
}

export async function writeSharingState(
  storage: SharingStorageAdapter,
  householdId: string,
  state: HouseholdSharingState,
): Promise<void> {
  try {
    await storage.setItem(sharingStorageKey(householdId), serialiseSharingState(state));
  } catch {
    // Best-effort — the caller's optimistic UI already applied the
    // change in-memory; a failed write just means next launch reads
    // the previous state.
  }
}

export async function clearSharingState(
  storage: SharingStorageAdapter,
  householdId: string,
): Promise<void> {
  try {
    await storage.removeItem(sharingStorageKey(householdId));
  } catch {
    // no-op
  }
}
