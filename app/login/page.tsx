import { LoginClient } from "./ui";

type LoginPageProps = {
  searchParams: Promise<{ mode?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const sp = await searchParams;
  const raw = sp.mode;
  const modeStr = Array.isArray(raw) ? raw[0] : raw;
  const initialMode = modeStr === "signin" ? "signin" : "signup";
  return <LoginClient initialMode={initialMode} />;
}
