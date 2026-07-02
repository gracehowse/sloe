export const FREE_SAVE_LIMIT = 10;

// DEFAULT_UPLOADED_RECIPE_IMAGE was deleted in ENG-1287 (2026-07-01): a
// recipe with no image now keeps `image: null` instead of borrowing a stock
// Unsplash photo. The retired URL lives on only in
// `RETIRED_STOCK_IMAGE_URLS` (src/lib/recipes/heroImageFallback.ts) so
// legacy DB rows that persisted it are treated as image-less.
