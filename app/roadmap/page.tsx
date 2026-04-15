import type { Metadata } from "next";
import Link from "next/link";
import { SupprLogoMark } from "../components/SupprLogoMark.tsx";

export const metadata: Metadata = {
  title: "Roadmap — Suppr",
  description: "What we’re building next on Suppr — mobile, creators, discovery, and macro-first meal planning.",
};

export default function RoadmapPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2 font-semibold">
            <SupprLogoMark className="h-8 w-8" />
            Suppr
          </Link>
          <Link href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Pricing
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Roadmap</h1>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          Suppr is evolving quickly — here’s the direction of travel. We’ll keep this page updated as major milestones
          ship.
        </p>
        <ul className="mt-10 space-y-6 text-sm leading-relaxed sm:text-base">
          <li className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <strong className="font-semibold text-foreground">Mobile & sync</strong>
            <p className="mt-2 text-muted-foreground">
              Faster imports, tighter Health and share flows, and polish on the experiences you use away from the desk.
            </p>
          </li>
          <li className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <strong className="font-semibold text-foreground">Creators & discovery</strong>
            <p className="mt-2 text-muted-foreground">
              Better surfaces for food creators, clearer attribution, and a discovery feed that feels worth opening daily
              — with macros already attached.
            </p>
          </li>
          <li className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <strong className="font-semibold text-foreground">Planning intelligence</strong>
            <p className="mt-2 text-muted-foreground">
              Smarter week views, optional AI for logging and suggestions, and less friction from “saved” to “cooked”.
            </p>
          </li>
          <li className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <strong className="font-semibold text-foreground">Friends & shared plans (later)</strong>
            <p className="mt-2 text-muted-foreground">
              Connect with people you eat with, share meals or whole plans (or just dinners), scale recipes for the
              household, and help everyone fill their own breakfast, lunch, and snacks around what you agreed to cook—
              each person keeps their own targets. Detailed spec lives in the product roadmap doc.
            </p>
          </li>
        </ul>
        <div className="mt-12 flex flex-wrap gap-4">
          <Link
            href="/signup"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm hover:brightness-[1.03]"
          >
            Get started
          </Link>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-card px-6 text-sm font-semibold hover:bg-accent"
          >
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
