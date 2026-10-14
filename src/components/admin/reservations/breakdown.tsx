import type { ReactNode } from "react";
import { fmtNum, fmtPKR } from "@/components/admin/ui";

// The canvas "Breakdown" table: muted row labels over taupe rules, figures right-aligned in tabular numerals, notes
// ("to quote", "rate not set") in 13px, and a closing row in medium weight with an 18px figure. No hooks, so the
// detail page (stored figures) and the phone-booking preview (quoteStay) share it.

export interface BreakdownLine {
  key: string;
  label: ReactNode;
  /** whole rupees, or null when the line has a note instead of a figure */
  amount: number | null;
  note?: ReactNode;
}

export function BreakdownTable({
  label,
  lines,
  total,
  after,
}: {
  /** accessible caption */
  label: string;
  lines: BreakdownLine[];
  total: { label: ReactNode; amount: number };
  /** quieter rows after the total (amount due now, received, balance) */
  after?: { key: string; label: ReactNode; amount: number }[];
}) {
  const th = "py-2 pr-4 text-left align-top font-normal text-ink-2 border-b border-taupe";
  const td = "py-2 text-right align-top border-b border-taupe";
  return (
    <table className="w-full border-collapse text-[15px]">
      <caption className="sr-only">{label}</caption>
      <tbody>
        {lines.map((l) => (
          <tr key={l.key}>
            <th scope="row" className={th}>
              {l.label}
            </th>
            <td className={`${td} ${l.amount !== null ? "num whitespace-nowrap" : "text-[13px] text-ink-2"}`}>
              {l.amount !== null ? fmtNum(l.amount) : l.note}
            </td>
          </tr>
        ))}
        <tr>
          <th scope="row" className="py-2.5 pr-4 text-left font-medium">
            {total.label}
          </th>
          <td className="num whitespace-nowrap py-2.5 text-right text-[18px]">{fmtPKR(total.amount)}</td>
        </tr>
        {after?.map((a) => (
          <tr key={a.key}>
            <th scope="row" className="border-t border-taupe py-2 pr-4 text-left text-[14px] font-normal text-ink-2">
              {a.label}
            </th>
            <td className="num whitespace-nowrap border-t border-taupe py-2 text-right text-[14px]">{fmtPKR(a.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
