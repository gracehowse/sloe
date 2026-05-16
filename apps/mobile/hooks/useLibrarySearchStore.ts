/**
 * Shared search-query state for the Library + Discover tabs.
 *
 * Background (ENG-53, 2026-05-16): Library and Discover are
 * sibling tab routes under `(tabs)/`. Each previously owned its
 * own `useState("")` for the search field, so typing in one tab
 * and switching to the other wiped the query — bad enough by
 * itself, but it also signals "two unrelated searches" to the
 * user when conceptually they want one persistent search across
 * "all my saved + all the catalogue".
 *
 * This is the lightest possible fix: a module-scoped store backed
 * by `useSyncExternalStore`. No context provider, no layout
 * change — Library and Discover both read/write the same `query`,
 * which persists for the lifetime of the app session (resets on
 * cold start; not stored in AsyncStorage — search-as-you-type is
 * a transient UI state, not a saved preference).
 *
 * Re-render contract: any component subscribed via
 * `useLibrarySearchStore()` re-renders when `setQuery` is called.
 * React 19 / strict-mode safe via `useSyncExternalStore`.
 */
import { useSyncExternalStore } from "react";

let query = "";
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): string {
  return query;
}

export function useLibrarySearchStore(): {
  query: string;
  setQuery: (next: string) => void;
} {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    query: current,
    setQuery: (next: string) => {
      query = next;
      listeners.forEach((l) => l());
    },
  };
}

/**
 * Test-only reset hook so unit tests start from a known state.
 * Not exported as a regular API to avoid app code clearing the
 * search by accident.
 */
export function __resetLibrarySearchStoreForTests(): void {
  query = "";
  listeners.forEach((l) => l());
}
