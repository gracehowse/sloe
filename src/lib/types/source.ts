/**
 * SourceDot type aliases — shared between web and mobile.
 *
 * Lives in lib/ rather than alongside the React component so mobile's
 * TypeScript doesn't transitively pull in web-only deps (lucide-react,
 * clsx, tailwind-merge) when type-checking lib code that references
 * the source union.
 */
export type SourceDotSource =
  | "usda"
  | "off"
  | "fatsecret"
  | "manual"
  | "ai";

export type SourceDotSize = 6 | 8 | 10;
