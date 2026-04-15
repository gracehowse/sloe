import * as React from "react";
import { cn } from "../ui/utils";
import { Icons, type IconName } from "../ui/icons";

/**
 * SourceBadge — shows where a recipe was imported from.
 *
 * Displays a platform icon + name (e.g. Instagram, TikTok, YouTube,
 * Pinterest, Web, or User for user-created recipes).
 */

type SourcePlatform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "pinterest"
  | "web"
  | "user";

const sourceConfig: Record<
  SourcePlatform,
  { icon: IconName; label: string; color: string }
> = {
  instagram: { icon: "instagram", label: "Instagram", color: "#E4405F" },
  tiktok: { icon: "web", label: "TikTok", color: "#000000" },
  youtube: { icon: "youtube", label: "YouTube", color: "#FF0000" },
  pinterest: { icon: "web", label: "Pinterest", color: "#E60023" },
  web: { icon: "web", label: "Web", color: "var(--muted-foreground)" },
  user: { icon: "chef", label: "Original", color: "var(--primary)" },
};

interface SourceBadgeProps extends React.ComponentProps<"span"> {
  source: SourcePlatform;
  creatorName?: string;
}

function SourceBadge({
  source,
  creatorName,
  className,
  ...props
}: SourceBadgeProps) {
  const config = sourceConfig[source];
  const Icon = Icons[config.icon];

  return (
    <span
      data-slot="source-badge"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground",
        className,
      )}
      {...props}
    >
      <Icon className="size-3.5" style={{ color: config.color }} />
      {creatorName ?? config.label}
    </span>
  );
}

export { SourceBadge, type SourcePlatform };
