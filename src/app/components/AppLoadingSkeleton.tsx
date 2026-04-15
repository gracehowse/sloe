import { Skeleton } from "./ui/skeleton.tsx";

/** Full-screen loading placeholder for auth / profile gates. */
export function AppLoadingSkeleton({ label }: { label?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-background">
      <div className="flex w-full max-w-md flex-col gap-3">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
      {label ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {label}
        </p>
      ) : null}
    </div>
  );
}
