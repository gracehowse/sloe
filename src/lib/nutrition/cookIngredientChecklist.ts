/**
 * ENG-946 — in-memory per-recipe cook-session ingredient checklist.
 * Checked state is local to the app session (not persisted across restarts)
 * and shared between recipe detail + cook mode for the same recipe.
 */

const EMPTY = new Set<number>();

/** Per-recipe checked ingredient indices (0-based). */
const sessions = new Map<string, Set<number>>();

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

export function cookIngredientChecklistKey(recipeId: string): string {
  const trimmed = recipeId.trim();
  return trimmed.length > 0 ? trimmed : "unknown";
}

export function getCookIngredientCheckedSet(recipeId: string): ReadonlySet<number> {
  return sessions.get(cookIngredientChecklistKey(recipeId)) ?? EMPTY;
}

/** Toggle one ingredient row. Returns the new checked state. */
export function toggleCookIngredientChecked(
  recipeId: string,
  index: number,
): boolean {
  if (index < 0) return false;
  const key = cookIngredientChecklistKey(recipeId);
  const next = new Set(sessions.get(key) ?? []);
  const checked = !next.has(index);
  if (checked) next.add(index);
  else next.delete(index);
  sessions.set(key, next);
  notify(key);
  return checked;
}

export function isCookIngredientChecked(recipeId: string, index: number): boolean {
  return getCookIngredientCheckedSet(recipeId).has(index);
}

export function clearCookIngredientChecklist(recipeId: string): void {
  const key = cookIngredientChecklistKey(recipeId);
  if (!sessions.has(key)) return;
  sessions.delete(key);
  notify(key);
}

export function subscribeCookIngredientChecklist(
  recipeId: string,
  listener: Listener,
): () => void {
  const key = cookIngredientChecklistKey(recipeId);
  const set = listeners.get(key) ?? new Set();
  set.add(listener);
  listeners.set(key, set);
  return () => {
    const current = listeners.get(key);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) listeners.delete(key);
  };
}

function notify(key: string): void {
  const set = listeners.get(key);
  if (!set) return;
  for (const listener of set) listener();
}
