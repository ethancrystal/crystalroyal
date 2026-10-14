import Link from "next/link";
import type { OccupancyDay, UnitOccupancy } from "@/lib/db/admin-queries";
import { BLOCK_REASON_LABEL, OCCUPANCY_STYLE, OccupancyLegend, TypeMarker, fmtShortDay } from "@/components/admin/ui";

// Dashboard "Next 30 days": one row per active unit, one 30px cell per night, coloured by state (canvas grid:
// a 140px label column and 30 equal columns, scrolling inside its own region below 820px). Colour is never the only
// signal: every cell has a title, and each row is also written out as runs of nights for screen readers, with
// links to the reservations.

interface Run {
  from: string;
  /** last night of the run (inclusive) */
  to: string;
  day: OccupancyDay;
}

function runsOf(days: OccupancyDay[]): Run[] {
  const runs: Run[] = [];
  for (const d of days) {
    const last = runs[runs.length - 1];
    const same =
      last &&
      last.day.state === d.state &&
      last.day.reservationId === d.reservationId &&
      last.day.blockReason === d.blockReason;
    if (same) last.to = d.date;
    else runs.push({ from: d.date, to: d.date, day: d });
  }
  return runs;
}

function cellTitle(d: OccupancyDay): string {
  const date = fmtShortDay(d.date);
  if (d.state === "blocked") return `${date}: blocked${d.blockReason ? `, ${BLOCK_REASON_LABEL[d.blockReason].toLowerCase()}` : ""}`;
  if (d.state === "free") return `${date}: free`;
  return `${date}: ${OCCUPANCY_STYLE[d.state].label.toLowerCase()}, ${d.reference ?? ""}${d.guestName ? ` · ${d.guestName}` : ""}`;
}

function runText(r: Run): string {
  const span = r.from === r.to ? fmtShortDay(r.from) : `${fmtShortDay(r.from)} to ${fmtShortDay(r.to)}`;
  const d = r.day;
  if (d.state === "free") return `${span}: free`;
  if (d.state === "blocked") return `${span}: blocked${d.blockReason ? `, ${BLOCK_REASON_LABEL[d.blockReason].toLowerCase()}` : ""}`;
  return `${span}: ${OCCUPANCY_STYLE[d.state].label.toLowerCase()}`;
}

export function OccupancyStrip({ rows, today }: { rows: UnitOccupancy[]; today: string }) {
  const days = rows[0]?.days ?? [];
  const unitsPerType = new Map<string, number>();
  for (const r of rows) unitsPerType.set(r.typeId, (unitsPerType.get(r.typeId) ?? 0) + 1);
  const label = (r: UnitOccupancy) => (unitsPerType.get(r.typeId)! > 1 ? `${r.typeShortName} · ${r.unitName}` : r.typeShortName);

  if (rows.length === 0) {
    return <p className="m-0 text-[15px] text-ink-2">No active units. Add or activate a unit in Settings.</p>;
  }

  return (
    <>
      <div className="relative overflow-x-auto" role="region" aria-label={`Occupancy for the next 30 nights from ${fmtShortDay(today)}`} tabIndex={0}>
        <div
          aria-hidden="true"
          className="grid text-[11px]"
          style={{ minWidth: 820, gridTemplateColumns: "140px repeat(30, minmax(0, 1fr))", gap: 2 }}
        >
          <span />
          {days.map((d) => (
            <span key={d.date} className="num text-center text-ink-2">
              {Number(d.date.slice(8))}
            </span>
          ))}
          {rows.map((r) => (
            <Row key={r.unitId} label={label(r)} slug={r.typeSlug} days={r.days} />
          ))}
        </div>
        <div className="sr-only">
          {rows.map((r) => (
            <div key={r.unitId}>
              <p>{label(r)}</p>
              <ul>
                {runsOf(r.days).map((run) => (
                  <li key={run.from}>
                    {runText(run)}
                    {run.day.reservationId ? (
                      <>
                        {", "}
                        <Link href={`/admin/reservations/${run.day.reservationId}`}>
                          {run.day.reference}
                          {run.day.guestName ? `, ${run.day.guestName}` : ""}
                        </Link>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <OccupancyLegend />
    </>
  );
}

function Row({ label, slug, days }: { label: string; slug: string; days: OccupancyDay[] }) {
  return (
    <>
      <span className="flex min-w-0 items-center pr-2 text-[13px]">
        <TypeMarker slug={slug} className="truncate">
          {label}
        </TypeMarker>
      </span>
      {days.map((d) => {
        const s = OCCUPANCY_STYLE[d.state];
        return (
          <span key={d.date} title={cellTitle(d)} style={{ height: 30, background: s.background }} />
        );
      })}
    </>
  );
}
