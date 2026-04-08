export type MeasureInput = {
  name: string;
  amount: number;
  unit: string;
  /** g per ml (oils differ); defaults to 1 */
  gPerMl?: number;
};

const COUNT_WEIGHT_G: Record<string, number> = {
  clove: 4,
  sprig: 2,
  rasher: 28,
  slice: 25,
  stalk: 40,
  medium: 110,
  large: 180,
  small: 80,
  pinch: 0.3,
  egg: 50,
};

const ML_PER_TBSP = 14.7868;
const ML_PER_TSP = 4.92892;
const ML_PER_CUP_US = 236.588;

export function measureToGrams(input: MeasureInput): number {
  const name = input.name.trim().toLowerCase();
  const amt = Number.isFinite(input.amount) && input.amount > 0 ? input.amount : 1;
  const u = input.unit.trim().toLowerCase();
  const gPerMl = input.gPerMl ?? 1;

  if (u === "tbsp") return amt * ML_PER_TBSP * gPerMl;
  if (u === "tsp") return amt * ML_PER_TSP * gPerMl;
  if (u === "cup") return amt * ML_PER_CUP_US * (input.gPerMl ?? 0.55);

  if (u === "g") return amt;
  if (u === "kg") return amt * 1000;
  if (u === "ml") return amt * gPerMl;
  if (u === "l") return amt * 1000 * gPerMl;
  if (u === "fl oz" || u === "floz") return amt * 29.5735 * gPerMl;
  if (u === "oz") return amt * 28.3495;
  if (u === "lb") return amt * 453.592;

  if (u === "clove") return amt * COUNT_WEIGHT_G.clove;
  if (u === "sprig") return amt * COUNT_WEIGHT_G.sprig;
  if (u === "rasher") return amt * COUNT_WEIGHT_G.rasher;
  if (u === "slice") return amt * COUNT_WEIGHT_G.slice;
  if (u === "stalk") return amt * COUNT_WEIGHT_G.stalk;
  if (u === "medium") return amt * COUNT_WEIGHT_G.medium;
  if (u === "large") return amt * COUNT_WEIGHT_G.large;
  if (u === "small") return amt * COUNT_WEIGHT_G.small;
  if (u === "pinch") return amt * COUNT_WEIGHT_G.pinch;
  if (u === "leaf") return amt * 0.35;
  if (u === "tin") return amt * (/tomato|plum|chopped|passata|marzano|diced/.test(name) ? 400 : 220);
  if (u === "pack") return amt * (/basil|herb|lettuce|salad|rocket|arugula|spinach/.test(name) ? 35 : 120);

  if (u === "count" || u === "" || u === "each") {
    if (/carrot|onion|potato|tomato|lemon|lime|egg|pepper|apple|banana/.test(name)) {
      const per = /egg/.test(name) ? COUNT_WEIGHT_G.egg : COUNT_WEIGHT_G.medium;
      return amt * per;
    }
    return amt * 80;
  }

  return amt * 50;
}

