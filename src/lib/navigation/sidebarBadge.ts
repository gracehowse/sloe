/**
 * Sidebar / sub-tab badge display — keep counts subtle at scale.
 * Shows exact count 1–9; a dot when 10+ so "99+" never dominates the IA.
 */
export function formatSidebarBadge(count: number): { show: boolean; label: string } {
  if (count <= 0) return { show: false, label: "" };
  if (count <= 9) return { show: true, label: String(count) };
  return { show: true, label: "•" };
}
