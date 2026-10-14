import { formatDateTimeKarachi, toUtc } from "@/lib/dates";
import { formatPKR } from "@/lib/money";
import { isPlaceholder } from "@/lib/site";
import type { ReservationStatus } from "@/lib/status";
import type { Payment, Reservation, Settings } from "@/lib/types";

// Pure helpers for the guest reservation pages (payment, status, confirmation, voucher, calendar file).
// Calendar days are ISO strings formatted in UTC; instants are shown in Karachi time with "PKT".

const KARACHI = "Asia/Karachi";

function parts(date: Date, opts: Intl.DateTimeFormatOptions, timeZone: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-GB", { ...opts, timeZone }).formatToParts(date)) out[p.type] = p.value;
  return out;
}

/** "Monday 2 November 2026" (copy-deck style: no commas). */
export function longDate(iso: string): string {
  const p = parts(toUtc(iso), { weekday: "long", day: "numeric", month: "long", year: "numeric" }, "UTC");
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`;
}

/** "Tuesday 3 November" */
export function dayMonth(iso: string): string {
  const p = parts(toUtc(iso), { weekday: "long", day: "numeric", month: "long" }, "UTC");
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** "Mon 2 Nov 2026" (voucher). */
export function shortDate(iso: string): string {
  const p = parts(toUtc(iso), { weekday: "short", day: "numeric", month: "short", year: "numeric" }, "UTC");
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`;
}

/** "2 – 5 November 2026", "30 November – 2 December 2026", "30 December 2026 – 2 January 2027". */
export function stayRange(checkIn: string, checkOut: string): string {
  const a = parts(toUtc(checkIn), { day: "numeric", month: "long", year: "numeric" }, "UTC");
  const b = parts(toUtc(checkOut), { day: "numeric", month: "long", year: "numeric" }, "UTC");
  if (a.year !== b.year) return `${a.day} ${a.month} ${a.year} – ${b.day} ${b.month} ${b.year}`;
  if (a.month !== b.month) return `${a.day} ${a.month} – ${b.day} ${b.month} ${b.year}`;
  return `${a.day} – ${b.day} ${b.month} ${b.year}`;
}

/** An instant in Karachi time: "Tue 3 Nov, 09:40 PKT". */
export function pkt(isoInstant: string): string {
  return formatDateTimeKarachi(isoInstant).replace(" Karachi time", " PKT");
}

/** The hold deadline as the copy deck writes it: "Tuesday 3 November, 09:40 PKT". */
export function holdUntil(isoInstant: string): string {
  const d = new Date(isoInstant);
  const p = parts(d, { weekday: "long", day: "numeric", month: "long" }, KARACHI);
  const t = parts(d, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, KARACHI);
  return `${p.weekday} ${p.day} ${p.month}, ${t.hour}:${t.minute} PKT`;
}

export function partyLine(adults: number, children: number): string {
  const a = `${adults} ${adults === 1 ? "adult" : "adults"}`;
  if (children === 0) return a;
  return `${a}, ${children} ${children === 1 ? "child" : "children"}`;
}

export function guestsLine(adults: number, children: number): string {
  const n = adults + children;
  return `${n} ${n === 1 ? "guest" : "guests"}`;
}

/** A clock time from settings ("15:00") when the owner has set one; null while it is a placeholder. */
export function clockTime(value: string): { h: number; m: number } | null {
  if (isPlaceholder(value)) return null;
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  return m ? { h: Number(m[1]), m: Number(m[2]) } : null;
}

// ---------- Money ----------

export type MoneyView = {
  /** amount_due < total: a deposit was asked for at reservation. */
  deposit: boolean;
  /** tax rate was not set when the reservation was made: totals are before tax. */
  beforeTax: boolean;
  total: number;
  due: number;
  paid: number;
  /** what remains for check-in, or null when nothing does. */
  balance: number | null;
};

export function moneyView(r: Pick<Reservation, "total" | "amount_due" | "tax_rate_percent" | "status">, paid: number): MoneyView {
  const deposit = r.amount_due < r.total;
  const settled = r.status === "confirmed" || r.status === "checked_in" || r.status === "completed";
  // Before confirmation the balance is what the deposit leaves; afterwards it is what the verified payments leave.
  const remaining = settled ? r.total - paid : deposit ? r.total - Math.max(paid, r.amount_due) : 0;
  return {
    deposit,
    beforeTax: r.tax_rate_percent === null,
    total: r.total,
    due: r.amount_due,
    paid,
    balance: remaining > 0 ? remaining : null,
  };
}

