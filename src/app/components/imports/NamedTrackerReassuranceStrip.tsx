"use client";

import { namedTrackerReassuranceItems } from "@/lib/imports/namedTrackerReassurance";

/** ENG-1258 — lightweight supported-tracker strip (B18 option C). */
export function NamedTrackerReassuranceStrip({
  testID = "mfp-tracker-reassurance-strip",
}: {
  testID?: string;
}) {
  const items = namedTrackerReassuranceItems();

  return (
    <div className="mt-3" data-testid={testID}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Supported exports
      </p>
      <div className="flex flex-wrap gap-2" role="list">
        {items.map((item) => (
          <div
            key={item.id}
            role="listitem"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1"
          >
            <span
              aria-hidden
              className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary"
            >
              {item.mark}
            </span>
            <span className="text-xs font-medium text-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default NamedTrackerReassuranceStrip;
