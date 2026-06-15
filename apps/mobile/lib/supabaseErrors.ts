/** Match web `src/context/appData/supabaseErrors.ts` for journal fallback behaviour. */

export function syncFailedRetryMessage(thing: string, technical?: string): string {
  const detail = technical?.trim() ? ` ${technical.trim()}` : "";
  return `Couldn't sync ${thing} to the cloud.${detail} Your latest changes are still on this device—check your connection and try again.`;
}

export function looksLikeMissingTableError(message: string): boolean {
  const msg = message ?? "";
  return (
    msg.includes("Could not find the table") ||
    msg.toLowerCase().includes("schema cache") ||
    msg.toLowerCase().includes("does not exist")
  );
}
