/**
 * ConfirmFood macro preview layout (ENG-1257 / A2b mix).
 *
 * Prototype: Sloe-App.html `ConfirmFood` — 3-tile P/C/F row + serif kcal line,
 * with richer micro rows kept below (Grace 2026-06-28).
 */
export interface ConfirmFoodMacroTile {
  key: "protein" | "carbs" | "fat";
  label: string;
  valueG: number;
  dotToken: "--macro-protein" | "--macro-carbs" | "--macro-fat";
}

export function confirmFoodMacroTiles(input: {
  proteinG: number;
  carbsG: number;
  fatG: number;
}): ConfirmFoodMacroTile[] {
  return [
    {
      key: "protein",
      label: "Protein",
      valueG: input.proteinG,
      dotToken: "--macro-protein",
    },
    {
      key: "carbs",
      label: "Carbs",
      valueG: input.carbsG,
      dotToken: "--macro-carbs",
    },
    {
      key: "fat",
      label: "Fat",
      valueG: input.fatG,
      dotToken: "--macro-fat",
    },
  ];
}
