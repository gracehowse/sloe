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

/**
 * ENG-1528 — the active surface scheme a fallback renders on. Every
 * resolver defaults to `"light"` so the light output stays byte-identical
 * to the pre-dark-ramp behaviour; callers pass `"dark"` (via the web theme
 * signal / mobile `useResolvedScheme()`) so a dark card gets a toned dark
 * tile instead of a glowing cream one.
 */
export type FallbackScheme = "light" | "dark";
export type RecipeFallbackPalette = "legacy-cuisine" | "plum-duotone";

/**
 * ENG-1667 / ENG-1374 layer 2 — larger category illustration on no-image
 * heroes. Off = ENG-1552 caps (112 / 30cqmin). On + hero variant = stronger
 * identity mark (144 / 38cqmin) while tint+pattern+glyph still come from
 * `getRecipeFallback`.
 */
export const RECIPE_PLACEHOLDER_IDENTITY_FLAG = "recipe_placeholder_identity_v1" as const;

/** Hero slabs vs compact thumbs — only heroes get the larger cap when identity v1 is on. */
export type RecipeHeroFallbackVariant = "hero" | "thumb";

/** Glyph scale caps for RecipeHeroFallback (web clamp + mobile measure). */
export function recipePlaceholderGlyphScale(
  identityFlagOn: boolean,
  variant: RecipeHeroFallbackVariant = "thumb",
): { maxPx: number; cqminFrac: number } {
  if (identityFlagOn && variant === "hero") {
    return { maxPx: 144, cqminFrac: 0.38 };
  }
  return { maxPx: 112, cqminFrac: 0.3 };
}

/** ENG-1575 — the one flag-gated no-image identity for recipe surfaces. */
export const PLUM_DUOTONE = {
  light: { start: "#D8D0E6", end: "#F1F0F4", markRgb: "91, 59, 110" },
  dark: { start: "#332843", end: "#211A2A", markRgb: "169, 140, 184" },
} as const;

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
export const CARD_CREAM = "#F6F5F2";

/**
 * ENG-1528 — the dark card ground the dark ramp settles into. Value-for-
 * value mirror of web `.dark` `--card` and mobile `Colors.dark.card`
 * (`#211A2A`, the raised plum card on near-black), exactly as `CARD_CREAM`
 * mirrors the light card fill. The dark gradient END is this, so a dark
 * fallback tile melts into its card the way the cream tile melts into the
 * light card — never a lighter rectangle glowing on the dark surface.
 */
export const CARD_DARK = "#211A2A";

/**
 * The §11.4 cuisine/cream tint family — the ONLY food-fallback tint
 * palette in the product. Exported (ENG-1448 PR 1) so the food-row
 * fallback (`src/lib/imagery/foodFallbackCategory.ts`) shares these
 * exact values instead of minting parallel hexes; any recolour lands
 * on recipe heroes and food rows in the same edit.
 */
export const HERO_TINTS = {
  greens: "#DCE3D4", // soft sage cream
  reds: "#EBDAD0", // warm clay cream
  blues: "#D7E0DD", // cool slate-sage cream
  warms: "#EEDFCE", // terracotta-leaning oat cream
  ambers: "#EFE4CE", // amber oat cream
  earths: "#E7DECF", // warm earth cream
  neutrals: "#EAE3D3", // pale grain cream
  default: "#E4E1D8", // neutral warm cream (was the loud blue→pink)
  cream: CARD_CREAM,
} as const;

/**
 * ENG-1528 — the DARK-scheme twin of `HERO_TINTS`. Each cuisine keeps its
 * hue *identity* (sage for greens, clay for reds, slate for fish, oat for
 * baked/grain…) but rendered as a dark tinted surface sitting a hair above
 * the dark card `#211A2A`, so the tile reads as "a tinted dark card" and
 * never glows the way a cream tint does on near-black. Keys mirror
 * `HERO_TINTS` exactly (same bucket → same slot) so a recipe's tint tracks
 * the scheme with no re-mapping. `cream` maps to `CARD_DARK` — the neutral
 * dark ground for identity-less containers, the dark counterpart of the
 * `HERO_TINTS.cream` (= `CARD_CREAM`) rung.
 */
export const HERO_TINTS_DARK = {
  greens: "#242A24", // dark sage
  reds: "#2E2422", // dark clay
  blues: "#1F2A2A", // dark slate-sage
  warms: "#2E2621", // dark terracotta oat
  ambers: "#2C2820", // dark amber oat
  earths: "#2A2522", // dark warm earth
  neutrals: "#282720", // dark grain
  default: "#262030", // neutral dark plum (holds the brand family for tagless)
  cream: CARD_DARK,
} as const;

