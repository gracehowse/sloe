/**
 * RCT / HealthKit bridge often passes NSError-shaped plain objects, not `Error` instances.
 * `String(obj)` becomes "[object Object]" — use this for user-visible debug lines and logs.
 */
export function stringifyBridgeUnknown(value: unknown, maxLen = 2000): string {
  if (value == null) return "unknown";
  if (typeof value === "string") return value.slice(0, maxLen);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Error) {
    const m = value.message;
    if (m && m !== "[object Object]") return m.slice(0, maxLen);
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof o.message === "string" && o.message.trim()) parts.push(o.message.trim());
    if (typeof o.localizedDescription === "string" && o.localizedDescription.trim()) {
      parts.push(o.localizedDescription.trim());
    }
    if (typeof o.code === "string" || typeof o.code === "number") parts.push(`code=${String(o.code)}`);
    if (typeof o.domain === "string" && o.domain) parts.push(`domain=${o.domain}`);
    if (parts.length > 0) return [...new Set(parts)].join(" · ").slice(0, maxLen);
    try {
      return JSON.stringify(value).slice(0, maxLen);
    } catch {
      return "[unserializable bridge value]";
    }
  }
  return String(value).slice(0, maxLen);
}
