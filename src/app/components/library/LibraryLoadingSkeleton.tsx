"use client";

import { Skeleton } from "../ui/skeleton.tsx";

/**
 * Library cold-load skeleton — web mirror of the mobile
 * `LibraryLoadingSkeleton` (Figma `527:2` 2-column grid silhouette).
 * Rendered by `Library` while `libraryDataReady` is false and the
 * composed list is still empty (ENG-1313) — the loading state IS the
 * Library, never a redirect.
 */
export function LibraryLoadingSkeleton() {
  return (
    <div
      role="progressbar"
      aria-label="Loading your recipes"
      data-testid="library-loading-skeleton"
      className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-4"
    >
      <Skeleton className="h-10 w-full max-w-md rounded-full" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="aspect-[4/3] w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
