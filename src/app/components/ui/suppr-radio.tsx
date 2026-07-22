"use client";

import * as React from "react";
import { cn } from "./utils";

export interface SupprRadioProps extends React.ComponentProps<"span"> {
  checked: boolean;
}

export function SupprRadio({ checked, className, ...props }: SupprRadioProps) {
  return (
    <span
      data-slot="suppr-radio"
      data-checked={checked ? "true" : "false"}
      className={cn(
        "inline-flex size-[18px] items-center justify-center rounded-full border-[1.8px]",
        checked ? "border-primary" : "border-muted-foreground",
        className,
      )}
      {...props}
    >
      {checked ? <span className="size-2 rounded-full bg-primary" /> : null}
    </span>
  );
}

export default SupprRadio;
