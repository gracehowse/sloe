import type { Metadata } from "next";
import { LoginClient } from "../login/ui.tsx";

export const metadata: Metadata = {
  title: "Create account — Suppr",
  description: "Sign up for Suppr — free to start. Recipes, meal plans, and macro tracking in one place.",
};

export default function SignupPage() {
  return <LoginClient initialMode="signup" />;
}
