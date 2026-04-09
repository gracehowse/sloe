/** Shared Supabase client error heuristics for graceful degradation. */

export function looksLikeMissingTableError(message: string): boolean {
  const msg = message ?? "";
  return (
    msg.includes("Could not find the table") ||
    msg.toLowerCase().includes("schema cache") ||
    msg.toLowerCase().includes("does not exist")
  );
}

/** User-facing copy when cloud sync is unavailable but local state continues to work. */
export function syncDisabledBecauseSchemaMessage(thing: string): string {
  return `${thing}: using this device only for now (cloud sync isn’t set up yet). Nothing is lost—keep using the app; we’ll sync when the backend is ready.`;
}

/** Generic save/sync failure with an explicit “data is still local” reassurance. */
export function syncFailedRetryMessage(thing: string, technical?: string): string {
  const detail = technical?.trim() ? ` ${technical.trim()}` : "";
  return `Couldn’t sync ${thing} to the cloud.${detail} Your latest changes are still on this device—check your connection and try again.`;
}
