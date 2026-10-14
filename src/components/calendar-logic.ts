import { addDays, addMonths, isIsoDate, monthStart, nightsBetween, nightsOf, toUtc } from "@/lib/dates";
import { formatNumber } from "@/lib/money";
import type { PriceBreakdown } from "@/lib/pricing";

// Pure rules behind the guest calendar, the stay card and the price ledger. No React, no browser APIs, so the
// same functions run in unit tests, on the server and in the browser. Dates are ISO "YYYY-MM-DD" calendar days.

/** Mirrors NightState in src/lib/db/availability-queries.ts (kept separate so client code never imports server modules). */
export type NightState = "free" | "reserved" | "blocked";

/** How a calendar cell is drawn; matches the `.day[data-state]` classes in globals.css. */
export type DayState = "past" | "selected" | "departure" | "reserved" | "blocked" | "available";

export interface Selection {
  arrive: string;
  depart: string;
}

export const WEEKDAY_SHORT = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export const WEEKDAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const WEEKDAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

// ---------- Dates and labels (built by hand so server and browser always agree) ----------

/** 0 = Monday … 6 = Sunday. Weeks start on Monday. */
export function weekdayIndex(iso: string): number {
  return (toUtc(iso).getUTCDay() + 6) % 7;
}

function parts(iso: string) {
  return { y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) - 1, d: Number(iso.slice(8, 10)) };
}

/** "November 2026" */
export function monthLabel(month: string): string {
  const { y, m } = parts(month);
  return `${MONTH_LONG[m]} ${y}`;
}

/** "November" */
export function monthName(month: string): string {
  return MONTH_LONG[parts(month).m];
}

/** "Monday 2 November 2026" */
export function spokenDate(iso: string): string {
  const { y, m, d } = parts(iso);
  return `${WEEKDAY_LONG[weekdayIndex(iso)]} ${d} ${MONTH_LONG[m]} ${y}`;
}

/** "Thursday 12 November" */
export function spokenDay(iso: string): string {
  const { m, d } = parts(iso);
  return `${WEEKDAY_LONG[weekdayIndex(iso)]} ${d} ${MONTH_LONG[m]}`;
}

/** "Mon 2 Nov", with the year added when it is not the current year ("Sat 9 Jan 2027"). */
export function ledgerDate(iso: string, today?: string): string {
  const { y, m, d } = parts(iso);
  const base = `${WEEKDAY_ABBR[weekdayIndex(iso)]} ${d} ${MONTH_ABBR[m]}`;
  return today && today.slice(0, 4) !== iso.slice(0, 4) ? `${base} ${y}` : base;
}

export function daysInMonth(month: string): number {
  const first = monthStart(month);
  return nightsBetween(first, addMonths(first, 1));
}

