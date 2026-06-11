/**
 * Plan-generation source selection (ENG-790).
 *
 * Users choose where a generated plan draws recipes from:
 *  - `library`               → only their saved library
 *  - `library_and_discovery` → their library plus Suppr's discover pool
 *  - `discovery`             → only Suppr's discover pool
 *
 * This module is the single parity anchor for that choice. Both platforms
 * build the same two pools (library, discover) then call `selectPlanPool`
 * to flatten them into the one pool the plan algos already accept, and
 * `canGenerateFromSource` to decide whether the generate action is allowed.
 * Reachable as `@suppr/shared/planning/planSource` (mobile) and
 * `@/lib/planning/planSource` (web).
 */

export type PlanSourceMode = "library" | "library_and_discovery" | "discovery";

export const PLAN_SOURCE_MODES: readonly PlanSourceMode[] = [
  "library",
  "library_and_discovery",
  "discovery",
];

/**
 * Default when the selector first renders. `library_and_discovery` is the
 * broadest pool, so it is the safest "just generate me something good"
 * default and matches mobile's pre-ENG-790 saved+discover behaviour.
 */
export const DEFAULT_PLAN_SOURCE_MODE: PlanSourceMode = "library_and_discovery";

export interface PlanSourceRowMeta {
  /** Row title — also the canonical short label for the mode. */
  title: string;
  /** Subtitle shown when the row's pool has recipes. */
  subtitle: string;
  /** Subtitle shown when the row's pool is empty (e.g. 0 saved). */
  emptySubtitle: string;
}

/**
 * Copy for the three "Plan from" selector rows. Lives here (not inline in
 * each platform's component) so the web and mobile selectors can't drift
 * apart on wording — every string the user reads in this control is pinned
 * once. Both `PlanSourceSelector` components render straight off this map.
 */
export const PLAN_SOURCE_ROW_META: Record<PlanSourceMode, PlanSourceRowMeta> = {
  library: {
    title: "My library",
    subtitle: "Only recipes you've saved",
    emptySubtitle: "Save a recipe to use this",
  },
  library_and_discovery: {
    title: "Library & discovery",
    subtitle: "Your saves plus Sloe's recipe picks",
    emptySubtitle: "Sloe's recipe picks",
  },
  discovery: {
    title: "Discovery only",
    subtitle: "Just Sloe's recipes",
    emptySubtitle: "Just Sloe's recipes",
  },
};

export function planSourceLabel(mode: PlanSourceMode): string {
  return PLAN_SOURCE_ROW_META[mode].title;
}

/**
 * How many recipes the chosen source draws from, for the row count badge.
 * Callers must pass a `discoverCount` already de-duped against the library
 * so the combined total doesn't double-count a saved-and-discoverable
 * recipe (mirrors `selectPlanPool`'s de-dupe).
 */
export function planSourceCount(
  mode: PlanSourceMode,
  counts: { libraryCount: number; discoverCount: number },
): number {
  switch (mode) {
    case "library":
      return counts.libraryCount;
    case "discovery":
      return counts.discoverCount;
    case "library_and_discovery":
      return counts.libraryCount + counts.discoverCount;
  }
}

export function isPlanSourceMode(value: unknown): value is PlanSourceMode {
  return (
    typeof value === "string" &&
    (PLAN_SOURCE_MODES as readonly string[]).includes(value)
  );
}

/**
 * Flatten the two recipe pools into the single pool the plan algos accept,
 * honouring the chosen source mode. In combined mode discover recipes that
 * are already in the library are dropped so a saved recipe can't appear
 * twice in the candidate pool (mobile already did this; web did not — this
 * unifies the behaviour).
 */
export function selectPlanPool<T extends { id: string }>(
  mode: PlanSourceMode,
  pools: { library: readonly T[]; discover: readonly T[] },
): T[] {
  switch (mode) {
    case "library":
      return [...pools.library];
    case "discovery":
      return [...pools.discover];
    case "library_and_discovery": {
      const libraryIds = new Set(pools.library.map((r) => r.id));
      return [
        ...pools.library,
        ...pools.discover.filter((r) => !libraryIds.has(r.id)),
      ];
    }
  }
}

/**
 * Whether generation is allowed for the chosen source given how many
 * recipes each pool holds. A plan needs at least one recipe in whichever
 * pool(s) the mode draws from.
 */
export function canGenerateFromSource(
  mode: PlanSourceMode,
  counts: { libraryCount: number; discoverCount: number },
): boolean {
  switch (mode) {
    case "library":
      return counts.libraryCount > 0;
    case "discovery":
      return counts.discoverCount > 0;
    case "library_and_discovery":
      return counts.libraryCount + counts.discoverCount > 0;
  }
}