// ---------- Bank details ----------

export const BANK_ROWS = [
  ["bank_name", "Bank"],
  ["account_title", "Account title"],
  ["account_number", "Account number"],
  ["iban", "IBAN"],
  ["branch", "Branch"],
  ["swift", "SWIFT"],
  ["raast_id", "Raast ID"],
] as const satisfies readonly (readonly [keyof Settings, string])[];

export type BankRow = { key: (typeof BANK_ROWS)[number][0]; label: string; value: string; placeholder: boolean };

/**
 * The rows of the bank card. The Raast ID is optional: an empty value hides the row; a bracketed value is still a
 * placeholder and keeps the "do not transfer yet" notice up.
 */
export function bankRows(s: Pick<Settings, (typeof BANK_ROWS)[number][0]>): BankRow[] {
  return BANK_ROWS.filter(([key]) => !(key === "raast_id" && s.raast_id.trim() === "")).map(([key, label]) => ({
    key,
    label,
    value: s[key],
    placeholder: isPlaceholder(s[key]),
  }));
}

/** True while any bank detail a guest would pay into is still an owner placeholder. */
export function bankPending(s: Pick<Settings, (typeof BANK_ROWS)[number][0]>): boolean {
  return bankRows(s).some((r) => r.placeholder);
}

/** Text for "Copy all details". */
export function bankCopyAll(rows: BankRow[], reference: string, amountDue: number): string {
  return [...rows.map((r) => `${r.label}: ${r.value}`), `Reference: ${reference}`, `Amount: ${formatPKR(amountDue)}`].join("\n");
}

// ---------- Receipts and the timeline ----------

