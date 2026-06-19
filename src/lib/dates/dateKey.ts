/**
 * Format a Date as the app's local-calendar journal key (`YYYY-MM-DD`).
 *
 * This intentionally uses the runtime's local calendar fields rather than
 * `toISOString()` so day keys match the date the user selected on web and iOS.
 */
export function dateKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}
