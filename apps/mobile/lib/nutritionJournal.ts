/** Matches web `LoggedMeal` / `nutrition_journals.by_day` JSON shape. */
export type JournalMeal = {
  id: string;
  name: string;
  recipeTitle: string;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
  waterMl?: number;
};

export type ByDay = Record<string, JournalMeal[]>;

export function dateKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

export function newMealId(): string {
  return `meal_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
