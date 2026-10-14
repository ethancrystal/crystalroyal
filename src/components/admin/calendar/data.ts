import "server-only";
import { calendarRange, type BlockRow, type CalendarStay } from "@/lib/db/admin-queries";
import { addDays, addMonths, formatDate, nightsOf } from "@/lib/dates";
import { STATUS_TONE } from "@/lib/status";
import { ADMIN_STATUS_WORD, BLOCK_REASON_LABEL, fmtStay } from "../ui";
import type { CalCell, CalDay, CalRow, UnitOption } from "./types";

// Builds the month board for /admin/calendar from calendarRange(): the nights of the month, and per unit the run of
// free nights, reservations (active and completed; cancelled and expired are left out) and blocks.

const DOW = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** "2026-11" from ?month=, or null when missing or malformed. */
export function parseMonth(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s || !/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) return null;
  const y = Number(s.slice(0, 4));
  return y >= 2020 && y <= 2100 ? s : null;
}

export interface MonthBoard {
  month: string;
  from: string;
  /** first day of the next month (exclusive) */
  to: string;
  prev: string;
  next: string;
  days: CalDay[];
  rows: CalRow[];
  units: UnitOption[];
  blocks: BlockRow[];
  types: { slug: string; label: string }[];
  /** the apartment type the rows are narrowed to, if any (only a known slug is honoured) */
  type: string | undefined;
}

export async function monthBoard(month: string, today: string, typeSlug?: string): Promise<MonthBoard> {
  const from = `${month}-01`;
  const to = addMonths(from, 1);
  const { units, stays, blocks } = await calendarRange(from, to);
  const nights = nightsOf(from, to);

  const days: CalDay[] = nights.map((date) => ({
    date,
    day: Number(date.slice(8)),
    dow: DOW[new Date(`${date}T00:00:00Z`).getUTCDay()],
    spoken: formatDate(date, { weekday: "long", month: "long", year: undefined }).replace(",", ""),
    past: date < today,
    today: date === today,
  }));

  const types: { slug: string; label: string }[] = [];
  for (const u of units) {
    if (!types.some((t) => t.slug === u.type_slug)) {
      types.push({ slug: u.type_slug, label: u.type_slug.charAt(0).toUpperCase() + u.type_slug.slice(1) });
    }
  }

  const type = typeSlug && types.some((t) => t.slug === typeSlug) ? typeSlug : undefined;
  const shown = type ? units.filter((u) => u.type_slug === type) : units;

  const rows: CalRow[] = shown.map((u) => {
    const unitStays = stays.filter((s) => s.unit_id === u.id);
    const unitBlocks = blocks.filter((b) => b.unit_id === u.id);
    const stayOn = (d: string): CalendarStay | undefined => unitStays.find((s) => s.check_in <= d && d < s.check_out);
    const blockOn = (d: string): BlockRow | undefined => unitBlocks.find((b) => b.starts_on <= d && d < b.ends_on);

    const cells: CalCell[] = [];
    for (let i = 0; i < nights.length; ) {
      const d = nights[i];
      const stay = stayOn(d);
      const block = stay ? undefined : blockOn(d);
      if (!stay && !block) {
        cells.push({ kind: "free", date: d, past: d < today });
        i++;
        continue;
      }
      let span = 1;
      while (i + span < nights.length) {
        const n = nights[i + span];
        const same = stay ? stayOn(n)?.id === stay.id : !stayOn(n) && blockOn(n)?.id === block!.id;
        if (!same) break;
        span++;
      }
      const last = nights[i + span - 1];
      if (stay) {
        cells.push({
          kind: "stay",
          start: d,
          span,
          id: stay.id,
          reference: stay.reference,
          guestName: stay.guest_name,
          statusWord: ADMIN_STATUS_WORD[stay.status],
          tone: STATUS_TONE[stay.status],
          range: fmtStay(stay.check_in, stay.check_out),
          startsBefore: stay.check_in < d,
          endsAfter: stay.check_out > addDays(last, 1),
        });
      } else if (block) {
        cells.push({
          kind: "block",
          start: d,
          span,
          id: block.id,
          reasonLabel: BLOCK_REASON_LABEL[block.reason],
          note: block.note,
          range: fmtStay(block.starts_on, block.ends_on),
          startsBefore: block.starts_on < d,
          endsAfter: block.ends_on > addDays(last, 1),
        });
      }
      i += span;
    }
    return {
      unitId: u.id,
      unitName: u.name,
      typeName: u.type_name,
      typeShortName: u.type_short_name,
      typeSlug: u.type_slug,
      active: u.active,
      cells,
    };
  });

  return {
    month,
    from,
    to,
    prev: addMonths(from, -1).slice(0, 7),
    next: to.slice(0, 7),
    days,
    rows,
    units: units.map((u) => ({ id: u.id, label: `${u.name} · ${u.type_short_name}${u.active ? "" : " (not active)"}` })),
    blocks: type ? blocks.filter((b) => shown.some((u) => u.id === b.unit_id)) : blocks,
    types,
    type,
  };
}