const BUCKETS: readonly BucketSpec[] = [
  {
    key: "greens",
    triggers: ["vegan", "vegetarian", "salad", "bowl", "green", "kale", "spinach"],
    start: HERO_TINTS.greens,
    end: CARD_CREAM,
    glyph: "Salad",
    light: true,
  },
  {
    key: "reds",
    triggers: ["beef", "steak", "bbq", "grill", "burger", "chilli", "pepperoni"],
    start: HERO_TINTS.reds,
    end: CARD_CREAM,
    glyph: "Beef",
    light: true,
  },
  {
    key: "blues",
    triggers: ["fish", "seafood", "tuna", "salmon", "prawn", "pescatarian"],
    start: HERO_TINTS.blues,
    end: CARD_CREAM,
    glyph: "Fish",
    light: true,
  },
  {
    key: "warms",
    triggers: ["pasta", "pizza", "italian", "tomato", "mediterranean"],
    start: HERO_TINTS.warms,
    end: CARD_CREAM,
    glyph: "Pizza",
    light: true,
  },
  {
    key: "ambers",
    triggers: ["baked", "dessert", "cookie", "cake", "sweet", "breakfast"],
    start: HERO_TINTS.ambers,
    end: CARD_CREAM,
    glyph: "Cookie",
    light: true,
  },
  {
    key: "earths",
    triggers: ["soup", "stew", "curry", "broth", "asian", "noodle"],
    start: HERO_TINTS.earths,
    end: CARD_CREAM,
    glyph: "Soup",
    light: true,
  },
  {
    key: "neutrals",
    triggers: ["bread", "grain", "rice", "oats", "cereal", "wheat"],
    start: HERO_TINTS.neutrals,
    end: CARD_CREAM,
    glyph: "Wheat",
    light: true,
  },
  {
    key: "default",
    triggers: [],
    start: HERO_TINTS.default,
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
export const SAGE_RGB = "124, 132, 102";

/**
 * ENG-1528 — the dark-scheme mark ink. The light sage `#7C8466` is a
 * mid-tone that dims to a murky olive on the near-black dark tints, so the
 * dark ramp lifts it to `#9AA382` (= rgb 154, 163, 130) — a lighter sage
 * that keeps the on-brand calm while reading clearly on the dark surface,
 * mirroring how the accent inks lift on dark (ENG-1275). Alphas are
 * unchanged (0.7 glyph / 0.07 pattern), so the light output is untouched.
 */
export const SAGE_RGB_DARK = "154, 163, 130";

export function getRecipeFallback(
  input: RecipeHeroInput,
  scheme: FallbackScheme = "light",
  palette: RecipeFallbackPalette = "legacy-cuisine",
): RecipeHeroFallback {
  const bucket = resolveBucket(input);
  const patternIdx = djb2(input.id) % PATTERNS.length;
  const pattern = PATTERNS[patternIdx];
  // Calm reskin (§11.4): sage mark on cream. The glyph reads at ~0.7
  // alpha on the pale tints; the pattern is a faint 0.07 sage texture.
  const patternAlpha = palette === "plum-duotone" ? 0.12 : 0.07;
  const glyphAlpha = 0.7;
  // ENG-1528 — dark surfaces swap to the dark ramp (tint + lifted sage +
  // dark card end); light stays byte-identical (the default branch).
  const dark = scheme === "dark";
  const duo = dark ? PLUM_DUOTONE.dark : PLUM_DUOTONE.light;
  const sage = palette === "plum-duotone"
    ? duo.markRgb
    : dark
      ? SAGE_RGB_DARK
      : SAGE_RGB;
  const gradientStart = palette === "plum-duotone"
    ? duo.start
    : dark
      ? HERO_TINTS_DARK[bucket.key]
      : bucket.start;
  const gradientEnd = palette === "plum-duotone"
    ? duo.end
    : dark
      ? CARD_DARK
      : bucket.end;
  return {
    bucket: bucket.key,
    gradientStart,
    gradientEnd,
    glyph: bucket.glyph,
    pattern,
    patternColor: `rgba(${sage}, ${patternAlpha})`,
    glyphColor: `rgba(${sage}, ${glyphAlpha})`,
    patternAlpha,
    glyphAlpha,
  };
}

/**
 * Alias for the frozen placeholder identity resolver (ENG-1667). Prefer this
 * name in new call sites that mean "same recipe → same tile everywhere."
 */
export const resolveRecipePlaceholderIdentity = getRecipeFallback;

/**
 * ENG-1374 PR 2 — the never-white structural underlay colour for a
 * recipe image WRAPPER. Every recipe image container paints this as an
 * opaque `backgroundColor` on the wrapper itself (not on the image or
 * SVG child), so no child failure — 404, SVG mount failure, slow
 * network, style clobber — can expose page white. It is the recipe's
 * deterministic §11.4 cuisine tint (the fallback tile's gradient
 * start), so the underlay always matches the tile that would render on
 * top of it. Containers with no recipe identity use `CARD_CREAM`
 * directly instead — never a generic warm surface token (ENG-1496).
 *
 * ENG-1528 — pass `"dark"` (the resolved surface scheme) on a dark card so
 * the underlay is the dark-ramp tint; the never-white guarantee becomes a
 * never-glow guarantee. Light stays byte-identical (the default branch).
 */
export function recipeUnderlayColor(
  input: RecipeHeroInput,
  scheme: FallbackScheme = "light",
  palette: RecipeFallbackPalette = "legacy-cuisine",
): string {
  return getRecipeFallback(input, scheme, palette).gradientStart;
}

/**
 * ENG-1667 — shared glyph-size resolver for mobile. Mirrors the web
 * `clamp(iconSize, cqminFrac*cqmin, maxPx)` using the measured slab.
 */
export function resolveRecipeHeroGlyphPx(opts: {
  iconSize: number;
  variant: RecipeHeroFallbackVariant;
  identityV1: boolean;
  containerMin?: number;
}): number {
  const { iconSize, variant, identityV1, containerMin } = opts;
  const { maxPx, cqminFrac } = recipePlaceholderGlyphScale(identityV1, variant);
  if (containerMin == null || containerMin <= 0) return iconSize;
  return Math.max(iconSize, Math.min(maxPx, cqminFrac * containerMin));
}

/**
 * Web CSS `width`/`height` for the centre glyph. Uses the shared scale caps.
 */
export function recipeHeroGlyphClampCss(
  iconSize: number,
  variant: RecipeHeroFallbackVariant,
  identityV1: boolean,
): string {
  const { maxPx, cqminFrac } = recipePlaceholderGlyphScale(identityV1, variant);
  const cqv = Math.round(cqminFrac * 100);
  return `clamp(${iconSize}px, ${cqv}cqmin, ${maxPx}px)`;
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
