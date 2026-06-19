/**
 * ENG-898 — recent imports list on the import idle surface (web).
 */
import type { RecentImportItem } from "../../../lib/recipes/recentImports.ts";
import { recentImportMonogram } from "../../../lib/recipes/recentImports.ts";

export interface ImportRecentImportsProps {
  items: RecentImportItem[];
}

export function ImportRecentImports({ items }: ImportRecentImportsProps) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="import-recent-imports">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Recent imports
      </p>
      <ul className="space-y-2">
        {items.map((item, idx) => (
          <li
            key={`${item.name}-${item.time}-${idx}`}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
          >
            <span
              aria-hidden
              className="inline-flex h-6 min-w-[2rem] items-center justify-center rounded-md border border-border px-2 text-[10px] font-bold text-foreground"
            >
              {recentImportMonogram(item.source)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
              <p className="text-xs text-muted-foreground">{item.time}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
