import * as React from "react";

/**
 * MacroTotalGrid — the v3 `.md-totalgrid`: a 4-cell macro summary
 * (Protein / Carbs / Fat / Fibre) for the meal-nutrition dialog. Each cell is a
 * recessed-grey card with a macro dot, a serif gram value, and an uppercase
 * label; when `onMacroTap` is supplied the cell becomes a button that opens the
 * day's macro-detail breakdown (`MacroDetailPanel`, the ENG-1213 screen —
 * protein/carbs/fat/fiber are all interactive keys). Prototype:
 * `docs/ux/redesign/v3/Sloe-App.html` `.md-totalgrid` / `.md-totalcell`.
 *
 * Fibre is REAL data (`mealContributedFiberG`), not the prototype's
 * `carbs × 0.13` placeholder — we never guess nutrition. Because Fibre now leads
 * here, the dialog stops injecting it into the micro table (no double-show).
 * Parity twin: `apps/mobile/components/meal/MacroTotalGrid.tsx`.
 */
export type MacroTotalKey = "protein" | "carbs" | "fat" | "fiber";

export interface MacroTotalCell {
  key: MacroTotalKey;
  /** Display label — `"Fibre"` (UK), not the route key `"fiber"`. */
  label: string;
  grams: number;
  /** CSS var for the macro dot, e.g. `var(--macro-protein)`. */
  cssVar: string;
}

export function MacroTotalGrid({
  cells,
  onMacroTap,
}: {
  cells: MacroTotalCell[];
  onMacroTap?: (macro: MacroTotalKey) => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-4 gap-2" data-testid="meal-nutrition-macro-grid">
      {cells.map((c) => {
        const grams = Math.round(c.grams * 10) / 10;
        const inner = (
          <>
            <span
              aria-hidden
              className="mb-1.5 inline-block h-[9px] w-[9px] rounded-full"
              style={{ backgroundColor: c.cssVar }}
            />
            <span className="block font-headline text-[24px] leading-none tabular-nums text-foreground">
              {grams}
              <span className="ml-px text-[13px] text-foreground-tertiary">g</span>
            </span>
            <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.04em] text-foreground-tertiary">
              {c.label}
            </span>
          </>
        );
        const base = "rounded-xl bg-[var(--background-secondary)] px-2 py-3 text-center";
        return onMacroTap ? (
          <button
            key={c.key}
            type="button"
            onClick={() => onMacroTap(c.key)}
            aria-label={`${c.label} ${grams} grams — open breakdown`}
            className={`${base} transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
          >
            {inner}
          </button>
        ) : (
          <div key={c.key} className={base}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

export default MacroTotalGrid;