/** The weeks of a month, Monday first, padded with null so every row has seven cells. */
export function monthWeeks(month: string): (string | null)[][] {
  const first = monthStart(month);
  const next = addMonths(first, 1);
  const cells: (string | null)[] = Array.from({ length: weekdayIndex(first) }, () => null);
  for (let d = first; d < next; d = addDays(d, 1)) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** A valid ISO date from a URL parameter, or "". */
export function cleanIso(value: string | null | undefined): string {
  return value && isIsoDate(value) ? value : "";
}

// ---------- Day state and spoken label ----------

export function dayState(
  date: string,
  ctx: { arrive: string; depart: string; today: string; state?: NightState },
): DayState {
  if (date < ctx.today) return "past";
  if (ctx.arrive && ctx.depart && ctx.depart > ctx.arrive && date === ctx.depart) return "departure";
  // A night that is taken stays drawn as taken even inside a chosen range (dates typed elsewhere can conflict).
  if (ctx.state === "reserved") return "reserved";
  if (ctx.state === "blocked") return "blocked";
  if (ctx.arrive) {
    if (date === ctx.arrive) return "selected";
    if (ctx.depart && ctx.depart > ctx.arrive && date > ctx.arrive && date < ctx.depart) return "selected";
  }
  return "available";
}

/** Spoken label for a cell: "Monday 2 November 2026, available". Colour never carries the state alone. */
export function dayLabel(date: string, state: DayState, arrive: string): string {
  const phrase: Record<DayState, string> = {
    past: "in the past",
    selected: date === arrive ? "arrival" : "in your stay",
    departure: "departure",
    reserved: "reserved",
    blocked: "unavailable",
    available: "available",
  };
  return `${spokenDate(date)}, ${phrase[state]}`;
}

// ---------- Selection rules ----------

export interface SelectContext {
  today: string;
  /** Loaded state of a night; undefined while unknown (treated as free: the server checks again on reserve). */
  stateOf: (date: string) => NightState | undefined;
  minNights: number;
  maxNights: number;
}

export type SelectionProblem =
  | { kind: "past"; night: string }
  | { kind: "taken"; night: string; state: "reserved" | "blocked" }
  | { kind: "crosses"; night: string }
  | { kind: "length"; min: number; max: number };

function taken(s: NightState | undefined): s is "reserved" | "blocked" {
  return s === "reserved" || s === "blocked";
}

/**
 * Why [arrive, depart) cannot be a stay, or null. Ranges are half-open: the departure day is not a night of the
 * stay, so it may be the first night of someone else's reservation.
 */
export function rangeProblem(arrive: string, depart: string, ctx: SelectContext): SelectionProblem | null {
  for (const n of nightsOf(arrive, depart)) {
    if (taken(ctx.stateOf(n))) return { kind: "crosses", night: n };
  }
  const len = nightsBetween(arrive, depart);
  if (len < ctx.minNights || len > ctx.maxNights) return { kind: "length", min: ctx.minNights, max: ctx.maxNights };
  return null;
}

/**
 * One tap (or Enter) on a night. First tap sets the arrival; the second sets the departure, and a second tap on a
 * night before the arrival swaps them. Tapping the arrival again clears it. With both set, a tap starts again.
 * An invalid tap leaves the selection as it was and returns the problem to show inline.
 */
export function selectNight(
  cur: Selection,
  tapped: string,
  ctx: SelectContext,
): { selection: Selection; problem: SelectionProblem | null } {
  if (tapped < ctx.today) return { selection: cur, problem: { kind: "past", night: tapped } };

  const pendingArrival = cur.arrive && !cur.depart && cur.arrive >= ctx.today;
  if (!pendingArrival) {
    const s = ctx.stateOf(tapped);
    if (taken(s)) return { selection: cur, problem: { kind: "taken", night: tapped, state: s } };
    return { selection: { arrive: tapped, depart: "" }, problem: null };
  }

  if (tapped === cur.arrive) return { selection: { arrive: "", depart: "" }, problem: null };

  let arrive = cur.arrive;
  let depart = tapped;
  if (tapped < cur.arrive) {
    const s = ctx.stateOf(tapped);
    if (taken(s)) return { selection: cur, problem: { kind: "taken", night: tapped, state: s } };
    arrive = tapped;
    depart = cur.arrive;
  }
  const problem = rangeProblem(arrive, depart, ctx);
  if (problem) return { selection: cur, problem };
  return { selection: { arrive, depart }, problem: null };
}

export function problemMessage(p: SelectionProblem): string {
  switch (p.kind) {
    case "past":
      return `${spokenDay(p.night)} has passed. Choose a later date.`;
    case "taken":
      return p.state === "reserved"
        ? `${spokenDay(p.night)} is already reserved. Choose another arrival.`
        : `${spokenDay(p.night)} is unavailable. Choose another arrival.`;
    case "crosses":
      return `${spokenDay(p.night)} is not available, so your stay cannot include it. Choose other dates.`;
    case "length":
      return `Stays are from ${p.min} to ${p.max} nights.`;
  }
}

// ---------- Keyboard and paging ----------

/** Same day of the month `n` months away, clamped to that month's length. */
export function shiftMonths(iso: string, n: number): string {
  const target = addMonths(iso, n);
  const day = Math.min(Number(iso.slice(8, 10)), daysInMonth(target));
  return `${target.slice(0, 8)}${String(day).padStart(2, "0")}`;
}

/** Where focus goes for a key in the calendar grid, or null for keys the grid does not handle. */
export function moveDate(date: string, key: string): string | null {
  switch (key) {
    case "ArrowLeft":
      return addDays(date, -1);
    case "ArrowRight":
      return addDays(date, 1);
    case "ArrowUp":
      return addDays(date, -7);
    case "ArrowDown":
      return addDays(date, 7);
    case "Home":
      return addDays(date, -weekdayIndex(date));
    case "End":
      return addDays(date, 6 - weekdayIndex(date));
    case "PageUp":
      return shiftMonths(date, -1);
    case "PageDown":
      return shiftMonths(date, 1);
    default:
      return null;
  }
}

/**
 * The first visible month after focus moves to `date`, so that `date` lies within `count` visible months and the
 * view never starts before `minMonth` (the current month).
 */
export function viewFor(view: string, count: number, date: string, minMonth: string): string {
  const m = monthStart(date);
  let next = view;
  if (m < view) next = m;
  else if (m > addMonths(view, count - 1)) next = addMonths(m, -(count - 1));
  return next < minMonth ? minMonth : next;
}

/** True when every night of the month from today on is loaded and none is free. */
export function monthFullyTaken(month: string, today: string, stateOf: (d: string) => NightState | undefined): boolean {
  const first = monthStart(month);
  const next = addMonths(first, 1);
  let future = 0;
  for (let d = first; d < next; d = addDays(d, 1)) {
    if (d < today) continue;
    future++;
    const s = stateOf(d);
    if (s === undefined || s === "free") return false;
  }
  return future > 0;
}

// ---------- Party ----------

const WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
];

