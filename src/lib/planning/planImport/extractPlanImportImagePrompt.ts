/** Vision prompt — extract raw plan text from a photo or screenshot. */

export function buildPlanImportImageExtractPrompt(): string {
  return `You are OCR for a meal-plan import. Extract ALL readable text from this image exactly as written.

Include:
- Weekly schedule / day rows with meal names
- Recipe titles, serves, ingredients, method
- Nutrition panels (kcal, protein, carbs, fat, fibre) when visible

Rules:
- Return plain text only — no JSON, no markdown fences, no commentary
- Preserve line breaks between sections
- If multiple recipe pages are visible, separate with a blank line
- Do not invent missing text — transcribe only what you can read`;
}
