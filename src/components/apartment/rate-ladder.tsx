import { formatPKR } from "@/lib/money";
import { Ph } from "@/components/ph";

// "Rate by party size" (Apartment.dc.html table, ApartmentMobile rows). Each row is worked out from the rate in
// force: the nightly rate up to standard occupancy, plus the extra-guest fee for each guest above it, up to the
// maximum. For the three-bedroom at PKR 25,000 + 5,000 this reads 25,000 / 30,000 / 35,000.

export interface LadderRow {
  guests: number;
  label: string;
  perNight: number;
}

export function ladderRows(standard: number, max: number, nightlyRate: number, extraPerNight: number | null): LadderRow[] {
  const top = extraPerNight === null ? standard : Math.max(standard, max);
  const rows: LadderRow[] = [];
  for (let g = standard; g <= top; g++) {
    const label =
      g === standard
        ? top > standard
          ? `Up to ${g}, the standard party`
          : `Up to ${g} guests`
        : g === top
          ? `${g} guests, the maximum`
          : `${g} guests`;
    rows.push({ guests: g, label, perNight: nightlyRate + (g - standard) * (extraPerNight ?? 0) });
  }
  return rows;
}

const cell = "py-3.5 max-[900px]:py-3";

export function RateLadder({ rows }: { rows: LadderRow[] }) {
  return (
    <table className="w-full border-collapse text-[16px] max-[900px]:text-[15px]" style={{ maxWidth: 640 }}>
      <thead className="max-[900px]:sr-only">
        <tr className="text-left uppercase" style={{ color: "var(--color-ink-2)", fontSize: 12, letterSpacing: ".16em" }}>
          <th scope="col" className="py-2.5 font-medium" style={{ borderBottom: "1px solid var(--color-bronze)" }}>
            Guests
          </th>
          <th scope="col" className="py-2.5 font-medium" style={{ borderBottom: "1px solid var(--color-bronze)" }}>
            Per night, before tax
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.guests}>
            <th scope="row" className={`${cell} text-left font-normal`} style={{ borderBottom: "1px solid var(--color-taupe)" }}>
              {r.label}
            </th>
            <td className={`${cell} num max-[900px]:text-right`} style={{ borderBottom: "1px solid var(--color-taupe)" }}>
              {formatPKR(r.perNight)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** For a type whose occupancy the owner has not confirmed: the nightly rate alone, and why there is no ladder. */
export function RateTile({ nightlyRate }: { nightlyRate: number | null }) {
  return (
    <div className="flex flex-col gap-2.5 p-7 max-[900px]:p-5" style={{ border: "1px solid var(--color-taupe)", maxWidth: 640 }}>
      <p className="eyebrow" style={{ color: "var(--color-ink-2)" }}>
        Per night, before tax
      </p>
      <p className="num m-0 text-[28px] max-[900px]:text-[24px]">
        {nightlyRate === null ? <Ph value="[PKR __]" /> : formatPKR(nightlyRate)}
      </p>
      <p className="m-0" style={{ fontSize: 15, color: "var(--color-ink-2)" }}>
        Standard and maximum occupancy for this apartment are confirmed directly with the property.
      </p>
      <p className="m-0" style={{ fontSize: 15 }}>
<Ph value="[Occupancy to be confirmed]" />
      </p>
    </div>
  );
}
