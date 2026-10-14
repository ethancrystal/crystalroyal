import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadGuestView, SETTLED, tokenFrom, type SearchParams } from "@/components/reservation/load";
import { PrintButton } from "@/components/reservation/print-button";
import { COLUMN, ReservationFooter, ReservationHeader } from "@/components/reservation/shell";
import { Voucher } from "@/components/reservation/voucher";

// The printable stay voucher: one A4 page, ivory paper, the mark, the reference, the stay, the amount paid, the
// address, before you arrive and the house rules. Only for a confirmed, checked-in or completed stay.

export const metadata: Metadata = { title: "Stay voucher — Crystal Royal Apartment" };

// A4 portrait with 12 mm margins; everything but the voucher is hidden, and the plate keeps its paper tone.
const PRINT_CSS = `
@page { size: A4 portrait; margin: 12mm; }
@media print {
  html, body { background: #fff !important; }
  .voucher-page { background: #fff !important; min-height: 0 !important; display: block !important; }
  .voucher-page main { padding: 0 !important; }
  .voucher {
    max-width: none !important; width: 100% !important; padding: 10mm 11mm !important; gap: 7mm !important;
    font-size: 10.5pt !important; line-height: 1.45 !important; break-inside: avoid; page-break-inside: avoid;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .voucher ul { font-size: 9.5pt !important; }
  .voucher a { color: inherit !important; text-decoration: none !important; }
}
`;

export default async function VoucherPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ reference }, sp] = await Promise.all([params, searchParams]);
  const v = await loadGuestView(reference, tokenFrom(sp));
  if (!SETTLED.has(v.r.status)) notFound();

  return (
    <div className="voucher-page on-ivory flex min-h-screen flex-col">
      <style>{PRINT_CSS}</style>
      <ReservationHeader link={{ href: v.links.status, label: "Back to your reservation" }} />
      <main id="main" className="flex-1 px-12 py-16 max-[640px]:px-4 max-[640px]:py-10">
        <div className={`${COLUMN} no-print mb-10 flex max-w-[860px]! flex-wrap items-center justify-between gap-4 px-0!`}>
          <h1 className="display text-[40px] max-[640px]:text-[32px]">Your stay voucher</h1>
          <PrintButton className="btn-light max-[640px]:w-full">Print voucher</PrintButton>
        </div>
        <Voucher
          reservation={v.r}
          typeName={v.typeName}
          settings={v.settings}
          payments={v.payments}
          amenities={v.amenities}
          money={v.money}
        />
      </main>
      <ReservationFooter />
    </div>
  );
}