/** Receipts the guest uploaded, newest first. */
export function receiptsOf(payments: Payment[]): Payment[] {
  return payments.filter((p) => p.receipt_path !== null).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

/** The latest receipt the property rejected, when it is the newest one and the reservation is waiting again. */
export function rejectedReceipt(status: ReservationStatus, payments: Payment[]): Payment | null {
  const latest = receiptsOf(payments)[0];
  return status === "reserved" && latest?.receipt_status === "rejected" ? latest : null;
}

/** Words for the summary's "Receipt" row. */
export function receiptWords(status: ReservationStatus, payments: Payment[]): string {
  const latest = receiptsOf(payments)[0];
  if (!latest) {
    if (payments.some((p) => p.receipt_status === "verified")) return "Payment recorded by the property";
    return "Not yet uploaded";
  }
  if (latest.receipt_status === "verified") return "Received, verified";
  if (latest.receipt_status === "rejected") return status === "reserved" ? "Not accepted; please upload a new receipt" : "Not accepted";
  return "Received, being verified";
}

export type StepState = "done" | "current" | "upcoming";

export interface TimelineStep {
  key: "reserved" | "receipt" | "confirmed" | "checked_in";
  title: string;
  /** May contain [bracketed] owner placeholders; render through PhText. */
  detail: string;
  state: StepState;
  /** The current step of a confirmed or checked-in stay is drawn in the confirmed colour, otherwise awaiting. */
  tone: "ok" | "wait" | "none";
}

const STEP_INDEX: Partial<Record<ReservationStatus, number>> = {
  reserved: 0,
  payment_submitted: 1,
  confirmed: 2,
  checked_in: 3,
  completed: 4,
};

/** "Reserved → Receipt received → Confirmed → Checked in", from the status and the payments. */
export function timelineSteps(
  r: Pick<
    Reservation,
    "status" | "created_at" | "hold_expires_at" | "confirmed_at" | "checked_in_at" | "completed_at" | "check_in"
  >,
  payments: Payment[],
  settings: Pick<Settings, "check_in" | "confirm_within_hours">,
): TimelineStep[] {
  const idx = STEP_INDEX[r.status] ?? 0;
  const latest = receiptsOf(payments)[0];
  const rejected = rejectedReceipt(r.status, payments);
  const verifiedReceipt = payments.some((p) => p.receipt_path !== null && p.receipt_status === "verified");
  const recorded = payments.find((p) => p.receipt_path === null && p.receipt_status === "verified");

  const reservedDetail =
    r.status === "reserved" && r.hold_expires_at
      ? `${pkt(r.created_at)} · dates held until ${pkt(r.hold_expires_at)}`
      : pkt(r.created_at);

  let receiptDetail: string;
  if (rejected) receiptDetail = `Your receipt of ${pkt(rejected.created_at)} was not accepted`;
  else if (latest) receiptDetail = `Receipt uploaded ${pkt(latest.created_at)}`;
  else if (recorded) receiptDetail = `Payment recorded ${pkt(recorded.verified_at ?? recorded.created_at)}`;
  else if (idx >= 2) receiptDetail = "Payment received";
  else receiptDetail = "Awaiting your transfer receipt";

  const within = isPlaceholder(settings.confirm_within_hours)
    ? settings.confirm_within_hours || "[__]"
    : settings.confirm_within_hours;
  const confirmedDetail = r.confirmed_at
    ? `${verifiedReceipt ? "Transfer verified" : "Confirmed"} ${pkt(r.confirmed_at)}`
    : `Usually within ${within} hours of your receipt`;

  let checkInDetail = `${dayMonth(r.check_in)}, from ${settings.check_in || "[__]"}`;
  if (r.checked_in_at) checkInDetail = `Checked in ${pkt(r.checked_in_at)}`;
  if (r.status === "completed" && r.completed_at) checkInDetail += ` · stay completed ${pkt(r.completed_at)}`;

  const defs: [TimelineStep["key"], string, string][] = [
    ["reserved", "Reserved", reservedDetail],
    ["receipt", "Receipt received", receiptDetail],
    ["confirmed", "Confirmed", confirmedDetail],
    ["checked_in", "Checked in", checkInDetail],
  ];
  const settledTone = r.status === "confirmed" || r.status === "checked_in" || r.status === "completed";
  return defs.map(([key, title, detail], i) => {
    // A checked-in stay has reached its last step, so that step reads done rather than current.
    const done = i < idx || (i === idx && (r.status === "checked_in" || r.status === "completed"));
    const current = i === idx && !done;
    return {
      key,
      title,
      detail,
      state: done ? "done" : current ? "current" : "upcoming",
      tone: done ? "ok" : current ? (settledTone ? "ok" : "wait") : "none",
    };
  });
}

// ---------- Calendar file ----------

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds a content line at 75 octets (RFC 5545 §3.1), never splitting a UTF-8 character. */
function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  // An escape (\n, \,) is kept whole so naive readers never see a lone backslash at a fold.
  for (const ch of line.match(/\\.|[\s\S]/gu) ?? []) {
    const n = enc.encode(ch).length;
    if (bytes + n > (out.length === 0 ? 75 : 74)) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

function icsDate(iso: string): string {
  return iso.replace(/-/g, "");
}

function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * The stay as an iCalendar event. With the owner's check-in and check-out times it is a timed event in
 * Asia/Karachi (with its VTIMEZONE; Pakistan keeps UTC+5 all year); while either time is a placeholder it is an
 * all-day event from the arrival day through the departure day.
 */
export function stayIcs(args: {
  reference: string;
  typeName: string;
  checkIn: string;
  checkOut: string;
  checkInTime: string;
  checkOutTime: string;
  location: string;
  description: string;
  now?: Date;
}): string {
  const start = clockTime(args.checkInTime);
  const end = clockTime(args.checkOutTime);
  const hhmm = (t: { h: number; m: number }) => `${String(t.h).padStart(2, "0")}${String(t.m).padStart(2, "0")}00`;
  const timed = start && end;
  const dayAfter = (iso: string) => {
    const d = toUtc(iso);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  };
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Crystal Royal Apartment//Reservations//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...(timed
      ? [
          "BEGIN:VTIMEZONE",
          "TZID:Asia/Karachi",
          "BEGIN:STANDARD",
          "DTSTART:19700101T000000",
          "TZOFFSETFROM:+0500",
          "TZOFFSETTO:+0500",
          "TZNAME:PKT",
          "END:STANDARD",
          "END:VTIMEZONE",
        ]
      : []),
    "BEGIN:VEVENT",
    `UID:${args.reference.toLowerCase()}@crystal-royal-apartment`,
    `DTSTAMP:${icsStamp(args.now ?? new Date())}`,
    ...(timed
      ? [
          `DTSTART;TZID=Asia/Karachi:${icsDate(args.checkIn)}T${hhmm(start)}`,
          `DTEND;TZID=Asia/Karachi:${icsDate(args.checkOut)}T${hhmm(end)}`,
        ]
      : [`DTSTART;VALUE=DATE:${icsDate(args.checkIn)}`, `DTEND;VALUE=DATE:${icsDate(dayAfter(args.checkOut))}`]),
    `SUMMARY:${icsEscape(`Crystal Royal Apartment · ${args.typeName}`)}`,
    `LOCATION:${icsEscape(args.location)}`,
    `DESCRIPTION:${icsEscape(args.description)}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
