/**
 * ENG-1247 / ENG-1274 — v3 recipe-detail hero meta row (time · kcal · serves · cost).
 * Extracted from `RecipeDetail.tsx` so the screen line-budget pin does not grow.
 */
import { Icons } from "../ui/icons";
import { RecipeHeroCostEstimate } from "./RecipeHeroCostEstimate";

type IngredientLine = {
  name: string;
  amount: string;
  unit?: string | null;
};

type Props = {
  prepMin: number | null | undefined;
  cookMin: number | null | undefined;
  kcal: number;
  servings: number;
  ingredients: readonly IngredientLine[];
  baseServings: number;
  isPro: boolean;
  onUpgrade?: () => void;
};

export function RecipeHeroMetaRow({
  prepMin,
  cookMin,
  kcal,
  servings,
  ingredients,
  baseServings,
  isPro,
  onUpgrade,
}: Props) {
  const totalMin = (prepMin ?? 0) + (cookMin ?? 0);
  const roundedKcal = Math.round(kcal);

  return (
    <div className="flex flex-wrap items-center gap-4 text-[13px] font-medium text-white/90">
      <span className="inline-flex items-center gap-1">
        <Icons.timer className="w-3.5 h-3.5" aria-hidden />
        {totalMin > 0 ? `${totalMin} min` : "—"}
      </span>
      {roundedKcal > 0 ? (
        <span className="inline-flex items-center gap-1">
          <Icons.calories className="w-3.5 h-3.5" aria-hidden />
          {roundedKcal} kcal
        </span>
      ) : null}
      <span className="inline-flex items-center gap-1">
        <Icons.dinner className="w-3.5 h-3.5" aria-hidden />
        Serves {servings}
      </span>
      <RecipeHeroCostEstimate
        ingredients={ingredients}
        servings={servings}
        baseServings={baseServings}
        isPro={isPro}
        onUpgrade={onUpgrade}
      />
    </div>
  );
}