export function numberWord(n: number): string {
  return WORDS[n] ?? String(n);
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "6 guests. Up to 6 as standard, 8 at most." or, at the limit, "Eight guests is the maximum for this apartment." */
export function partyNote(guests: number, standardGuests: number, maxGuests: number): string {
  if (guests >= maxGuests) return `${capitalise(numberWord(maxGuests))} guests is the maximum for this apartment.`;
  return `${guests} ${guests === 1 ? "guest" : "guests"}. Up to ${standardGuests} as standard, ${maxGuests} at most.`;
}

// ---------- Price ledger ----------

export interface LedgerLine {
  key: string;
  /** May contain [bracketed] owner placeholders (the tax label); render through PhText. */
  label: string;
  /** Whole rupees, formatted without the currency ("75,000"); null when the line carries a note instead. */
  amount: string | null;
  /** Muted text in place of an amount ("plus applicable taxes", "Quoted separately"). */
  note?: string;
  /** Placeholder shown before the note for an unpriced amenity ("[PKR __]"). */
  placeholder?: string;
}

export interface Ledger {
  lines: LedgerLine[];
  totalLabel: "Total before tax" | "Total";
  total: string;
  due: { label: string; amount: string } | null;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * The lines of a PriceBreakdown as the canvas ledger shows them. Extra-guest fees are derived from the breakdown
 * when they are unambiguous; pass them when the child policy splits adults and children.
 */
export function ledgerFor(
  b: PriceBreakdown,
  opts: { taxLabel: string; extraAdultFee?: number | null; extraChildFee?: number | null },
): Ledger {
  const n = b.nights;
  const nightsWord = `${n} ${plural(n, "night", "nights")}`;
  const lines: LedgerLine[] = [
    { key: "nights", label: `${nightsWord} × PKR ${formatNumber(b.nightlyRate)}`, amount: formatNumber(b.subtotalNights) },
  ];

  if (b.extraGuests > 0) {
    if (b.extraChildren === 0) {
      const fee = opts.extraAdultFee ?? b.extraAmount / (b.extraGuests * n);
      lines.push({
        key: "extra",
        label: `${b.extraGuests} additional ${plural(b.extraGuests, "guest", "guests")} × PKR ${formatNumber(fee)} × ${nightsWord}`,
        amount: formatNumber(b.extraAmount),
      });
    } else {
      const childFee =
        opts.extraChildFee ?? (b.extraAdults === 0 ? b.extraAmount / (b.extraChildren * n) : undefined);
      const adultFee =
        opts.extraAdultFee ??
        (childFee !== undefined && b.extraAdults > 0
          ? (b.extraAmount - childFee * b.extraChildren * n) / (b.extraAdults * n)
          : undefined);
      if (childFee === undefined || (b.extraAdults > 0 && adultFee === undefined)) {
        lines.push({
          key: "extra",
          label: `${b.extraGuests} additional ${plural(b.extraGuests, "guest", "guests")} × ${nightsWord}`,
          amount: formatNumber(b.extraAmount),
        });
      } else {
        if (b.extraAdults > 0 && adultFee !== undefined) {
          lines.push({
            key: "extra-adults",
            label: `${b.extraAdults} additional ${plural(b.extraAdults, "adult", "adults")} × PKR ${formatNumber(adultFee)} × ${nightsWord}`,
            amount: formatNumber(b.extraAdults * adultFee * n),
          });
        }
        const kids = `${b.extraChildren} additional ${plural(b.extraChildren, "child", "children")}`;
        lines.push(
          childFee === 0
            ? { key: "extra-children", label: `${kids}, no charge`, amount: "0" }
            : {
                key: "extra-children",
                label: `${kids} × PKR ${formatNumber(childFee)} × ${nightsWord}`,
                amount: formatNumber(b.extraChildren * childFee * n),
              },
        );
      }
    }
  }

  for (const a of b.amenityLines) {
    lines.push(
      a.lineTotal === null
        ? { key: `amenity-${a.id}`, label: `${a.name} × ${a.quantity}`, amount: null, note: "Quoted separately", placeholder: "[PKR __]" }
        : { key: `amenity-${a.id}`, label: `${a.name} × ${a.quantity}`, amount: formatNumber(a.lineTotal) },
    );
  }

  lines.push(
    b.taxRatePercent === null
      ? { key: "tax", label: "Taxes", amount: null, note: "plus applicable taxes" }
      : { key: "tax", label: `${opts.taxLabel} ${b.taxRatePercent}%`, amount: formatNumber(b.taxAmount) },
  );

  return {
    lines,
    totalLabel: b.taxRatePercent === null ? "Total before tax" : "Total",
    total: formatNumber(b.total),
    due: b.depositPolicy === "50" ? { label: "Due now (50%)", amount: formatNumber(b.amountDue) } : null,
  };
}
