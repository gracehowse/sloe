/** System prompt for cookbook PDF import — recipes only (no weekly schedule). */

export function buildCookbookParsePrompt(text: string): string {
  return `You are parsing a cookbook or recipe collection for import into a nutrition app.

Extract every distinct recipe block from the source. Return ONLY a JSON object (no markdown fences):
{
  "bookName": "string or null",
  "recipes": [
    {
      "key": "cilantro-chicken-curry",
      "title": "Cilantro Chicken Curry",
      "serves": 4,
      "ingredients": ["500 g chicken breast", "1 can coconut milk"],
      "method": "optional steps",
      "prepMinutes": 10,
      "cookMinutes": 25,
      "tags": ["dinner"],
      "authorNutrition": { "calories": 291, "protein": 32, "carbs": 12, "fat": 14, "fiberG": 3 }
    }
  ]
}

Rules:
- Assign each recipe a stable \`key\` slug (lowercase, hyphenated from title)
- Ingredient lines must be as written in the book (quantity + unit + item when present)
- Include \`authorNutrition\` ONLY when kcal/macros are stated for a serving — do NOT invent nutrition
- Optional \`prepMinutes\`, \`cookMinutes\`, \`tags\` when visible in the source
- Skip index pages, shopping lists, and non-recipe prose
- Do not duplicate the same recipe under different keys

SOURCE TEXT:
"""
${text}
"""`;
}
