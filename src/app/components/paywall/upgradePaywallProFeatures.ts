import {
  CalendarDays,
  Camera,
  Infinity as InfinityIcon,
  Mail,
  Mic,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

/**
 * Pro upsell features for `UpgradePaywallDialog`. PR-01 (audit 2026-04-28)
 * collapsed the prior Variant A / Variant B lists into one Pro pitch.
 */
export const UPGRADE_PAYWALL_PRO_FEATURES: Feature[] = [
  {
    icon: Camera,
    title: "AI photo meal recognition",
    // ENG-1241 legal C6 — estimated macros, not "verified".
    description: "Snap a plate and get estimated macros. Up to 100 logs per day.",
  },
  {
    icon: Mic,
    title: "Voice food logging",
    description: 'Say "bowl of oats and a banana" and it\'s logged. Up to 100 per day.',
  },
  {
    icon: CalendarDays,
    title: "Meal plans matched to your macros",
    description: "A week of meals tailored to your targets. Regenerate any day.",
  },
  {
    icon: ShoppingCart,
    title: "Shopping list from your plan",
    description: "Aisle-sorted, quantities combined across recipes.",
  },
  {
    icon: InfinityIcon,
    title: "Unlimited saved recipes",
    description: "Free tier caps at 10. Pro is uncapped.",
  },
  {
    icon: Mail,
    title: "Priority email support",
    description: "Real humans, faster response.",
  },
];
