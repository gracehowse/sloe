/** Shared Supabase client error heuristics for graceful degradation. */

export function looksLikeMissingTableError(message: string): boolean {
  const msg = message ?? "";
  return (
    msg.includes("Could not find the table") ||
    msg.toLowerCase().includes("schema cache") ||
    msg.toLowerCase().includes("does not exist")
  );
}
