/**
 * Merge a server-fetched journal snapshot with in-memory local state.
 *
 * Preserves optimistic meals (ids present locally but not yet in the server
 * response) so a slow `loadJournal` / hydration pass cannot wipe a log the
 * user just committed while the fetch was in flight.
 */
export type JournalMealLike = { id: string };

export function mergeJournalByDay<T extends JournalMealLike>(
  server: Record<string, T[]>,
  local: Record<string, T[]>,
): Record<string, T[]> {
  const merged: Record<string, T[]> = {};
  const dayKeys = new Set([...Object.keys(server), ...Object.keys(local)]);

  for (const dayKey of dayKeys) {
    const serverMeals = server[dayKey] ?? [];
    const localMeals = local[dayKey] ?? [];
    const serverIds = new Set(serverMeals.map((m) => m.id));
    const pendingLocal = localMeals.filter((m) => !serverIds.has(m.id));

    if (serverMeals.length === 0 && pendingLocal.length === 0) {
      continue;
    }

    merged[dayKey] =
      pendingLocal.length > 0 ? [...serverMeals, ...pendingLocal] : [...serverMeals];
  }

  return merged;
}
