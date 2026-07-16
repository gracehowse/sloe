"use client";

import { cn } from "../../ui/utils";

/**
 * HierarchySectionOverline — ENG-1525 §composer.
 *
 * The ONE overline treatment for the 5 hierarchy sections. Reuses the
 * screen-chrome overline grammar (the primitive pinned by
 * `tests/unit/sectionHeaderRhythm.test.ts`): `text-[11px] font-bold
 * uppercase tracking-[0.1em]`, tertiary ink. Sections must not hand-roll
 * their own eyebrow — same-element-same-treatment rule.
 *
 * Mirror: `apps/mobile/components/progress/hierarchy/` section overlines
 * (screen-section-chrome grammar).
 */
export function HierarchySectionOverline({
  label,
  className,
  testID,
}: {
  label: string;
  className?: string;
  testID?: string;
}) {
  return (
    <p
      data-testid={testID}
      className={cn(
        "text-[11px] font-bold uppercase tracking-[0.1em] text-foreground-tertiary",
        className,
      )}
    >
      {label}
    </p>
  );
}

export default HierarchySectionOverline;
