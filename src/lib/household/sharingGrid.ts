/**
 * Household sharing grid — 2026-04-20 Claude Design prototype port.
 *
 * The prototype (see
 * `docs/prototypes/2026-04-19-whole-app-experience/project/flows.jsx`
 * `HouseholdSettings` ~L674) exposes a 7×4 weekly grid (days × meal
 * slots) where each cell is either `"solo"` or an array of member IDs.
 * The preset radio (All meals / Dinners only / Dinners + weekends /
 * Individual / Custom) drives the grid state; the grid drives the
 * preset back to "custom" when the user edits a cell by hand.
 *
 * Server-persisted state today is a single boolean — `households.share_lunch`
 * — which cannot distinguish the three "sharing on" presets. This
 * module therefore:
 *
 *   1. Models the full grid locally (used by the settings UI + the
 *      compact HouseholdBar on Plan / Progress for preset-derived
 *      summary copy).
 *   2. Derives a persistable `share_lunch` boolean from the grid so
 *      Save still lands on the legal-gated server column.
 *   3. Provides a reverse helper — `presetFromShareLunch` — that lets
 *      the settings screen hydrate a sane default preset from the
 *      server state for households that haven't saved a custom grid.
 *
 * When a persisted grid schema ships (follow-up tracked in
 * `docs/planning/2026-04-20-household-full-flow-port.md`), only the
 * read/write sites need to change — the shape, presets, and grid-
 * building helpers here stay.
 */

export const HOUSEHOLD_DAY_IDS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type HouseholdDayId = (typeof HOUSEHOLD_DAY_IDS)[number];

export const HOUSEHOLD_SLOT_IDS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type HouseholdSlotId = (typeof HOUSEHOLD_SLOT_IDS)[number];

export type HouseholdSharingPreset =
  | "all"
  | "dinners"
  | "weekends"
  | "none"
  | "custom";

/**
 * The preset presented in the settings UI. Mirrors the prototype's
 * radio list 1:1 (including the "Individual" copy mapping to preset
 * id `"none"` — all slots solo).
 */
export const HOUSEHOLD_SHARING_PRESETS: ReadonlyArray<{
  id: HouseholdSharingPreset;
  label: string;
  sub: string;
}> = [
  { id: "all", label: "All meals", sub: "Everyone eats together" },
  { id: "dinners", label: "Dinners only", sub: "Solo other meals" },
  { id: "weekends", label: "Dinners + weekends", sub: "Casual weekdays" },
  { id: "none", label: "Individual", sub: "Everyone separate" },
  { id: "custom", label: "Custom", sub: "Pick per slot below" },
];

/**
 * Grid cell value: either the literal string `"solo"` (nobody shares
 * this slot — each member eats independently) or an array of member
 * IDs who share it. Empty arrays normalise to `"solo"` (see
 * `toggleMember` in `HouseholdSettings`) so the renderer only needs
 * to branch on two states.
 */
export type HouseholdSharingCell = "solo" | string[];

export type HouseholdSharingGrid = Record<
  HouseholdDayId,
  Record<HouseholdSlotId, HouseholdSharingCell>
>;

export type HouseholdSharingState = {
  preset: HouseholdSharingPreset;
  grid: HouseholdSharingGrid;
};

const WEEKEND_DAYS = new Set<HouseholdDayId>(["sat", "sun"]);

/** Empty grid — every cell `"solo"`. Useful for tests + defaults. */
export function emptyGrid(): HouseholdSharingGrid {
  const grid = {} as HouseholdSharingGrid;
  for (const d of HOUSEHOLD_DAY_IDS) {
    grid[d] = {
      breakfast: "solo",
      lunch: "solo",
      dinner: "solo",
      snack: "solo",
    };
  }
  return grid;
}

/**
 * Build a grid from a preset + member list. `"custom"` returns the
 * empty grid (the caller is expected to overlay their stored cells);
 * the other four presets hard-code the prototype's semantics so the
 * radio → grid mapping is identical on web + mobile.
 *
 * Snacks are NEVER pre-shared by any preset — matching the prototype
 * and the F-16 scope-narrowing posture (snacks + breakfasts are opt-in
 * via Custom only).
 */
