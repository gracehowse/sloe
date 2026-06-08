/**
 * Discover / Library recipe + ingredient image fallback.
 *
 * When a recipe (or ingredient tile) has no image we render a
 * deterministic cuisine-aware tile instead of a broken image or a
 * flat tint. Implementation of D8 (see
 * `docs/design/discover-hero-fallback.md`), reskinned 2026-06-08 to
 * the Sloe calm palette per `docs/ux/redesign/_design-system.md` §11.4.
 *
 * ── Sloe calm reskin (2026-06-08) ──────────────────────────────────
 * The old fallback used loud saturated gradients (the default bucket
 * was a blue→pink `#4C6CE0 → #E04888`). §11.4 of the design system
 * mandates a WARM fallback: a sage-to-cream gradient (`#7C8466` →
 * `#F6F5F2`) with a sage food glyph centred — calm and on-brand, never
 * a grey neutral placeholder and never a broken-image icon. Each
 * cuisine bucket now resolves to a soft cuisine-tinted cream that
 * settles into the card cream, with the glyph + pattern in sage. The
 * deterministic id-hash → pattern mapping and the cuisine → glyph
 * mapping are UNCHANGED, so the same recipe id renders the same stable
 * tile it always did — only the colours calmed down.
 * ────────────────────────────────────────────────────────────────────
 *
 * The function is platform-agnostic on purpose: it returns the
 * gradient stops, glyph name, pattern name, and the sage colour for
 * the pattern/glyph. Mobile (`react-native-svg`) and web (inline SVG)
 * both consume the same output so the same recipe id renders
 * identically on both platforms.
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
   * glyph. Sage `rgba(124, 132, 102, …)` on every bucket since the
   * 2026-06-08 calm reskin (§11.4) — the cream gradients all read with
   * a single sage mark, so there's no more dark-vs-light branch.
   */
  patternColor: string;
  glyphColor: string;
  /** Alpha 0–1 used for the pattern shapes. 0.07 (faint sage texture). */
  patternAlpha: number;
  /** Alpha 0–1 used for the centre glyph. 0.7 (clear sage on cream). */
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
 * Sloe calm palette (`_design-system.md` §11.4). Every bucket starts
 * from a soft cuisine-tinted cream and settles into the card cream
 * `#F6F5F2`. The cuisine tint is gentle — a hint of the food's family
 * (sage for greens, clay for reds/mediterranean, slate-sage for fish,
 * warm oat for baked/grains) — never a saturated hero colour. The
 * glyph + pattern render in sage `#7C8466` on top, per §11.4. `light`
 * is retained on the type for back-compat but no longer drives the
 * mark colour (sage reads on every cream tint).
 */
const CARD_CREAM = "#F6F5F2";

const BUCKETS: readonly BucketSpec[] = [
  {
    key: "greens",
    triggers: ["vegan", "vegetarian", "salad", "bowl", "green", "kale", "spinach"],
    start: "#DCE3D4", // soft sage cream
    end: CARD_CREAM,
    glyph: "Salad",
    light: true,
  },
  {
    key: "reds",
    triggers: ["beef", "steak", "bbq", "grill", "burger", "chilli", "pepperoni"],
    start: "#EBDAD0", // warm clay cream
    end: CARD_CREAM,
    glyph: "Beef",
    light: true,
  },
  {
    key: "blues",
    triggers: ["fish", "seafood", "tuna", "salmon", "prawn", "pescatarian"],
    start: "#D7E0DD", // cool slate-sage cream
    end: CARD_CREAM,
    glyph: "Fish",
    light: true,
  },
  {
    key: "warms",
    triggers: ["pasta", "pizza", "italian", "tomato", "mediterranean"],
    start: "#EEDFCE", // terracotta-leaning oat cream
    end: CARD_CREAM,
    glyph: "Pizza",
    light: true,
  },
  {
    key: "ambers",
    triggers: ["baked", "dessert", "cookie", "cake", "sweet", "breakfast"],
    start: "#EFE4CE", // amber oat cream
    end: CARD_CREAM,
    glyph: "Cookie",
    light: true,
  },
  {
    key: "earths",
    triggers: ["soup", "stew", "curry", "broth", "asian", "noodle"],
    start: "#E7DECF", // warm earth cream
    end: CARD_CREAM,
    glyph: "Soup",
    light: true,
  },
  {
    key: "neutrals",
    triggers: ["bread", "grain", "rice", "oats", "cereal", "wheat"],
    start: "#EAE3D3", // pale grain cream
    end: CARD_CREAM,
    glyph: "Wheat",
    light: true,
  },
  {
    key: "default",
    triggers: [],
    start: "#E4E1D8", // neutral warm cream (was the loud blue→pink)
    end: CARD_CREAM,
    glyph: "Utensils",
    light: true,
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

/**
 * Sage `#7C8466` (= rgb 124, 132, 102) — the §11.4 glyph/pattern
 * colour. Rendered on the warm cream gradient on every bucket. The
 * glyph sits at a clearly-visible alpha (cream needs more than the old
 * dark-bucket 0.55); the pattern stays a whisper so it textures
 * without competing with the glyph.
 */
const SAGE_RGB = "124, 132, 102";

export function getRecipeFallback(input: RecipeHeroInput): RecipeHeroFallback {
  const bucket = resolveBucket(input);
  const patternIdx = djb2(input.id) % PATTERNS.length;
  const pattern = PATTERNS[patternIdx];
  // Calm reskin (§11.4): sage mark on cream. The glyph reads at ~0.7
  // alpha on the pale tints; the pattern is a faint 0.07 sage texture.
  const patternAlpha = 0.07;
  const glyphAlpha = 0.7;
  return {
    bucket: bucket.key,
    gradientStart: bucket.start,
    gradientEnd: bucket.end,
    glyph: bucket.glyph,
    pattern,
    patternColor: `rgba(${SAGE_RGB}, ${patternAlpha})`,
    glyphColor: `rgba(${SAGE_RGB}, ${glyphAlpha})`,
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
