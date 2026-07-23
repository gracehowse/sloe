import type { SearchResult } from "./FoodSearchPanel";

export const STORY_USDA_SEARCH_RESULT: SearchResult = {
  key: "usda-chicken",
  name: "Chicken breast, grilled",
  calsPer100g: 165,
  macrosPer100g: {
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    fiberG: 0,
    sugarG: 0,
    sodiumMg: 74,
  },
  confidenceTier: "verified",
  verified: true,
  _source: "USDA",
  _fdcId: 171477,
  primaryServing: {
    label: "100 g",
    grams: 100,
    kcal: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
  },
};

export const STORY_OFF_SEARCH_RESULT: SearchResult = {
  key: "off-yoghurt",
  name: "Greek yoghurt, plain",
  subtitle: "Fage",
  calsPer100g: 97,
  macrosPer100g: {
    calories: 97,
    protein: 9,
    carbs: 3.6,
    fat: 5,
    fiberG: 0,
    sugarG: 3.6,
    sodiumMg: 36,
  },
  confidenceTier: "estimated",
  _source: "OFF",
  _offCode: "123456789",
  primaryServing: {
    label: "170 g pot",
    grams: 170,
    kcal: 165,
    protein: 15.3,
    carbs: 6.1,
    fat: 8.5,
  },
};
