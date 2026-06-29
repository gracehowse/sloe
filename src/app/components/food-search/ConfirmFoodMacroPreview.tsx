"use client";

import { confirmFoodMacroTiles } from "@suppr/nutrition-core/confirmFoodMacroPreview";

export interface ConfirmFoodMacroPreviewProps {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** ENG-1257 — web twin of `apps/mobile/components/food-search/ConfirmFoodMacroPreview.tsx`. */
export function ConfirmFoodMacroPreview({
  calories,
  proteinG,
  carbsG,
  fatG,
}: ConfirmFoodMacroPreviewProps) {
  const tiles = confirmFoodMacroTiles({ proteinG, carbsG, fatG });
  return (
    <div className="space-y-4" data-testid="confirm-food-macro-preview">
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <div
            key={tile.key}
            className="flex flex-col items-center gap-1 rounded-xl border border-border px-2 py-3"
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: `var(${tile.dotToken})` }}
            />
            <span className="text-base font-bold tabular-nums text-foreground">{tile.valueG}g</span>
            <span className="text-[11px] text-foreground-tertiary">{tile.label}</span>
          </div>
        ))}
      </div>
      <p className="text-sm text-foreground">
        <span
          className="text-[26px] font-medium tabular-nums"
          style={{ fontFamily: "var(--font-headline)" }}
        >
          {calories}
        </span>{" "}
        kcal
      </p>
    </div>
  );
}

export default ConfirmFoodMacroPreview;
