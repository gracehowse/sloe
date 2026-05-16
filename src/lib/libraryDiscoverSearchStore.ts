/**
 * Shared search-query state for the Library + Discover surfaces on web.
 *
 * Background (ENG-53, 2026-05-16): Library (`src/app/components/Library.tsx`)
 * and DiscoverFeed (`src/app/components/DiscoverFeed.tsx`) are sibling
 * views rendered from `App.tsx` and toggled via a view-name router. Each
 * previously owned its own `useState("")` for the search field, so typing
 * in Library and switching to Discover wiped the query (and vice versa).
 *
 * Mirrors the mobile-side fix in `apps/mobile/hooks/useLibrarySearchStore.ts`
 * (same date, same issue). Lightest-possible architecture: a module-scoped
 * store backed by `useSyncExternalStore`. No context provider, no App.tsx
 * state-lifting — both surfaces simply read/write the same `query` and the
 * value survives view switches.
 *
 * Lifetime: app session. Resets on full reload. Search-as-you-type is
 * transient UI state, not a saved preference, so no localStorage backing.
 *
 * Re-render contract: any component subscribed via `useLibraryDiscoverSearch()`
 * re-renders when `setQuery` is called. React 19 / strict-mode safe via
 * `useSyncExternalStore`.
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

export function useLibraryDiscoverSearch(): {
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

/** Test-only reset — see mobile counterpart for rationale. */
export function __resetLibraryDiscoverSearchForTests(): void {
  query = "";
  listeners.forEach((l) => l());
}
