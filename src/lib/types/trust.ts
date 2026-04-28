/**
 * Trust-chip type aliases — shared between web and mobile.
 *
 * Lives in lib/ rather than alongside the React component so mobile's
 * TypeScript doesn't transitively pull in web-only deps (lucide-react,
 * clsx, tailwind-merge) when type-checking lib code that references
 * the variant union.
 */
export type TrustChipVariant =
  | "usda"
  | "off-adjusted"
  | "estimated"
  | "manual"
  | "gluten-high-conf"
  | "gluten-uncertain";
