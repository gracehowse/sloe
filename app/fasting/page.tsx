"use client";

import Link from "next/link";
import { FastingTimer } from "../../src/app/components/FastingTimer.tsx";
import { Icons } from "../../src/app/components/ui/icons";

export default function FastingPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-pm-5 py-pm-5">
        <div className="flex items-center gap-2 mb-5">
          <Link
            href="/?view=today"
            className="w-9 h-9 rounded-lg border border-border bg-card flex items-center justify-center text-foreground hover:bg-muted"
            aria-label="Back to Today"
          >
            <Icons.back className="w-4 h-4" />
          </Link>
          <h1 className="text-lg font-bold text-foreground">Fasting</h1>
        </div>
        <FastingTimer />
      </div>
    </div>
  );
}
