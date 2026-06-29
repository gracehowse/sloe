/**
 * ENG-1258 (B18) — named-tracker reassurance strip data.
 *
 * Grace ratified option C (2026-06-28): lightweight "Supported: …" strip
 * on the MFP CSV import card — not the full prototype source grid.
 * Labels come from the live adapter registry so the strip never lies.
 */
import { REGISTERED_ADAPTERS } from "./csv/adapters/registry";

export interface NamedTrackerReassuranceItem {
  id: string;
  label: string;
  /** Single-letter tile mark (first grapheme of display name). */
  mark: string;
}

export function namedTrackerReassuranceItems(): NamedTrackerReassuranceItem[] {
  return REGISTERED_ADAPTERS.map((adapter) => ({
    id: adapter.source,
    label: adapter.displayName,
    mark: adapter.displayName.trim().charAt(0).toUpperCase() || "?",
  }));
}
