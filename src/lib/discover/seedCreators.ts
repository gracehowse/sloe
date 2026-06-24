import type { CreatorChip } from "./topCreators";

/**
 * SEEDED creators for the Discover creator rail + Following feed (ENG-1225 #14,
 * `discover_creator_rail_v1`).
 *
 * WHY THIS EXISTS — the real `creators` table is EMPTY pre-launch (0 rows,
 * verified via Supabase MCP 2026-06-22), so `loadTopCreators` returns `[]` and
 * the rail/feed render nothing. That's correct for production today — we never
 * fabricate creators into the live data. But the v3 reskin needs the creator
 * plane to be SEE-able (Grace approves on the sim before it ramps), and the
 * surface can't be reviewed if it renders an empty space.
 *
 * So this fixture is a presentation-only seed shown ONLY when
 * `discover_creator_rail_v1` is ON. It is a clearly-marked sample set, grounded
 * on the v3 prototype `CREATORS` (Sloe-App.html L6501-6506) — NOT a claim that
 * these are real Sloe creators, and NEVER written to the DB. The moment real
 * creators exist (`loadTopCreators` returns rows), the real data wins and this
 * seed is dropped (`resolveCreatorRail`).
 *
 * FOLLOW-UP (Grace to file a Linear issue in the Creator-platform project) —
 * wire the rail/feed to REAL creator data (a `creators` table seeded with
 * launch-partner cooks + the `top_creators_by_saves` RPC returning rows), then
 * RETIRE this seed fixture in the `discover_creator_rail_v1` gate-removal sweep.
 * This is launch-content work, not a code task. The seed is the interim so the
 * surface is reviewable; it must NOT survive into the un-gated state. Surfaced in
 * the build report (2026-06-23) — a real ENG-ID belongs here once Grace files it.
 *
 * Lives in the shared lib (not a web/mobile component) so BOTH platforms import
 * the identical set — no `@/` aliases, so Metro can resolve it.
 */

/** A seeded creator carries everything a chip needs PLUS feed-post metadata. */
export interface SeedCreator extends CreatorChip {
  /** Short bio / specialty line shown under the name on the profile + feed. */
  spec: string;
  /** A believable "what they just posted" note for the Following feed card. */
  latestNote: string;
  /** Relative time for the feed post header (sample copy — not a real clock). */
  postedAgo: string;
}

/**
 * Grounded on the prototype `CREATORS` set. `id` is a stable `seed-creator-*`
 * slug so it can never collide with a real creator UUID, and every chip has
 * `avatarUrl: null` → the rail/feed render the shared initial-on-tint fallback
 * (no fabricated photos). The tint is derived from the id by the shared
 * `creatorTintFor`, so a creator looks identical web ↔ mobile.
 */
export const SEED_CREATORS: readonly SeedCreator[] = [
  {
    id: "seed-creator-priya",
    handle: "priyaeats",
    displayName: "Priya Patel",
    avatarUrl: null,
    spec: "Batch-cooking & big-flavour veg",
    latestNote:
      "Big-batch harissa chickpea stew — freezes beautifully, 24g protein a bowl.",
    postedAgo: "2h",
  },
  {
    id: "seed-creator-marcus",
    handle: "marcuscooks",
    displayName: "Marcus Chen",
    avatarUrl: null,
    spec: "30-minute weeknight dinners",
    latestNote: "Weeknight miso salmon. 30 minutes, lands 38g protein.",
    postedAgo: "6h",
  },
  {
    id: "seed-creator-sofia",
    handle: "sofiaromano",
    displayName: "Sofia Romano",
    avatarUrl: null,
    spec: "Slow mornings & comfort food",
    latestNote: "A jammy-egg breakfast bowl worth slowing down for. 22g protein.",
    postedAgo: "1d",
  },
  {
    id: "seed-creator-theo",
    handle: "theoblake",
    displayName: "Theo Blake",
    avatarUrl: null,
    spec: "High protein, low effort",
    latestNote: "Make-ahead high-protein traybake — five ingredients, 41g protein.",
    postedAgo: "1d",
  },
  {
    id: "seed-creator-aisha",
    handle: "aishakitchen",
    displayName: "Aisha Khan",
    avatarUrl: null,
    spec: "Veg-forward & bright",
    latestNote: "Bright herby lentil salad — generous on the spice, full plate.",
    postedAgo: "2d",
  },
] as const;

/** The seed creators projected to plain chips (for the rail). */
export const SEED_CREATOR_CHIPS: readonly CreatorChip[] = SEED_CREATORS.map(
  ({ id, handle, displayName, avatarUrl }) => ({
    id,
    handle,
    displayName,
    avatarUrl,
  }),
);

/** True when an id belongs to the presentation-only seed set (never a real creator). */
export function isSeedCreatorId(id: string): boolean {
  return id.startsWith("seed-creator-");
}

/**
 * resolveCreatorRail — the single decision for "what creators does the rail
 * show". REAL creators always win: if `loadTopCreators` returned any rows, those
 * render and the seed is irrelevant (the flag never fabricates over real data).
 * Only when there are NO real creators AND `discover_creator_rail_v1` is ON do
 * we fall back to the seed so the surface is reviewable. Flag OFF with no real
 * creators → `[]` (rail hides), exactly as before this feature.
 */
export function resolveCreatorRail(
  realCreators: readonly CreatorChip[],
  flagOn: boolean,
): readonly CreatorChip[] {
  if (realCreators.length > 0) return realCreators;
  return flagOn ? SEED_CREATOR_CHIPS : [];
}
