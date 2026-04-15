/** One journal slot for all snacks; migrate legacy DB value `Snack` → `Snacks`. */
export function normalizeJournalSlotName(raw: string | null | undefined): string {
  const n = (raw ?? "").trim();
  return n === "Snack" ? "Snacks" : n;
}
