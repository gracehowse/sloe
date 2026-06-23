const COLLECTIONS_KEY = "suppr-collections-v1";

export type CollectionRow = { id: string; name: string; recipeIds: string[] };

/** Read the user's saved recipe collections from localStorage (browser-only). */
export function loadCollections(): CollectionRow[] {
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CollectionRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Persist the user's recipe collections to localStorage. */
export function saveCollections(rows: CollectionRow[]) {
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(rows));
}