export function buildGridForPreset(
  preset: HouseholdSharingPreset,
  memberIds: readonly string[],
): HouseholdSharingGrid {
  const ids = [...memberIds];
  const grid = emptyGrid();
  if (preset === "custom") return grid;
  for (const d of HOUSEHOLD_DAY_IDS) {
    for (const s of HOUSEHOLD_SLOT_IDS) {
      if (preset === "all") {
        grid[d][s] = [...ids];
      } else if (preset === "none") {
        grid[d][s] = "solo";
      } else if (preset === "dinners") {
        grid[d][s] = s === "dinner" ? [...ids] : "solo";
      } else if (preset === "weekends") {
        if (s === "dinner") grid[d][s] = [...ids];
        else if (WEEKEND_DAYS.has(d)) grid[d][s] = [...ids];
        else grid[d][s] = "solo";
      }
    }
  }
  return grid;
}

/**
 * Derive which members share a cell. Normalises `"solo"` / empty /
 * missing to `[]` so the renderer doesn't need to null-guard.
 */
export function cellMembers(
  grid: HouseholdSharingGrid,
  day: HouseholdDayId,
  slot: HouseholdSlotId,
): string[] {
  const v = grid[day]?.[slot];
  if (!v || v === "solo") return [];
  return [...v];
}

/**
 * Cycle a cell: solo → everyone → solo. Matches the prototype's tap
 * behaviour (the long-press / right-click is handled separately by
 * the settings UI via `toggleCellMember`).
 */
export function cycleCell(
  grid: HouseholdSharingGrid,
  day: HouseholdDayId,
  slot: HouseholdSlotId,
  memberIds: readonly string[],
): HouseholdSharingGrid {
  const cur = cellMembers(grid, day, slot);
  const isAll = cur.length === memberIds.length && memberIds.every((id) => cur.includes(id));
  const nextCell: HouseholdSharingCell = isAll ? "solo" : [...memberIds];
  return {
    ...grid,
    [day]: { ...grid[day], [slot]: nextCell },
  };
}

/**
 * Toggle a single member into/out of a cell. Collapses the cell to
 * `"solo"` when the last member is removed so the data shape stays
 * canonical (matches prototype `toggleMember` in flows.jsx ~L721).
 */
export function toggleCellMember(
  grid: HouseholdSharingGrid,
  day: HouseholdDayId,
  slot: HouseholdSlotId,
  memberId: string,
): HouseholdSharingGrid {
  const cur = cellMembers(grid, day, slot);
  const has = cur.includes(memberId);
  const nextIds = has ? cur.filter((x) => x !== memberId) : [...cur, memberId];
  const nextCell: HouseholdSharingCell = nextIds.length ? nextIds : "solo";
  return {
    ...grid,
    [day]: { ...grid[day], [slot]: nextCell },
  };
}

/**
 * Count cells where 2+ members share (i.e. the pill renders as a
 * number or `All`). Used in the settings header summary copy
 * ("X of 28 shared").
 */
export function sharedCellCount(grid: HouseholdSharingGrid): number {
  let n = 0;
  for (const d of HOUSEHOLD_DAY_IDS) {
    for (const s of HOUSEHOLD_SLOT_IDS) {
      if (cellMembers(grid, d, s).length > 1) n++;
    }
  }
  return n;
}

/**
 * Derive the server-persistable `share_lunch` boolean from the grid.
 * Returns `true` when ANY lunch cell has 2+ members (i.e. some lunch
 * is shared). This matches the legal-approved F-16 scope narrowing —
 * the server column's sole responsibility is "does my lunch leave the
 * dinner-only default?".
 */
export function deriveShareLunch(grid: HouseholdSharingGrid): boolean {
  for (const d of HOUSEHOLD_DAY_IDS) {
    if (cellMembers(grid, d, "lunch").length > 1) return true;
  }
  return false;
}

/**
 * Reverse: what preset best represents this server state when the
 * user loads settings cold? Keeps radio defaults sane for households
 * that haven't saved a custom grid locally.
 */
export function presetFromShareLunch(shareLunch: boolean): HouseholdSharingPreset {
  return shareLunch ? "weekends" : "dinners";
}

/**
 * Human-readable short-form summary used by the More-tab row
 * (`"4 people · dinners sharing"`) and other compact surfaces.
 */
export function sharingPresetShortLabel(preset: HouseholdSharingPreset): string {
  switch (preset) {
    case "all":
      return "all meals sharing";
    case "dinners":
      return "dinners sharing";
    case "weekends":
      return "dinners + weekends";
    case "none":
      return "solo";
    case "custom":
    default:
      return "custom sharing";
  }
}

export const __test__ = {
  WEEKEND_DAYS,
};
