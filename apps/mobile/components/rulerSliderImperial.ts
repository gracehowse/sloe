/** Helper: format total inches to "5′ 10″" for imperial height. */
export function formatImperialHeightInches(totalIn: number): string {
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return `${ft}′ ${inch}″`;
}

/**
 * Helper: parse common imperial height-entry shapes → total inches.
 * Mirror of the web helper at `src/app/components/suppr/ruler-slider.tsx`.
 */
export function parseImperialHeightInches(text: string): number {
  const trimmed = String(text).trim();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return parseFloat(trimmed);
  const both = trimmed.match(/^(\d+)\D+(\d+)/);
  if (both) {
    const ft = parseInt(both[1], 10);
    const inch = parseInt(both[2], 10);
    return ft * 12 + inch;
  }
  const ftOnly = trimmed.match(/^(\d+)\s*(?:ft|'|′)\b/i);
  if (ftOnly) return parseInt(ftOnly[1], 10) * 12;
  return parseFloat(trimmed);
}
