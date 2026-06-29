/**
 * Shared account-deletion API call (web + mobile).
 */
export type ExecuteAccountDeleteResult =
  | { ok: true }
  | { ok: false; error: string };

export async function executeAccountDelete(
  apiBase: string,
  accessToken: string | null | undefined,
): Promise<ExecuteAccountDeleteResult> {
  if (!apiBase) {
    return { ok: false, error: "API URL not configured. Please contact support." };
  }
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/account/delete`, {
      method: "DELETE",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (json.ok) return { ok: true };
    return { ok: false, error: json.error || "Please try again." };
  } catch {
    return { ok: false, error: "Please try again later." };
  }
}
