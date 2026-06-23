/**
 * Shared presentation helpers for the Discover creator rail (ENG-1225 #14),
 * used by BOTH the web component (`discover-creator-rail.tsx`) and the mobile
 * component (`apps/mobile/components/discover/CreatorRail.tsx`) so a creator's
 * fallback colour + initial are identical across platforms.
 *
 * This module is the single canonical source for the avatar-tint palette. The
 * tint is picked by a JS hash of the creator id at runtime, and mobile cannot
 * read web CSS custom properties — so the literal hexes must live in shared JS,
 * not only in `theme.css`. That's why the raw-hex lint is disabled here: this IS
 * the token home for these values (the documented carve-out the UI-write
 * discipline allows). Keep web `theme.css` `--creator-tint-*` in sync if added.
 */
/* eslint-disable no-restricted-syntax -- canonical cross-platform avatar-tint source; see header. */

/**
 * Plum-family avatar tints from the v3 prototype TINT set (`Sloe-App.html`
 * L2878-2882). A creator with no avatar photo gets a stable tint picked by a
 * hash of its id, so its colour is consistent across surfaces and sessions.
 * These are a bespoke avatar palette (not core theme tokens) — kept here as the
 * single shared source so web and mobile never drift.
 */
export const CREATOR_TINTS = [
  "#6a4b7a",
  "#4a3661",
  "#8a5a76",
  "#9c4763",
  "#b25d7a",
  "#46314f",
] as const;

/**
 * Ink for the fallback initial — always white, since every tint above is dark
 * enough to clear contrast. Web uses the equivalent `text-white`; mobile reads
 * this so the value is named in one place rather than a bare literal.
 */
export const CREATOR_CHIP_INK = "#FFFFFF";

/** Stable tint for a creator id (consistent web↔mobile). */
export function creatorTintFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CREATOR_TINTS[h % CREATOR_TINTS.length]!;
}

/** Uppercase first letter of a creator name (· when blank). */
export function creatorInitialOf(name: string): string {
  const t = name.trim();
  return t ? t[0]!.toUpperCase() : "·";
}
