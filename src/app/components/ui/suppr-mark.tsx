import * as React from "react";
import { cn } from "./utils";

/**
 * Brand mark — the Tare bowl (two concentric circles).
 *
 * Component is still exported as `SupprMark` to avoid touching every
 * import site during the suppr → tare rebrand; the visual content is
 * the new mark. Mirrors `apps/mobile/components/SupprMark.tsx`. The
 * canonical SVG lives at `docs/brand/tare/mark.svg`.
 *
 * Stroke uses `var(--foreground)` so the mark inverts cleanly between
 * light + dark themes (ink on cream, cream on ink). The 0.42em tracking
 * and Inter Medium 500 wordmark setting come straight from the Tare
 * brand pack — never override.
 */

interface SupprMarkProps extends Omit<React.SVGProps<SVGSVGElement>, "ref"> {
  size?: number;
}

function SupprMark({ size = 32, className, ...props }: SupprMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      data-slot="suppr-mark"
      className={cn(className)}
      role="img"
      aria-label="Tare"
      {...props}
    >
      <circle
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
      />
      <circle
        cx="50"
        cy="50"
        r="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
      />
    </svg>
  );
}

interface SupprWordmarkProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
}

function SupprWordmark({ size = 28, className, ...props }: SupprWordmarkProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 text-foreground",
        className,
      )}
      data-slot="suppr-wordmark"
      {...props}
    >
      <SupprMark size={size} />
      <span
        // Tare wordmark setting from docs/brand/tare/README.md:
        // Inter Medium 500, uppercase, letter-spacing 0.42em. Never
        // any other weight/case/tracking.
        style={{
          fontSize: Math.round(size * 0.55),
          fontWeight: 500,
          letterSpacing: "0.42em",
          textTransform: "uppercase",
          // Trailing letter-spacing leaves visual gap on the right;
          // small negative margin re-centres the wordmark beside the
          // mark.
          marginRight: "-0.42em",
          fontFamily:
            'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        }}
      >
        Tare
      </span>
    </div>
  );
}

export { SupprMark, SupprWordmark };
