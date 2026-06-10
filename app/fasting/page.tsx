"use client";

import Link from "next/link";
import { FastingTimer } from "../../src/app/components/FastingTimer.tsx";
import { Icons } from "../../src/app/components/ui/icons";

export default function FastingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Sloe header (Figma 305:2) — back chevron + plum serif title. */}
      <header className="w-full bg-background border-b border-border flex items-center justify-between px-4 h-16">
        <Link
          href="/home?view=today"
          className="p-1 -ml-1 text-[var(--foreground-brand)] hover:opacity-80"
          aria-label="Back to Today"
        >
          <Icons.back className="w-6 h-6" />
        </Link>
        <h1 className="font-[family-name:var(--font-headline)] text-xl text-foreground-brand">
          Fasting
        </h1>
        <span className="w-8" aria-hidden />
      </header>
      <div className="max-w-2xl mx-auto px-5 pt-6 pb-10">
        <FastingTimer />
      </div>
    </div>
  );
}
