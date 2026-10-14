// Dates are ISO calendar days ("YYYY-MM-DD") with no time zone. Arithmetic is done in UTC to avoid DST drift.
// "Today" is always computed in Karachi time.
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== "string" || !ISO.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function toUtc(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

export function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(s: string, n: number): string {
  const d = toUtc(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round((toUtc(checkOut).getTime() - toUtc(checkIn).getTime()) / 86_400_000);
}

/** Every night occupied by a stay: [checkIn, checkOut). */
export function nightsOf(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) out.push(d);
  return out;
}

export function todayInKarachi(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function monthStart(s: string): string {
  return `${s.slice(0, 7)}-01`;
}

export function addMonths(s: string, n: number): string {
  const d = toUtc(monthStart(s));
  d.setUTCMonth(d.getUTCMonth() + n);
  return fromUtc(d);
}

export function formatDate(s: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...opts,
  }).format(toUtc(s));
}

export function formatDateTimeKarachi(iso: string): string {
  return (
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Karachi",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso)) + " Karachi time"
  );
}
