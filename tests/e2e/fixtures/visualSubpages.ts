/** Shared route + viewport inventory for subpage visual regression specs. */
export { marketingScreenshotOptions as publicSubpageScreenshotOptions, visualViewports as visualSubpageViewports } from "./visualViewports";

export const publicVisualSubpages = [
  { name: "help", path: "/help" },
  { name: "whats-new", path: "/whats-new" },
  { name: "fasting", path: "/fasting" },
  { name: "terms", path: "/terms" },
  { name: "privacy", path: "/privacy" },
  { name: "pricing", path: "/pricing" },
] as const;

/** Deep product routes outside the main tab shell. */
export const authedVisualSubpages = [
  { name: "profile", path: "/profile" },
  { name: "import", path: "/import" },
  { name: "notifications", path: "/notifications" },
  { name: "account-billing", path: "/account/billing" },
  { name: "create", path: "/create" },
] as const;
