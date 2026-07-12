/**
 * ENG-1502 (extraction pass, screen-budget ratchet ENG-621/717) — the
 * food-search quantity parser, lifted byte-for-byte out of
 * `apps/mobile/components/food-search/FoodSearchPanel.tsx`. Accepts plain
 * decimals ("1.5"), bare fractions ("1/2"), and mixed numbers ("1 1/2");
 * anything unparseable → 0 (the preview treats 0 as "no quantity yet").
 */
export function parseQuantityText(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  const fracMatch = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fracMatch) {
    const num = parseInt(fracMatch[1], 10);
    const den = parseInt(fracMatch[2], 10);
    if (den > 0) return num / den;
  }
  const mixedMatch = t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const num = parseInt(mixedMatch[2], 10);
    const den = parseInt(mixedMatch[3], 10);
    if (den > 0) return whole + num / den;
  }
  const n = parseFloat(t);
  return isNaN(n) ? 0 : n;
}
