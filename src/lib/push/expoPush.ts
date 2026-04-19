/**
 * Shared Expo push helper (TestFlight build 10 fix C —
 * `AOjQg5DGBZqS5qNJ1Rqu960`, `APdpODtJDL8q2JhtGup6DK0` follow-up).
 *
 * The mobile client writes `profiles.expo_push_token` when the user
 * grants OS permission (see `apps/mobile/lib/expoPushToken.ts`). This
 * module owns the server side: batched POSTs to Expo's push API,
 * bounded retry on transient network / 5xx, and structured extraction
 * of `DeviceNotRegistered` tickets so callers can null dead tokens.
 *
 * Design notes:
 *   - Pure helper. No Next.js types, no Supabase, no process.env lookups.
 *     Callable from any route, edge function, or cron runner.
 *   - Chunks at the Expo API limit (100 messages per POST).
 *   - Retries once on 5xx / network error with exponential backoff
 *     (250ms). No retry on 4xx — caller bug or malformed payload.
 *   - Validates the `ExponentPushToken[...]` shape before POSTing so a
 *     bad row does not fail the whole batch.
 *   - Returns a tagged union `{ ok: true, tickets } | { ok: false, ... }`
 *     so callers never handle raw network errors.
 *   - `DeviceNotRegistered` tokens are surfaced alongside the ticket
 *     array so the caller (weekly-recap route) can null the offending
 *     `profiles.expo_push_token` row. The helper itself never writes
 *     to Supabase — keeps this module free of server coupling.
 */

/** Subset of the Expo message spec we rely on. */
export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  channelId?: string;
  badge?: number;
  ttl?: number;
  priority?: "default" | "normal" | "high";
};

/** Ticket shape from `https://exp.host/--/api/v2/push/send`. */
export type ExpoPushTicket =
  | { status: "ok"; id: string }
  | {
      status: "error";
      message: string;
      details?: { error?: string; expoPushToken?: string } & Record<string, unknown>;
    };

export type ExpoPushSendSuccess = {
  ok: true;
  tickets: ExpoPushTicket[];
  /** Tokens the Expo service marked as `DeviceNotRegistered` — caller should null these. */
  deregisteredTokens: string[];
  /** Tokens that failed our local regex and were never POSTed. Useful for logs / dedupe. */
  invalidTokens: string[];
};

export type ExpoPushSendFailure = {
  ok: false;
  error: string;
  statusCode?: number;
};

export type ExpoPushSendResult = ExpoPushSendSuccess | ExpoPushSendFailure;

/** Expo API endpoint. Exported for test visibility — callers should not hit it directly. */
export const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";

/** Expo enforces a max of 100 messages per request. */
export const EXPO_PUSH_MAX_BATCH = 100;

/**
 * Permissive regex matching both the classic `ExponentPushToken[...]`
 * format and the newer `ExpoPushToken[...]` shape Expo documents.
 * Reject anything else before spending a network round-trip.
 */
const EXPO_PUSH_TOKEN_REGEX = /^(?:Exponent|Expo)PushToken\[[^\]]+\]$/;

export function isValidExpoPushToken(token: unknown): token is string {
  return typeof token === "string" && EXPO_PUSH_TOKEN_REGEX.test(token);
}

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

type FetchLike = typeof fetch;

type SendOptions = {
  /** Dependency-injected fetch — defaults to `globalThis.fetch`. Lets tests mock. */
  fetchImpl?: FetchLike;
  /** Millisecond backoff before the single retry. Defaults to 250ms. */
  retryDelayMs?: number;
  /** Extra headers (e.g. Expo access token for higher rate limits). Optional. */
  headers?: Record<string, string>;
};

/**
 * POST one chunk. Returns an array of tickets on success or throws an
 * Error with a `statusCode` annotation we use to decide whether to retry.
 */
async function postChunk(
  messages: ExpoPushMessage[],
  fetchImpl: FetchLike,
  headers: Record<string, string>,
): Promise<ExpoPushTicket[]> {
  const res = await fetchImpl(EXPO_PUSH_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      ...headers,
    },
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    const err = new Error(`expo push API returned ${res.status}`) as Error & {
      statusCode: number;
    };
    err.statusCode = res.status;
    throw err;
  }
  const parsed = (await res.json()) as { data?: ExpoPushTicket[] } | ExpoPushTicket[];
  // Expo wraps the tickets under `.data`; some older responses returned a bare array.
  if (Array.isArray(parsed)) return parsed;
  return parsed?.data ?? [];
}

/**
 * Fan out a batch of Expo push messages. See module header for retry /
 * validation / deregistration semantics.
 */
export async function sendExpoPush(
  messages: ExpoPushMessage[],
  options: SendOptions = {},
): Promise<ExpoPushSendResult> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return { ok: false, error: "fetch_unavailable" };
  }
  const retryDelayMs = options.retryDelayMs ?? 250;
  const headers = options.headers ?? {};

  // Filter out bad tokens up-front so one typo does not poison the batch.
  const valid: ExpoPushMessage[] = [];
  const invalidTokens: string[] = [];
  for (const m of messages) {
    if (isValidExpoPushToken(m.to)) valid.push(m);
    else invalidTokens.push(typeof m.to === "string" ? m.to : "");
  }

  if (valid.length === 0) {
    return { ok: true, tickets: [], deregisteredTokens: [], invalidTokens };
  }

  const tickets: ExpoPushTicket[] = [];
  const chunks = chunk(valid, EXPO_PUSH_MAX_BATCH);

  for (const batch of chunks) {
    try {
      const result = await postChunk(batch, fetchImpl, headers);
      tickets.push(...result);
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode;
      // 4xx = caller bug (bad auth, malformed payload). Do not retry.
      if (typeof status === "number" && status >= 400 && status < 500) {
        return {
          ok: false,
          error: `expo push API rejected request (${status})`,
          statusCode: status,
        };
      }
      // 5xx / network failure → single retry with backoff.
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      try {
        const result = await postChunk(batch, fetchImpl, headers);
        tickets.push(...result);
      } catch (retryErr) {
        const retryStatus = (retryErr as { statusCode?: number })?.statusCode;
        return {
          ok: false,
          error: `expo push API failed after retry: ${(retryErr as Error)?.message ?? "unknown"}`,
          statusCode: retryStatus,
        };
      }
    }
  }

  // Pull out `DeviceNotRegistered` tokens so the caller can null them.
  const deregisteredTokens: string[] = [];
  for (let i = 0; i < tickets.length; i += 1) {
    const t = tickets[i];
    if (t && t.status === "error" && t.details?.error === "DeviceNotRegistered") {
      // Prefer the token Expo echoes back; fall back to the input token
      // at the same index (chunks were preserved in order).
      const echoed = t.details?.expoPushToken;
      const fallback = valid[i]?.to;
      const token = typeof echoed === "string" && echoed.length > 0 ? echoed : fallback;
      if (typeof token === "string" && token.length > 0) {
        deregisteredTokens.push(token);
      }
    }
  }

  return { ok: true, tickets, deregisteredTokens, invalidTokens };
}
