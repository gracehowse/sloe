/**
 * Discover / Library recipe hero fallback.
 *
 * When a recipe has no image we render a deterministic
 * cuisine-aware gradient + pattern + glyph fallback instead of a
 * flat tint. Implementation of D8 (see
 * `docs/design/discover-hero-fallback.md`).
 *
 * The function is platform-agnostic on purpose: it returns the
 * gradient stops, glyph name, pattern name, and the alpha colour
 * for the pattern/glyph (white-alpha on dark buckets, black-alpha
 * on the two light buckets). Mobile (`react-native-svg`) and web
 * (inline SVG) both consume the same output so the same recipe id
 * renders identically on both platforms.
 *
 * Do NOT network-fetch, do NOT cache by ref — this is pure and
 * sync.
 */

export type RecipeHeroBucket =
  | "greens"
  | "reds"
  | "blues"
  | "warms"
  | "ambers"
  | "earths"
  | "neutrals"
  | "default";

export type RecipeHeroGlyph =
  | "Salad"
  | "Beef"
  | "Fish"
  | "Pizza"
  | "Cookie"
  | "Soup"
  | "Wheat"
  | "Utensils";

export type RecipeHeroPattern = "dots" | "grid" | "chevron" | "circles";

export interface RecipeHeroFallback {
  bucket: RecipeHeroBucket;
  gradientStart: string;
  gradientEnd: string;
  glyph: RecipeHeroGlyph;
  pattern: RecipeHeroPattern;
  /**
   * Colour used for both the pattern strokes/fills and the centre
   * glyph. `rgba(255,255,255,...)` on the dark buckets,
   * `rgba(0,0,0,...)` on ambers + neutrals (where a dark mark
   * reads better against the warm light gradient).
   */
  patternColor: string;
  glyphColor: string;
  /** Alpha 0–1 used for the pattern shapes. 0.06 everywhere. */
  patternAlpha: number;
  /** Alpha 0–1 used for the centre glyph. 0.55 everywhere. */
  glyphAlpha: number;
}

interface BucketSpec {
  key: RecipeHeroBucket;
  triggers: readonly string[];
  start: string;
  end: string;
  glyph: RecipeHeroGlyph;
  light: boolean;
}

/**
 * Ordered list — first match wins. The `default` bucket sits at
 * the end with no triggers and acts as the catch-all so no recipe
 * ever falls through to a blank card.
 */
const BUCKETS: readonly BucketSpec[] = [
  {
    key: "greens",
    triggers: ["vegan", "vegetarian", "salad", "bowl", "green", "kale", "spinach"],
    start: "#5A8A60",
    end: "#2F5A3A",
    glyph: "Salad",
    light: false,
  },
  {
    key: "reds",
    triggers: ["beef", "steak", "bbq", "grill", "burger", "chilli", "pepperoni"],
    start: "#A24A3E",
    end: "#5C2321",
    glyph: "Beef",
    light: false,
  },
  {
    key: "blues",
    triggers: ["fish", "seafood", "tuna", "salmon", "prawn", "pescatarian"],
    start: "#3C6A8F",
    end: "#1E3A58",
    glyph: "Fish",
    light: false,
  },
  {
    key: "warms",
    triggers: ["pasta", "pizza", "italian", "tomato", "mediterranean"],
    start: "#B8693A",
    end: "#6A2F18",
    glyph: "Pizza",
    light: false,
  },
  {
    key: "ambers",
    triggers: ["baked", "dessert", "cookie", "cake", "sweet", "breakfast"],
    start: "#B08848",
    end: "#6A4820",
    glyph: "Cookie",
    light: true,
  },
  {
    key: "earths",
    triggers: ["soup", "stew", "curry", "broth", "asian", "noodle"],
    start: "#7A5A3A",
    end: "#3A2A18",
    glyph: "Soup",
    light: false,
  },
  {
    key: "neutrals",
    triggers: ["bread", "grain", "rice", "oats", "cereal", "wheat"],
    start: "#7A6A4A",
    end: "#3E342A",
    glyph: "Wheat",
    light: true,
  },
  {
    key: "default",
    triggers: [],
    start: "#4C6CE0",
    end: "#E04888",
    glyph: "Utensils",
    light: false,
  },
];

const PATTERNS: readonly RecipeHeroPattern[] = ["dots", "grid", "chevron", "circles"];

/**
 * djb2 hash (Bernstein). Fast, deterministic, and stable across
 * JS runtimes. Returns an unsigned 32-bit int.
 */
export function djb2(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    // `hash * 33 + c`
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export interface RecipeHeroInput {
  id: string;
  title?: string | null;
  tags?: readonly string[] | null;
}

function resolveBucket(input: RecipeHeroInput): BucketSpec {
  const title = (input.title ?? "").toLowerCase();
  const tags = (input.tags ?? []).map((t) => (t ?? "").toLowerCase());
  const hay = [title, ...tags].join(" ");
  if (hay.trim().length === 0) {
    return BUCKETS[BUCKETS.length - 1]; // default
  }
  for (const b of BUCKETS) {
    if (b.triggers.length === 0) continue;
    for (const trigger of b.triggers) {
      if (hay.includes(trigger)) return b;
    }
  }
  return BUCKETS[BUCKETS.length - 1];
}

export function getRecipeFallback(input: RecipeHeroInput): RecipeHeroFallback {
  const bucket = resolveBucket(input);
  const patternIdx = djb2(input.id) % PATTERNS.length;
  const pattern = PATTERNS[patternIdx];
  const rgba = bucket.light ? "0, 0, 0" : "255, 255, 255";
  const patternAlpha = 0.06;
  const glyphAlpha = 0.55;
  return {
    bucket: bucket.key,
    gradientStart: bucket.start,
    gradientEnd: bucket.end,
    glyph: bucket.glyph,
    pattern,
    patternColor: `rgba(${rgba}, ${patternAlpha})`,
    glyphColor: `rgba(${rgba}, ${glyphAlpha})`,
    patternAlpha,
    glyphAlpha,
  };
}

/**
 * Raw SVG snippets for the 4 pattern tiles (24×24). Used by the
 * web renderer; mobile renders equivalent shapes with
 * `react-native-svg` primitives so both paths emit the same
 * visual. Kept as inline strings for the web path per §4 of the
 * brief (each under 200 bytes).
 */
export function patternSvgContent(pattern: RecipeHeroPattern, stroke: string): string {
  switch (pattern) {
    case "dots":
      return `<circle cx="12" cy="12" r="1.5" fill="${stroke}"/>`;
    case "grid":
      return `<path d="M12 7v10 M7 12h10" stroke="${stroke}" stroke-width="1" stroke-linecap="round"/>`;
    case "chevron":
      return `<path d="M4 16l8-6 8 6" fill="none" stroke="${stroke}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "circles":
      return `<circle cx="12" cy="12" r="5" fill="none" stroke="${stroke}" stroke-width="1"/>`;
  }
}
