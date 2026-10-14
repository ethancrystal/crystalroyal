import { CopyButton } from "@/components/copy-button";
import { Ph } from "@/components/ph";
import type { Settings } from "@/lib/types";
import { bankCopyAll, bankRows, type BANK_ROWS } from "./format";
import { COLUMN } from "./shell";

// The bank card plate (canvas Payment / PaymentMobile): a midnight-2 plate in a gold hairline frame, one row per
// detail with its own Copy button, the reservation reference in gold, and "Copy all details".
// Desktop: label, value, button in one row. Phones: label above value, button to the right.

type BankSettings = Pick<Settings, (typeof BANK_ROWS)[number][0]>;

const rowClass =
  "flex items-center gap-4 px-7 py-4 max-[640px]:gap-3 max-[640px]:px-4 max-[640px]:py-3";
const labelClass =
  "w-[150px] shrink-0 text-[12px] tracking-[.16em] uppercase max-[640px]:w-auto max-[640px]:text-[11px]";

export function BankCard({ settings, reference, amountDue }: { settings: BankSettings; reference: string; amountDue: number }) {
  const rows = bankRows(settings);
  return (
    <section
      aria-labelledby="bank-h"
      className="min-w-0 flex-[1_1_520px] max-[640px]:flex-auto"
      style={{ background: "var(--color-midnight-2)", border: "1px solid var(--color-gold)" }}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-7 py-6 max-[640px]:px-4 max-[640px]:py-4"
        style={{ borderBottom: "1px solid var(--hair-gold)" }}
      >
        <h2 id="bank-h" className="eyebrow" style={{ color: "var(--color-gold)" }}>
          <Ph value={settings.bank_name} />
        </h2>
        <span style={{ fontSize: 13, color: "var(--color-on-dark-2)" }}>Bank transfer · IBFT or Raast</span>
      </div>
      <dl className="m-0">
        {rows.map((r) => (
          <div key={r.key} className={rowClass} style={{ borderBottom: "1px solid rgba(197,168,128,.18)" }}>
            <div className="flex min-w-0 flex-1 items-center gap-4 max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-0">
              <dt className={labelClass} style={{ color: "var(--color-on-dark-2)" }}>
                {r.label}
              </dt>
              <dd className="num m-0 min-w-0 flex-1 [overflow-wrap:anywhere] max-[640px]:text-[15px]">
                <Ph value={r.value} />
              </dd>
            </div>
            <CopyButton value={r.value} ariaLabel={`Copy ${r.label === "IBAN" || r.label === "SWIFT" ? r.label : r.label.toLowerCase()}`} />
          </div>
        ))}
        <div className={rowClass} style={{ borderBottom: "1px solid rgba(197,168,128,.18)" }}>
          <div className="flex min-w-0 flex-1 items-center gap-4 max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-0">
            <dt className={labelClass} style={{ color: "var(--color-on-dark-2)" }}>
              Reference
            </dt>
            <dd className="num m-0 min-w-0 flex-1" style={{ color: "var(--color-gold)" }}>
              {reference}
            </dd>
          </div>
          <CopyButton value={reference} ariaLabel="Copy reference" />
        </div>
      </dl>
      <div className="flex justify-end px-7 py-4 max-[640px]:px-4">
        <CopyButton
          value={bankCopyAll(rows, reference, amountDue)}
          label="Copy all details"
          ariaLabel="Copy all details"
          style={{ minWidth: 0 }}
        />
      </div>
    </section>
  );
}

/** Canvas: shown while any bank detail is still an owner placeholder (canvas.json openDecisions: "Do not transfer yet"). */
export function BankPendingBanner() {
  return (
    <div role="alert" style={{ background: "var(--color-bad)", color: "var(--color-paper)" }}>
      <p className={`${COLUMN} m-0 py-3.5 max-[640px]:py-3`} style={{ fontSize: 15 }}>
        <strong style={{ fontWeight: 500 }}>Not live.</strong>{" "}
        <span className="hide-sm">
          The bank details below are placeholders awaiting the owner. Do not make a transfer until this notice is gone.
        </span>
        <span className="show-sm">Bank details are placeholders. Do not transfer yet.</span>
      </p>
    </div>
  );
}
