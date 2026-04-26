/**
 * F-85 (2026-04-25) — recipe titles imported from blogs / social often
 * arrive in ALL CAPS ("HEALTHY 3 INGREDIENT WHIPPED PISTACHIO TIRAMISU").
 * The all-caps render reads as shouty / amateur and competes with the
 * navbar for the eye (ui-critic 2026-04-25). This helper renders titles
 * in title case while preserving:
 *
 *  - acronyms ≤ 3 letters that look intentional (PB, AIP, UK, BBQ),
 *  - numbers and units (3, 5g, 30-min),
 *  - mid-word punctuation (e.g. "M&M's", "Mac 'n' Cheese").
 *
 * Pure function — safe at the display layer (do not rewrite the stored
 * title, which the user may want to keep verbatim from the source).
 */

const SHORT_LOWERCASE_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into",
  "of", "on", "or", "the", "to", "with", "vs", "via",
]);

const PROTECTED_ACRONYMS = new Set([
  "PB", "BBQ", "AIP", "UK", "EU", "US", "USA", "DIY", "PB&J",
  "GF", "DF", "VG", "AM", "PM", "TBSP", "TSP", "OZ", "ML",
]);

/** Capitalise the first letter and lowercase the rest; preserve digits. */
function titleCaseWord(word: string, isFirstOrLast: boolean): string {
  if (!word) return word;

  // Preserve protected acronyms verbatim (case-insensitive match).
  const upper = word.toUpperCase();
  if (PROTECTED_ACRONYMS.has(upper)) return upper;

  // Mid-string punctuation/digits: capitalise each alphabetic segment.
  // Handles "M&M's", "30-min", "3-ingredient".
  if (/[^A-Za-z]/.test(word)) {
    return word
      .split(/([^A-Za-z]+)/)
      .map((seg) => (/[A-Za-z]/.test(seg) ? capitaliseFirst(seg) : seg))
      .join("");
  }

  // Articles / prepositions / conjunctions stay lowercase unless first or last.
  if (!isFirstOrLast && SHORT_LOWERCASE_WORDS.has(word.toLowerCase())) {
    return word.toLowerCase();
  }

  return capitaliseFirst(word);
}

function capitaliseFirst(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Normalise a recipe title for display.
 *
 * Returns the input unchanged when it already has mixed case (i.e. the
 * source author already title-cased it). Only acts when the title is
 * predominantly uppercase (>= 70% of alphabetic chars are uppercase),
 * which catches "ALL CAPS" and "MOSTLY CAPS WITH numbers" without
 * touching legitimate stylistic mixed case.
 */
export function normaliseRecipeDisplayTitle(raw: string): string {
  if (!raw) return raw;
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const letters = trimmed.replace(/[^A-Za-z]/g, "");
  if (letters.length < 4) return trimmed;
  const upper = trimmed.replace(/[^A-Z]/g, "").length;
  const upperRatio = upper / letters.length;
  if (upperRatio < 0.7) return trimmed;

  const words = trimmed.split(/(\s+)/);
  const lastNonSpaceIdx = (() => {
    for (let i = words.length - 1; i >= 0; i--) {
      if (words[i].trim()) return i;
    }
    return -1;
  })();

  return words
    .map((w, i) => {
      if (!w.trim()) return w;
      const isFirst = i === 0;
      const isLast = i === lastNonSpaceIdx;
      return titleCaseWord(w, isFirst || isLast);
    })
    .join("");
}
