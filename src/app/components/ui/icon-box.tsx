import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";

/**
 * IconBox — a tinted container for lucide-react icons.
 *
 * Design system: Icon-driven & Structured (Variation C).
 * Every icon sits in a softly tinted rounded square so that
 * icons feel consistent and purposeful across the app.
 */

const iconBoxVariants = cva(
  "inline-flex items-center justify-center shrink-0 rounded-lg transition-pm",
  {
    variants: {
      size: {
        sm: "size-7 [&_svg]:size-3.5",
        md: "size-9 [&_svg]:size-4",
        lg: "size-11 [&_svg]:size-5",
        xl: "size-14 [&_svg]:size-6",
      },
      tone: {
        primary: "bg-primary/10 text-primary",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning-solid",
        destructive: "bg-destructive/10 text-destructive",
        protein: "bg-macro-protein-soft text-macro-protein",
        carbs: "bg-macro-carbs-soft text-macro-carbs",
        fat: "bg-macro-fat-soft text-macro-fat",
        water: "bg-macro-water-soft text-macro-water",
        /**
         * Meal-slot tints (ui-critic P2 #10, 2026-05-01). Mirror
         * mobile `SlotColors`. `snack` is intentionally cyan (NOT
         * magenta) so the Snacks meal-slot tint cannot collide with
         * the Fat macro tile on Today.
         */
        "slot-breakfast": "bg-slot-breakfast-soft text-slot-breakfast",
        "slot-lunch": "bg-slot-lunch-soft text-slot-lunch",
        "slot-dinner": "bg-slot-dinner-soft text-slot-dinner",
        "slot-snack": "bg-slot-snack-soft text-slot-snack",
        muted: "bg-muted text-muted-foreground",
        ghost: "bg-transparent text-foreground",
      },
    },
    defaultVariants: {
      size: "md",
      tone: "primary",
    },
  },
);

type IconBoxProps = React.ComponentProps<"span"> &
  VariantProps<typeof iconBoxVariants>;

function IconBox({ className, size, tone, children, ...props }: IconBoxProps) {
  return (
    <span
      data-slot="icon-box"
      className={cn(iconBoxVariants({ size, tone }), className)}
      {...props}
    >
      {children}
    </span>
  );
}

export { IconBox, iconBoxVariants };
