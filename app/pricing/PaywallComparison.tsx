import { Check } from "lucide-react";
import {
  PAYWALL_COMPARISON_ROWS,
  type PaywallComparisonRow,
} from "../../src/lib/landing/content.ts";

/**
 * FREE / PRO comparison matrix for `/pricing` — Sloe Pro paywall
 * (Figma `284:2`).
 *
 * Two columns (FREE / PRO) with the PRO column lilac-highlighted (the
 * `--accent-info` damson-lilac tint from the locked palette). Rows show
 * ✓ / — per the shared `PAYWALL_COMPARISON_ROWS` SSOT.
 *
 * The framing is deliberate: both shared rows show ✓ in BOTH columns
 * (Free is genuinely useful); the two Pro-only rows show — / ✓. This
 * reads as "Pro expands Free" rather than "Free is crippled", per the
 * permission-not-restriction positioning. Do not suppress the Free
 * column. See `docs/ux/redesign/paywall.md` §3a.
 */
function Cell({ value }: { value: PaywallComparisonRow["free"] }) {
  if (value === true) {
    return (
      <Check
        className="h-4 w-4 mx-auto"
        style={{ color: "var(--accent-success-solid)" }}
        strokeWidth={2.25}
        aria-label="Included"
      />
    );
  }
  if (value === false) {
    return (
      <span className="text-muted-foreground" aria-label="Not included">
        —
      </span>
    );
  }
  // Literal string value (e.g. a count) — none in the headline matrix
  // today, but supported so a future count row reads from the SSOT.
  return <span className="text-sm text-foreground">{value}</span>;
}

export function PaywallComparison() {
  return (
    <div
      data-testid="paywall-comparison"
      className="max-w-3xl mx-auto mb-10 rounded-2xl border border-border overflow-hidden"
      style={{ background: "var(--background-secondary)" }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left font-medium text-muted-foreground px-4 py-3" />
            <th className="text-center font-semibold text-muted-foreground px-3 py-3 text-xs uppercase tracking-wide w-20">
              Free
            </th>
            {/* PRO column header — lilac-tinted, the recommended column. */}
            <th
              className="text-center font-bold px-3 py-3 text-xs uppercase tracking-wide w-20"
              style={{
                background: "var(--accent-info-soft, rgba(106, 75, 122, 0.08))",
                color: "var(--accent-info)",
              }}
            >
              Pro
            </th>
          </tr>
        </thead>
        <tbody>
          {PAYWALL_COMPARISON_ROWS.map((row) => (
            <tr
              key={row.key}
              data-testid={`paywall-comparison-${row.key}`}
              className="border-t border-border"
            >
              <td className="text-left text-foreground px-4 py-3">
                {row.label}
              </td>
              <td className="text-center px-3 py-3">
                <Cell value={row.free} />
              </td>
              {/* PRO column body — same lilac tint as the header so the
                  recommended column reads as one continuous band. */}
              <td
                className="text-center px-3 py-3"
                style={{
                  background:
                    "var(--accent-info-soft, rgba(106, 75, 122, 0.06))",
                }}
              >
                <Cell value={row.pro} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
