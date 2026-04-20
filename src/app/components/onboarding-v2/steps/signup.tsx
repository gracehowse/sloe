"use client";

import * as React from "react";
import { Button } from "@/app/components/ui/button";
import { useOnboardingV2 } from "../context";
import { StepBody, StepHeader } from "../scaffold";

/**
 * Signup — step 02. Apple sign-in CTA + email/name fallback.
 *
 * The actual auth handshake (Apple OAuth, Supabase signUp) belongs to
 * Stage E. This component just records the user's choice in state so
 * the flow can advance; the route component owns the side effect.
 */

export function SignupStep() {
  const { state, set, go } = useOnboardingV2();
  return (
    <StepBody>
      <StepHeader
        overline="Step 02 of 12"
        title="Create your account"
        subtitle="One account, same data on your phone and on the web."
      />

      <div className="flex flex-col gap-2.5 mb-4">
        <Button
          size="lg"
          className="w-full h-12 bg-black text-white hover:bg-black/90 hover:text-white border border-black"
          onClick={() => {
            set({ authMethod: "apple" });
            go(1);
          }}
        >
          <AppleLogo />
          Sign in with Apple
        </Button>
      </div>

      <div className="flex items-center gap-2.5 my-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[11px] text-muted-foreground font-semibold tracking-wider uppercase">
          Or
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="flex flex-col gap-2.5">
        <LabelledField
          label="First name"
          value={state.name}
          onChange={(v) => set({ name: v })}
          placeholder="Grace"
          autoFocus
        />
        <LabelledField
          label="Email"
          value={state.email}
          onChange={(v) => set({ email: v })}
          placeholder="you@example.com"
          type="email"
        />
      </div>

      <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
        By continuing you agree to Suppr&apos;s{" "}
        <span className="text-foreground/80 underline">Terms</span> and{" "}
        <span className="text-foreground/80 underline">Privacy Policy</span>.
      </p>
    </StepBody>
  );
}

function LabelledField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email";
  autoFocus?: boolean;
}) {
  return (
    <label className="block bg-card border border-border rounded-md px-3.5 py-2.5 transition-pm focus-within:border-primary">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-1">
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full bg-transparent border-0 outline-none text-base font-medium text-foreground placeholder:text-muted-foreground/60"
      />
    </label>
  );
}

function AppleLogo() {
  return (
    <svg
      width={15}
      height={17}
      viewBox="0 0 814 1000"
      fill="currentColor"
      aria-hidden
    >
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
    </svg>
  );
}
