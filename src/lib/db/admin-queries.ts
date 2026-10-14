import "server-only";
import type postgres from "postgres";
import { z } from "zod";
import { db } from "./sql";
import { getReservationById, listPayments, listReservationAmenities, transition } from "./queries";
import { addDays, addMonths, isIsoDate, monthStart, nightsOf, todayInKarachi } from "../dates";
import { OCCUPYING, RESERVATION_STATUSES, TransitionError, type ReservationStatus } from "../status";
import { isPlaceholder } from "../site";
import type { EmailKind } from "../emails";
import type { Admin } from "../admin-auth";
import type {
  ActivityEntry,
  Amenity,
  ApartmentType,
  BlockReason,
  Payment,
  PaymentMethod,
  Rate,
  Reservation,
  ReservationAmenity,
  Settings,
  Unit,
  UnitBlock,
} from "../types";

// Server-only data access for the admin console. Reads are plain; every mutation:
//  - validates its input with zod (field errors come back on AdminError.fieldErrors),
//  - changes reservation status only through transition() from queries.ts,
//  - writes activity_log with actor 'admin' and actor_id = admin.userId (detail.by = admin.email),
//  - never sends email: functions that warrant one return `email` ({ kind, extra }) and the calling server action
//    passes it to notify() after this returns.
// Parameterised SQL only.

export type AdminActor = Pick<Admin, "userId" | "email">;

/** A refusal with a message fit to show the owner. Anything else thrown is a bug or an outage. */
export class AdminError extends Error {
  readonly fieldErrors: Record<string, string>;
  constructor(message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "AdminError";
    this.fieldErrors = fieldErrors;
  }
}

/** For server actions: the owner-facing message for any error (unknown errors are logged, not shown). */
export function adminErrorMessage(e: unknown): string {
  if (e instanceof AdminError) return e.message;
  console.error("admin action failed", e);
  return "That did not work. Please try again; if it keeps happening, check the server log.";
}

export type EmailHint = { kind: EmailKind; extra?: Record<string, string> } | null;
export interface AdminOutcome {
  reservation: Reservation;
  /** the email the caller should send with notify(kind, reservation.id, extra), or null */
  email: EmailHint;
}

type Q = postgres.ISql;
const sql = () => db();

// ---------------------------------------------------------------- helpers

const STATUS_WORD: Record<ReservationStatus, string> = {
  reserved: "Reserved",
  payment_submitted: "Payment received",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
};

const NIGHTS_TAKEN = "Some of those nights are already taken by a reservation or a block in that unit.";
const RESERVED_NIGHTS = "Nights with a reservation cannot be blocked.";
const CHANGED_MEANWHILE = "This reservation changed in the meantime. Reload the page and try again.";

const uuid = z.string().uuid("Not found.");
const isoDate = z.string().refine(isIsoDate, "Enter a valid date.");

function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.output<T> {
  const r = schema.safeParse(input);
  if (r.success) return r.data;
  const fieldErrors: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  throw new AdminError(r.error.issues[0]?.message ?? "Check the form and try again.", fieldErrors);
}

function pgCode(e: unknown): string | undefined {
  return typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : undefined;
}

/** Maps database refusals to owner-facing errors; rethrows anything unexpected. */
function mapDbError(e: unknown, messages: { exclusion?: string; unique?: string; foreignKey?: string } = {}): never {
  if (e instanceof AdminError) throw e;
  if (e instanceof TransitionError) throw new AdminError(CHANGED_MEANWHILE);
  const code = pgCode(e);
  if (code === "23P01") throw new AdminError(messages.exclusion ?? NIGHTS_TAKEN);
  if (code === "23505") throw new AdminError(messages.unique ?? "That already exists.");
  if (code === "23503") throw new AdminError(messages.foreignKey ?? "It is still in use elsewhere.");
  if (code === "23514") throw new AdminError("One of the values is outside what the database allows.");
  throw e;
}

async function log(q: Q, admin: AdminActor, action: string, reservationId: string | null, detail: Record<string, unknown> = {}) {
  await q`
    insert into activity_log (reservation_id, actor, actor_id, action, detail)
    values (${reservationId}, 'admin', ${admin.userId}, ${action}, ${q.json({ ...detail, by: admin.email } as never)})`;
}

async function loadReservation(id: string): Promise<Reservation> {
  const r = uuid.safeParse(id).success ? await getReservationById(id) : null;
  if (!r) throw new AdminError("Reservation not found.");
  return r;
}

async function adminTransition(
  r: Reservation,
  to: ReservationStatus,
  admin: AdminActor,
  detail: Record<string, unknown> = {},
): Promise<Reservation> {
  try {
    return await transition(r.id, to, "admin", admin.userId, { ...detail, by: admin.email });
  } catch (e) {
    mapDbError(e);
  }
}

function karachiStamp(now = new Date()): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour") === "24" ? "00" : g("hour")}:${g("minute")}`;
}

const emptyToNull = (v: unknown) => (v === "" || v === undefined || v === null ? null : typeof v === "string" ? v.trim() : v);
const nullableInt = (min: number, max: number, message: string) =>
  z.preprocess(emptyToNull, z.coerce.number({ invalid_type_error: message }).int(message).min(min, message).max(max, message).nullable());
const intIn = (min: number, max: number, message: string) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.coerce.number({ invalid_type_error: message }).int(message).min(min, message).max(max, message));
const boolish = z
  .union([z.boolean(), z.enum(["on", "true", "false", "1", "0", ""])])
  .transform((v) => v === true || v === "on" || v === "true" || v === "1");
const text = (max: number, message = "Too long.") => z.string().trim().max(max, message);
const required = (max: number, message: string) => z.string().trim().min(1, message).max(max, message);

// ---------------------------------------------------------------- catalogue reads

export type TypeWithUnits = ApartmentType & { units: Unit[]; rate: Rate | null };

/** Every apartment type (inactive too), its units in order and the rate in force today. */
export async function listTypesWithUnits(): Promise<TypeWithUnits[]> {
  const today = todayInKarachi();
  const [types, units, rates] = await Promise.all([
    sql()<ApartmentType[]>`select * from apartment_types order by sort, name`,
    sql()<Unit[]>`select * from units order by sort, name`,
    sql()<Rate[]>`
      select distinct on (apartment_type_id) * from rates where effective_from <= ${today}
      order by apartment_type_id, effective_from desc, created_at desc`,
  ]);
  return types.map((t) => ({
    ...t,
    units: units.filter((u) => u.apartment_type_id === t.id),
    rate: rates.find((r) => r.apartment_type_id === t.id) ?? null,
  }));
}

// ---------------------------------------------------------------- reservations list and CSV

export interface ReservationFilter {
  status?: ReservationStatus;
  typeId?: string;
  unitId?: string;
  /** arrival on or after (YYYY-MM-DD) */
  from?: string;
  /** arrival on or before (YYYY-MM-DD) */
  to?: string;
  /** reference, guest phone or guest name */
  q?: string;
}

const filterSchema = z.object({
  status: z.enum(RESERVATION_STATUSES).optional().catch(undefined),
  typeId: z.string().uuid().optional().catch(undefined),
  unitId: z.string().uuid().optional().catch(undefined),
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
});

/** Reads a filter from URL search params (unknown or malformed values are dropped, never trusted). */
export function parseReservationFilter(input: Record<string, string | string[] | undefined> | URLSearchParams): ReservationFilter {
  const get = (k: string) => {
    const v = input instanceof URLSearchParams ? input.get(k) ?? undefined : input[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s === "" ? undefined : s;
  };
  const out = filterSchema.parse({
    status: get("status"),
    typeId: get("typeId") ?? get("type"),
    unitId: get("unitId") ?? get("unit"),
    from: get("from"),
    to: get("to"),
    q: get("q"),
  });
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined && v !== "")) as ReservationFilter;
}

export type ReservationRow = Reservation & {
  type_name: string;
  type_short_name: string;
  type_slug: string;
  unit_name: string;
  amount_paid: number;
};

function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Reservations matching the filter, newest arrival first, with type, unit and the verified amount paid. */
export async function listReservations(filter: ReservationFilter = {}, limit = 500): Promise<ReservationRow[]> {
  const f = filterSchema.parse(filter);
  const s = sql();
  const q = f.q?.trim() ?? "";
  const digits = q.replace(/\D/g, "").replace(/^0+/, "");
  const search = q
    ? s`and (r.reference ilike ${likePattern(q)} or r.guest_name ilike ${likePattern(q)} or r.guest_phone ilike ${likePattern(q)}
         ${digits.length >= 3 ? s`or regexp_replace(r.guest_phone, '\\D', '', 'g') like ${likePattern(digits)}` : s``})`
    : s``;
  return s<ReservationRow[]>`
    select r.*, t.name as type_name, t.short_name as type_short_name, t.slug as type_slug, u.name as unit_name,
      coalesce((select sum(p.amount) from payments p where p.reservation_id = r.id and p.receipt_status = 'verified'), 0)::int
        as amount_paid
    from reservations r
    join apartment_types t on t.id = r.apartment_type_id
    join units u on u.id = r.unit_id
    where true
      ${f.status ? s`and r.status = ${f.status}` : s``}
      ${f.typeId ? s`and r.apartment_type_id = ${f.typeId}` : s``}
      ${f.unitId ? s`and r.unit_id = ${f.unitId}` : s``}
      ${f.from ? s`and r.check_in >= ${f.from}` : s``}
      ${f.to ? s`and r.check_in <= ${f.to}` : s``}
      ${search}
    order by r.check_in desc, r.created_at desc
    limit ${Math.max(1, Math.min(limit, 10_000))}`;
}

function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  // Spreadsheet formula injection: neutralise cells that a spreadsheet would evaluate (phone numbers stay as they are).
  if (/^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !/^[+-][\d\s]+$/.test(s))) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const CSV_HEADER = [
  "Reference",
  "Status",
  "Source",
  "Apartment",
  "Unit",
  "Arrival",
  "Departure",
  "Nights",
  "Adults",
  "Children",
  "Guest",
  "Phone",
  "Email",
  "Arrival time",
  "Requests",
  "Nightly rate",
  "Nights subtotal",
  "Extra adults",
  "Extra adults amount",
  "Amenities amount",
  "Tax label",
  "Tax rate percent",
  "Tax amount",
  "Total",
  "Amount due",
  "Amount paid",
  "Currency",
  "Created (PKT)",
  "Confirmed (PKT)",
  "Cancelled (PKT)",
  "Cancellation reason",
];

/**
 * CSV of the current filter: header row plus one row per reservation, CRLF line endings (RFC 4180), no BOM
 * (the route may prepend "﻿" for Excel). Instants are Karachi time.
 */
export async function reservationsCsv(filter: ReservationFilter = {}): Promise<string> {
  const rows = await listReservations(filter, 10_000);
  const t = (iso: string | null) => (iso ? karachiStamp(new Date(iso)) : "");
  const lines = [CSV_HEADER.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.reference,
        STATUS_WORD[r.status],
        r.source,
        r.type_name,
        r.unit_name,
        r.check_in,
        r.check_out,
        r.nights,
        r.adults,
        r.children,
        r.guest_name,
        r.guest_phone,
        r.guest_email,
        r.arrival_time,
        r.requests,
        r.nightly_rate,
        r.subtotal_nights,
        r.extra_adults,
        r.extra_adults_amount,
        r.amenities_amount,
        r.tax_label,
        r.tax_rate_percent ?? "",
        r.tax_amount,
        r.total,
        r.amount_due,
        r.amount_paid,
        r.currency,
        t(r.created_at),
        t(r.confirmed_at),
        t(r.cancelled_at),
        r.cancel_reason ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------- reservation detail

export interface ReservationDetail {
  reservation: Reservation;
  type: ApartmentType;
  unit: Unit;
  /** every unit of the same type (for "Move to another unit") */
  units: Unit[];
  amenities: ReservationAmenity[];
  payments: Payment[];
  /** newest first */
  activity: ActivityEntry[];
  /** sum of verified payments */
  amountPaid: number;
  /** total - amountPaid, never below zero ("Balance due at check-in" when deposit_policy is 50) */
  balance: number;
}

export async function getReservationDetail(id: string): Promise<ReservationDetail | null> {
  if (!uuid.safeParse(id).success) return null;
  const reservation = await getReservationById(id);
  if (!reservation) return null;
  const s = sql();
  const [[type], units, amenities, payments, activity, [paid]] = await Promise.all([
    s<ApartmentType[]>`select * from apartment_types where id = ${reservation.apartment_type_id}`,
    s<Unit[]>`select * from units where apartment_type_id = ${reservation.apartment_type_id} order by sort, name`,
    listReservationAmenities(id),
    listPayments(id),
    s<ActivityEntry[]>`select * from activity_log where reservation_id = ${id} order by created_at desc, id`,
    s<{ paid: number }[]>`
      select coalesce(sum(amount), 0)::int as paid from payments where reservation_id = ${id} and receipt_status = 'verified'`,
  ]);
  const unit = units.find((u) => u.id === reservation.unit_id)!;
  const amountPaid = paid?.paid ?? 0;
  return {
    reservation,
    type,
    unit,
    units,
    amenities,
    payments,
    activity,
    amountPaid,
    balance: Math.max(0, reservation.total - amountPaid),
  };
}

// ---------------------------------------------------------------- dashboard

export interface DashboardStay {
  id: string;
  reference: string;
  status: ReservationStatus;
  guest_name: string;
  guest_phone: string;
  check_in: string;
  check_out: string;
  nights: number;
  adults: number;
  children: number;
  arrival_time: string;
  type_name: string;
  type_short_name: string;
  type_slug: string;
  unit_name: string;
}

export interface AwaitingVerification {
  id: string;
  reference: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  amount_due: number;
  total: number;
  type_name: string;
  type_short_name: string;
  type_slug: string;
  unit_name: string;
  /** the oldest receipt still awaiting verification (null if none was recorded) */
  payment_id: string | null;
  /** the amount the guest stated on the upload, if any */
  stated_amount: number | null;
  uploaded_at: string;
  minutes_since_upload: number;
}

export type OccupancyState = "free" | "reserved" | "confirmed" | "blocked";
export interface OccupancyDay {
  date: string;
  state: OccupancyState;
  reservationId?: string;
  reference?: string;
  guestName?: string;
  blockReason?: BlockReason;
}
export interface UnitOccupancy {
  unitId: string;
  unitName: string;
  typeId: string;
  typeName: string;
  typeShortName: string;
  typeSlug: string;
  days: OccupancyDay[];
}

export interface HoldEnding {
  id: string;
  reference: string;
  guest_name: string;
  guest_phone: string;
  check_in: string;
  check_out: string;
  amount_due: number;
  hold_expires_at: string;
  minutes_left: number;
  type_short_name: string;
  type_slug: string;
  unit_name: string;
}

export interface Dashboard {
  /** Karachi today */
  today: string;
  arrivals: DashboardStay[];
  departures: DashboardStay[];
  /** payment_submitted, oldest receipt first */
  awaiting: AwaitingVerification[];
  /** next 30 nights from today, one row per active unit */
  occupancy: UnitOccupancy[];
  /** sum of total - tax_amount for confirmed, checked-in and completed stays arriving this Karachi month */
  revenueThisMonth: number;
  /** first day of the current Karachi month */
  month: string;
  /** reserved holds ending within 2 hours */
  holdsEndingSoon: HoldEnding[];
}

export async function dashboard(): Promise<Dashboard> {
  const s = sql();
  const today = todayInKarachi();
  const end = addDays(today, 30);
  const ms = monthStart(today);
  const nextMs = addMonths(today, 1);

  const stayCols = s`
    r.id, r.reference, r.status, r.guest_name, r.guest_phone, r.check_in, r.check_out, r.nights, r.adults, r.children,
    r.arrival_time, t.name as type_name, t.short_name as type_short_name, t.slug as type_slug, u.name as unit_name`;

  const [arrivals, departures, awaiting, units, stays, blocks, [revenue], holds] = await Promise.all([
    s<DashboardStay[]>`
      select ${stayCols} from reservations r
      join apartment_types t on t.id = r.apartment_type_id join units u on u.id = r.unit_id
      where r.check_in = ${today} and r.status in ('reserved','payment_submitted','confirmed','checked_in')
      order by t.sort, u.sort, r.reference`,
    s<DashboardStay[]>`
      select ${stayCols} from reservations r
      join apartment_types t on t.id = r.apartment_type_id join units u on u.id = r.unit_id
      where r.check_out = ${today} and r.status in ('confirmed','checked_in','completed')
      order by t.sort, u.sort, r.reference`,
    s<AwaitingVerification[]>`
      select r.id, r.reference, r.guest_name, r.check_in, r.check_out, r.amount_due, r.total,
        t.name as type_name, t.short_name as type_short_name, t.slug as type_slug, u.name as unit_name,
        p.id as payment_id, p.amount as stated_amount,
        coalesce(p.created_at, r.updated_at) as uploaded_at,
        floor(extract(epoch from now() - coalesce(p.created_at, r.updated_at)) / 60)::int as minutes_since_upload
      from reservations r
      join apartment_types t on t.id = r.apartment_type_id
      join units u on u.id = r.unit_id
      left join lateral (
        select id, amount, created_at from payments
        where reservation_id = r.id and receipt_status = 'submitted' order by created_at asc limit 1
      ) p on true
      where r.status = 'payment_submitted'
      order by uploaded_at asc`,
    s<(Unit & { type_name: string; type_short_name: string; type_slug: string })[]>`
      select u.*, t.name as type_name, t.short_name as type_short_name, t.slug as type_slug
      from units u join apartment_types t on t.id = u.apartment_type_id
      where u.active order by t.sort, u.sort, u.name`,
    s<Pick<Reservation, "id" | "reference" | "guest_name" | "unit_id" | "status" | "check_in" | "check_out">[]>`
      select id, reference, guest_name, unit_id, status, check_in, check_out from reservations
      where status in ('reserved','payment_submitted','confirmed','checked_in')
        and check_in < ${end} and check_out > ${today}`,
    s<Pick<UnitBlock, "unit_id" | "starts_on" | "ends_on" | "reason">[]>`
      select unit_id, starts_on, ends_on, reason from unit_blocks where starts_on < ${end} and ends_on > ${today}`,
    s<{ revenue: number }[]>`
      select coalesce(sum(total - tax_amount), 0)::int as revenue from reservations
      where status in ('confirmed','checked_in','completed') and check_in >= ${ms} and check_in < ${nextMs}`,
    s<HoldEnding[]>`
      select r.id, r.reference, r.guest_name, r.guest_phone, r.check_in, r.check_out, r.amount_due, r.hold_expires_at,
        ceil(extract(epoch from r.hold_expires_at - now()) / 60)::int as minutes_left,
        t.short_name as type_short_name, t.slug as type_slug, u.name as unit_name
      from reservations r
      join apartment_types t on t.id = r.apartment_type_id
      join units u on u.id = r.unit_id
      where r.status = 'reserved' and r.hold_expires_at > now() and r.hold_expires_at <= now() + interval '2 hours'
      order by r.hold_expires_at`,
  ]);

  const nights = nightsOf(today, end);
  const occupancy: UnitOccupancy[] = units.map((u) => {
    const days: OccupancyDay[] = nights.map((date) => {
      const b = blocks.find((x) => x.unit_id === u.id && x.starts_on <= date && date < x.ends_on);
      if (b) return { date, state: "blocked", blockReason: b.reason as BlockReason };
      const r = stays.find((x) => x.unit_id === u.id && x.check_in <= date && date < x.check_out);
      if (!r) return { date, state: "free" };
      return {
        date,
        state: r.status === "confirmed" || r.status === "checked_in" ? "confirmed" : "reserved",
        reservationId: r.id,
        reference: r.reference,
        guestName: r.guest_name,
      };
    });
    return {
      unitId: u.id,
      unitName: u.name,
      typeId: u.apartment_type_id,
      typeName: u.type_name,
      typeShortName: u.type_short_name,
      typeSlug: u.type_slug,
      days,
    };
  });

  return {
    today,
    arrivals,
    departures,
    awaiting,
    occupancy,
    revenueThisMonth: revenue?.revenue ?? 0,
    month: ms,
    holdsEndingSoon: holds,
  };
}

// ---------------------------------------------------------------- calendar

export type CalendarStay = Pick<
  Reservation,
  "id" | "reference" | "guest_name" | "status" | "unit_id" | "apartment_type_id" | "check_in" | "check_out" | "adults" | "children"
>;
export type BlockRow = UnitBlock & { unit_name: string; apartment_type_id: string; type_short_name: string; created_at: string };

/**
 * Everything the calendar needs for [from, to): units (active and inactive) with their type, the stays that
 * overlap (active and completed; cancelled and expired are left out) and the blocks that overlap.
 */
export async function calendarRange(from: string, to: string) {
  const a = parse(isoDate, from);
  const b = parse(isoDate, to);
  if (b <= a) throw new AdminError("The end of the range must be after the start.");
  const s = sql();
  const [units, stays, blocks] = await Promise.all([
    s<(Unit & { type_name: string; type_short_name: string; type_slug: string })[]>`
      select u.*, t.name as type_name, t.short_name as type_short_name, t.slug as type_slug
      from units u join apartment_types t on t.id = u.apartment_type_id order by t.sort, u.sort, u.name`,
    s<CalendarStay[]>`
      select id, reference, guest_name, status, unit_id, apartment_type_id, check_in, check_out, adults, children
      from reservations
      where status in ('reserved','payment_submitted','confirmed','checked_in','completed')
        and check_in < ${b} and check_out > ${a}
      order by check_in`,
    listBlocks(a, b),
  ]);
  return { units, stays, blocks };
}

// ---------------------------------------------------------------- reservation actions

const moveInput = z.object({ reservationId: uuid, unitId: z.string().uuid("Choose a unit.") });

/** Moves an active stay to another free unit of the same type. */
export async function moveUnit(reservationId: string, unitId: string, admin: AdminActor): Promise<Reservation> {
  const input = parse(moveInput, { reservationId, unitId });
  const current = await loadReservation(input.reservationId);
  try {
    return await sql().begin(async (tx) => {
      // Same lock order as create_reservation(): the type row first, then the reservation.
      await tx`select id from apartment_types where id = ${current.apartment_type_id} for update`;
      const [r] = await tx<Reservation[]>`select * from reservations where id = ${current.id} for update`;
      if (!r) throw new AdminError("Reservation not found.");
      if (!OCCUPYING.includes(r.status)) {
        throw new AdminError(`This reservation is ${STATUS_WORD[r.status].toLowerCase()}; only an active stay can be moved.`);
      }
      if (r.unit_id === input.unitId) throw new AdminError("The reservation is already in that unit.");
      const units = await tx<Unit[]>`select * from units where id in ${tx([r.unit_id, input.unitId])}`;
      const target = units.find((u) => u.id === input.unitId);
      const from = units.find((u) => u.id === r.unit_id);
      if (!target || target.apartment_type_id !== r.apartment_type_id) {
        throw new AdminError("Choose a unit of the same apartment type.", { unitId: "Choose a unit of the same apartment type." });
      }
      if (!target.active) throw new AdminError("That unit is not active.", { unitId: "That unit is not active." });
      const [{ free }] = await tx<{ free: boolean }[]>`select unit_is_free(${target.id}, ${r.check_in}, ${r.check_out}, ${r.id}) as free`;
      if (!free) throw new AdminError(NIGHTS_TAKEN, { unitId: NIGHTS_TAKEN });
      const [updated] = await tx<Reservation[]>`update reservations set unit_id = ${target.id} where id = ${r.id} returning *`;
      await log(tx, admin, "unit_moved", r.id, { from: r.unit_id, to: target.id, from_name: from?.name ?? "", to_name: target.name });
      return updated;
    });
  } catch (e) {
    mapDbError(e);
  }
}

const noteInput = z.object({ reservationId: uuid, text: required(2000, "Write the note first.") });

/** Appends "[YYYY-MM-DD HH:MM PKT · email] text" to admin_notes (visible to admins only). */
export async function addNote(reservationId: string, text: string, admin: AdminActor): Promise<Reservation> {
  const input = parse(noteInput, { reservationId, text });
  const entry = `[${karachiStamp()} PKT · ${admin.email}] ${input.text}`;
  return sql().begin(async (tx) => {
    const [r] = await tx<Reservation[]>`
      update reservations
      set admin_notes = case when admin_notes = '' then ${entry} else admin_notes || ${"\n\n"} || ${entry} end
      where id = ${input.reservationId} returning *`;
    if (!r) throw new AdminError("Reservation not found.");
    await log(tx, admin, "note_added", r.id, { length: input.text.length });
    return r;
  });
}

export const PAYMENT_METHODS = ["bank_transfer", "cash", "other"] as const satisfies readonly PaymentMethod[];

export const recordPaymentInput = z.object({
  reservationId: uuid,
  method: z.enum(PAYMENT_METHODS, { errorMap: () => ({ message: "Choose how it was paid." }) }),
  amount: intIn(1, 100_000_000, "Enter the amount received in whole rupees."),
  bankReference: z.preprocess(emptyToNull, text(100).nullable()).default(null),
  note: text(500).default(""),
});

/**
 * Records a payment the owner received (cash, or a transfer without an uploaded receipt) as verified. A reserved
 * or payment_submitted reservation becomes confirmed; caller sends the "confirmed" email when `email` is set.
 */
export async function recordPayment(
  input: { reservationId: string; method: string; amount: number | string; bankReference?: string | null; note?: string },
  admin: AdminActor,
): Promise<AdminOutcome & { payment: Payment }> {
  const p = parse(recordPaymentInput, input);
  const r = await loadReservation(p.reservationId);
  if (r.status === "cancelled" || r.status === "expired") {
    throw new AdminError(`This reservation is ${STATUS_WORD[r.status].toLowerCase()}. Record the payment against a new reservation.`);
  }
  const s = sql();
  const [payment] = await s<Payment[]>`
    insert into payments (reservation_id, method, amount, receipt_path, receipt_status, bank_reference, recorded_by, verified_by, verified_at, note)
    values (${r.id}, ${p.method}, ${p.amount}, null, 'verified', ${p.bankReference}, ${admin.email}, ${admin.email}, now(), ${p.note})
    returning *`;
  await log(s, admin, "payment:recorded", r.id, { payment_id: payment.id, method: p.method, amount: p.amount });
  if (r.status === "reserved" || r.status === "payment_submitted") {
    const reservation = await adminTransition(r, "confirmed", admin, { payment_id: payment.id, method: p.method, amount: p.amount });
    return { reservation, payment, email: { kind: "confirmed" } };
  }
  return { reservation: r, payment, email: null };
}

async function loadSubmittedReceipt(paymentId: string): Promise<{ payment: Payment; reservation: Reservation }> {
  const id = parse(uuid, paymentId);
  const [payment] = await sql()<Payment[]>`select * from payments where id = ${id}`;
  if (!payment) throw new AdminError("Payment not found.");
  if (payment.receipt_status !== "submitted") {
    throw new AdminError(
      payment.receipt_status === "verified"
        ? "This receipt is already verified."
        : payment.receipt_status === "rejected"
          ? "This receipt was already rejected."
          : "There is no receipt awaiting verification here.",
    );
  }
  return { payment, reservation: await loadReservation(payment.reservation_id) };
}

/**
 * "Verify and confirm": marks the receipt verified (amount: the owner's figure, else the guest's stated amount,
 * else the amount due) and moves payment_submitted (or reserved) to confirmed.
 */
export async function verifyPayment(paymentId: string, admin: AdminActor, opts: { amount?: number | string } = {}): Promise<AdminOutcome> {
  const { payment, reservation: r } = await loadSubmittedReceipt(paymentId);
  const override = opts.amount === undefined || opts.amount === "" ? null : parse(intIn(1, 100_000_000, "Enter the amount received in whole rupees."), opts.amount);
  const amount = override ?? payment.amount ?? r.amount_due;
  const s = sql();
  let reservation = r;
  let email: EmailHint = null;
  if (r.status === "payment_submitted" || r.status === "reserved") {
    reservation = await adminTransition(r, "confirmed", admin, { payment_id: payment.id, amount });
    email = { kind: "confirmed" };
  } else if (!["confirmed", "checked_in", "completed"].includes(r.status)) {
    throw new AdminError(`This reservation is ${STATUS_WORD[r.status].toLowerCase()}; its receipt can no longer be verified.`);
  }
  await s`
    update payments set receipt_status = 'verified', amount = ${amount}, verified_by = ${admin.email}, verified_at = now()
    where id = ${payment.id}`;
  if (!email) await log(s, admin, "payment:verified", r.id, { payment_id: payment.id, amount });
  return { reservation, email };
}

const reasonSchema = z.string().trim().min(2, "Give a short reason.").max(500, "Keep the reason under 500 characters.");

/**
 * "Reject receipt" with a reason shown to the guest. When no other receipt is waiting, payment_submitted returns to
 * reserved (transition_reservation extends the hold once). Caller sends "receipt_rejected" with { reason }.
 */
export async function rejectPayment(paymentId: string, reason: string, admin: AdminActor): Promise<AdminOutcome> {
  const why = parse(reasonSchema, reason);
  const { payment, reservation: r } = await loadSubmittedReceipt(paymentId);
  const s = sql();
  const [{ others }] = await s<{ others: number }[]>`
    select count(*)::int as others from payments
    where reservation_id = ${r.id} and receipt_status = 'submitted' and id <> ${payment.id}`;
  let reservation = r;
  let transitioned = false;
  if (r.status === "payment_submitted" && others === 0) {
    reservation = await adminTransition(r, "reserved", admin, { reason: why, payment_id: payment.id });
    transitioned = true;
  }
  await s`update payments set receipt_status = 'rejected', rejection_reason = ${why} where id = ${payment.id}`;
  if (!transitioned) await log(s, admin, "payment:rejected", r.id, { payment_id: payment.id, reason: why });
  const active = reservation.status === "reserved" || reservation.status === "payment_submitted";
  return { reservation, email: active ? { kind: "receipt_rejected", extra: { reason: why } } : null };
}

/** Cancels reserved, payment_submitted or confirmed stays with a reason. Caller sends "cancelled". */
export async function cancelReservation(id: string, reason: string, admin: AdminActor): Promise<AdminOutcome> {
  const why = parse(reasonSchema, reason);
  const r = await loadReservation(id);
  if (!["reserved", "payment_submitted", "confirmed"].includes(r.status)) {
    throw new AdminError(`This reservation is ${STATUS_WORD[r.status].toLowerCase()} and cannot be cancelled.`);
  }
  const reservation = await adminTransition(r, "cancelled", admin, { reason: why });
  return { reservation, email: { kind: "cancelled" } };
}

/** confirmed -> checked_in */
export async function checkIn(id: string, admin: AdminActor): Promise<AdminOutcome> {
  const r = await loadReservation(id);
  if (r.status !== "confirmed") {
    throw new AdminError(`This reservation is ${STATUS_WORD[r.status].toLowerCase()}; only a confirmed stay can be checked in.`);
  }
  return { reservation: await adminTransition(r, "checked_in", admin), email: null };
}

/** checked_in -> completed */
export async function checkOut(id: string, admin: AdminActor): Promise<AdminOutcome> {
  const r = await loadReservation(id);
  if (r.status !== "checked_in") {
    throw new AdminError(`This reservation is ${STATUS_WORD[r.status].toLowerCase()}; only a checked-in stay can be checked out.`);
  }
  return { reservation: await adminTransition(r, "completed", admin), email: null };
}

// ---------------------------------------------------------------- blocks

export const BLOCK_REASONS = ["maintenance", "owner_use", "other"] as const satisfies readonly BlockReason[];

/** Blocks overlapping [from, to), with unit and type names. */
export async function listBlocks(from: string, to: string): Promise<BlockRow[]> {
  const a = parse(isoDate, from);
  const b = parse(isoDate, to);
  return sql()<BlockRow[]>`
    select ub.*, u.name as unit_name, u.apartment_type_id, t.short_name as type_short_name
    from unit_blocks ub join units u on u.id = ub.unit_id join apartment_types t on t.id = u.apartment_type_id
    where ub.starts_on < ${b} and ub.ends_on > ${a}
    order by ub.starts_on, t.sort, u.sort`;
}

export const blockInput = z
  .object({
    unitId: z.string().uuid("Choose a unit."),
    startsOn: isoDate,
    /** exclusive: the morning after the last blocked night */
    endsOn: isoDate,
    reason: z.enum(BLOCK_REASONS, { errorMap: () => ({ message: "Choose a reason." }) }),
    note: text(300).default(""),
  })
  .refine((v) => v.endsOn > v.startsOn, { message: "Choose at least one night.", path: ["endsOn"] })
  .refine((v) => v.endsOn <= addDays(v.startsOn, 366), { message: "Block at most a year at a time.", path: ["endsOn"] });

/** Blocks the nights [startsOn, endsOn) of a unit. Refused when a reservation or another block holds any of them. */
export async function createBlock(
  input: { unitId: string; startsOn: string; endsOn: string; reason: string; note?: string },
  admin: AdminActor,
): Promise<UnitBlock> {
  const b = parse(blockInput, input);
  try {
    return await sql().begin(async (tx) => {
      const [unit] = await tx<Unit[]>`select * from units where id = ${b.unitId}`;
      if (!unit) throw new AdminError("Unit not found.", { unitId: "Unit not found." });
      // Serialise with create_reservation(), which locks the type row before choosing a unit.
      await tx`select id from apartment_types where id = ${unit.apartment_type_id} for update`;
      const clash = await tx<{ reference: string }[]>`
        select reference from reservations
        where unit_id = ${unit.id} and status in ('reserved','payment_submitted','confirmed','checked_in')
          and daterange(check_in, check_out, '[)') && daterange(${b.startsOn}::date, ${b.endsOn}::date, '[)')
        order by check_in limit 3`;
      if (clash.length) {
        throw new AdminError(`${RESERVED_NIGHTS} (${clash.map((c) => c.reference).join(", ")})`, { startsOn: RESERVED_NIGHTS });
      }
      const [block] = await tx<UnitBlock[]>`
        insert into unit_blocks (unit_id, starts_on, ends_on, reason, note)
        values (${unit.id}, ${b.startsOn}, ${b.endsOn}, ${b.reason}, ${b.note}) returning *`;
      await log(tx, admin, "block:created", null, {
        block_id: block.id,
        unit_id: unit.id,
        unit_name: unit.name,
        starts_on: b.startsOn,
        ends_on: b.endsOn,
        reason: b.reason,
      });
      return block;
    });
  } catch (e) {
    mapDbError(e, { exclusion: "Some of those nights are already blocked." });
  }
}

export async function deleteBlock(id: string, admin: AdminActor): Promise<void> {
  const blockId = parse(uuid, id);
  await sql().begin(async (tx) => {
    const [b] = await tx<UnitBlock[]>`delete from unit_blocks where id = ${blockId} returning *`;
    if (!b) throw new AdminError("That block no longer exists.");
    await log(tx, admin, "block:deleted", null, { block_id: b.id, unit_id: b.unit_id, starts_on: b.starts_on, ends_on: b.ends_on, reason: b.reason });
  });
}

// ---------------------------------------------------------------- settings: property

const timeOrPlaceholder = z
  .string()
  .trim()
  .max(20)
  .refine((v) => isPlaceholder(v) || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), "Enter a time as HH:MM, for example 15:00.");
const emailOrPlaceholder = z
  .string()
  .trim()
  .max(200)
  .refine((v) => isPlaceholder(v) || z.string().email().safeParse(v).success, "Enter an email address.");

export const PROPERTY_FIELDS = [
  "tax_rate_percent",
  "tax_label",
  "hold_hours",
  "confirm_within_hours",
  "deposit_policy",
  "free_cancellation_days",
  "cancellation_text",
  "child_max_age",
  "child_extra_policy",
  "child_extra_fee",
  "whatsapp_number",
  "phone_display",
  "email",
  "owner_notify_email",
  "check_in",
  "check_out",
  "min_nights",
  "max_nights",
  "receipt_retention_months",
] as const satisfies readonly (keyof Settings)[];

export const propertyInput = z
  .object({
    tax_rate_percent: z.preprocess(
      emptyToNull,
      z.coerce
        .number({ invalid_type_error: "Enter a percentage between 0 and 100, or leave it empty." })
        .min(0, "Enter a percentage between 0 and 100, or leave it empty.")
        .max(100, "Enter a percentage between 0 and 100, or leave it empty.")
        .nullable(),
    ),
    tax_label: required(80, "Enter the label for the tax line."),
    hold_hours: intIn(1, 168, "Enter a hold between 1 and 168 hours."),
    confirm_within_hours: required(40, "Enter how soon a receipt is confirmed."),
    deposit_policy: z.enum(["full", "50"], { errorMap: () => ({ message: "Choose a deposit policy." }) }),
    free_cancellation_days: nullableInt(0, 365, "Enter a number of days, or leave it empty."),
    cancellation_text: required(1000, "Enter the cancellation wording."),
    child_max_age: nullableInt(0, 17, "Enter an age from 0 to 17, or leave it empty."),
    child_extra_policy: z.enum(["same_as_adult", "reduced", "free"], { errorMap: () => ({ message: "Choose a child policy." }) }),
    child_extra_fee: nullableInt(0, 1_000_000, "Enter a whole number of rupees, or leave it empty."),
    whatsapp_number: z
      .string()
      .trim()
      .max(30)
      .refine(
        (v) => isPlaceholder(v) || /^\+?\d{10,15}$/.test(v.replace(/[\s-]/g, "")),
        "Enter the number with its country code, digits only.",
      ),
    phone_display: required(40, "Enter the phone number as guests should see it."),
    email: emailOrPlaceholder,
    owner_notify_email: emailOrPlaceholder,
    check_in: timeOrPlaceholder,
    check_out: timeOrPlaceholder,
    min_nights: intIn(1, 30, "Enter a minimum between 1 and 30 nights."),
    max_nights: intIn(1, 365, "Enter a maximum between 1 and 365 nights."),
    receipt_retention_months: intIn(1, 120, "Enter between 1 and 120 months."),
  })
  .partial();

/** Updates whitelisted property settings (only the keys present). Logs old and new values. */
export async function updateProperty(fields: Record<string, unknown>, admin: AdminActor): Promise<Settings> {
  const picked = Object.fromEntries(Object.entries(fields).filter(([k]) => (PROPERTY_FIELDS as readonly string[]).includes(k)));
  const input = parse(propertyInput, picked);
  return sql().begin(async (tx) => {
    const [current] = await tx<Settings[]>`select * from settings where id for update`;
    if (!current) throw new Error("settings row missing");
    const merged = { ...current, ...input };
    if (merged.min_nights > merged.max_nights) {
      throw new AdminError("The minimum stay cannot be longer than the maximum.", { min_nights: "The minimum stay cannot be longer than the maximum." });
    }
    const changes: Record<string, string | number | null> = {};
    const logged: Record<string, { from: unknown; to: unknown }> = {};
    for (const [k, v] of Object.entries(input)) {
      const before = current[k as keyof Settings];
      if (v === undefined || before === v) continue;
      changes[k] = v as string | number | null;
      logged[k] = { from: before, to: v };
    }
    if (Object.keys(changes).length === 0) return current;
    const [updated] = await tx<Settings[]>`update settings set ${tx(changes)}, updated_at = now() where id returning *`;
    await log(tx, admin, "settings:property_changed", null, { changes: logged });
    return updated;
  });
}

// ---------------------------------------------------------------- settings: bank

export const BANK_FIELDS = ["bank_name", "account_title", "account_number", "iban", "branch", "swift", "raast_id"] as const satisfies readonly (keyof Settings)[];

function groupIban(v: string): string {
  return v.replace(/\s+/g, "").toUpperCase().replace(/(.{4})(?=.)/g, "$1 ");
}

export const bankInput = z
  .object({
    bank_name: required(120, "Enter the bank name."),
    account_title: required(120, "Enter the account title."),
    account_number: required(40, "Enter the account number.").refine(
      (v) => isPlaceholder(v) || /^[0-9][0-9 -]{5,38}$/.test(v),
      "Enter the account number in digits.",
    ),
    iban: required(40, "Enter the IBAN.")
      .refine(
        (v) => isPlaceholder(v) || /^PK\d{2}[A-Z]{4}[0-9]{16}$/.test(v.replace(/\s+/g, "").toUpperCase()),
        "Enter a 24-character Pakistani IBAN: PK, two digits, four letters, sixteen digits.",
      )
      .transform((v) => (isPlaceholder(v) ? v : groupIban(v))),
    branch: required(120, "Enter the branch name and code."),
    swift: required(40, "Enter the SWIFT code.")
      .refine((v) => isPlaceholder(v) || /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(v.toUpperCase()), "Enter an 8 or 11 character SWIFT code.")
      .transform((v) => (isPlaceholder(v) ? v : v.toUpperCase())),
    raast_id: text(60),
  })
  .partial();

/** Every character but the last four replaced, so the log proves a change without repeating the details. */
export function maskTail(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (s.length <= 4) return "•".repeat(s.length);
  return "•".repeat(s.length - 4) + s.slice(-4);
}

/** Updates the bank details guests pay into; logs 'bank_details_changed' with old and new values masked. */
export async function updateBank(fields: Record<string, unknown>, admin: AdminActor): Promise<Settings> {
  const picked = Object.fromEntries(Object.entries(fields).filter(([k]) => (BANK_FIELDS as readonly string[]).includes(k)));
  const input = parse(bankInput, picked);
  return sql().begin(async (tx) => {
    const [current] = await tx<Settings[]>`select * from settings where id for update`;
    if (!current) throw new Error("settings row missing");
    const changes: Record<string, string> = {};
    const logged: Record<string, { from: string; to: string }> = {};
    for (const [k, v] of Object.entries(input)) {
      const before = current[k as keyof Settings] as string;
      if (v === undefined || before === v) continue;
      changes[k] = v;
      logged[k] = { from: maskTail(before), to: maskTail(v) };
    }
    if (Object.keys(changes).length === 0) return current;
    const [updated] = await tx<Settings[]>`update settings set ${tx(changes)}, updated_at = now() where id returning *`;
    await log(tx, admin, "bank_details_changed", null, { changes: logged });
    return updated;
  });
}

// ---------------------------------------------------------------- settings: amenities

export const PRICING_TYPES = ["per_stay", "per_night", "per_guest_per_night", "per_trip", "per_day"] as const;

export type AdminAmenity = Amenity & { used: boolean };

/** All amenities, active and not, in display order, with whether any reservation uses each. */
export async function listAllAmenities(): Promise<AdminAmenity[]> {
  return sql()<AdminAmenity[]>`
    select a.*, exists (select 1 from reservation_amenities ra where ra.amenity_id = a.id) as used
    from amenities a order by a.sort, a.name`;
}

export const amenityInput = z.object({
  id: z.preprocess(emptyToNull, z.string().uuid().nullable()).optional(),
  name: required(80, "Enter a name."),
  description: text(400).default(""),
  pricing_type: z.enum(PRICING_TYPES, { errorMap: () => ({ message: "Choose how it is priced." }) }),
  price: nullableInt(0, 1_000_000, "Enter a whole number of rupees, or leave it empty while the price is to be confirmed."),
  max_quantity: intIn(1, 30, "Enter a maximum between 1 and 30."),
  active: boolish.optional(),
});

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "amenity"
  );
}

/** Creates (no id) or updates an amenity. Reservations keep their own snapshot, so edits never change them. */
export async function saveAmenity(
  input: {
    id?: string | null;
    name: string;
    description?: string;
    pricing_type: string;
    price: number | string | null;
    max_quantity: number | string;
    active?: boolean | string;
  },
  admin: AdminActor,
): Promise<Amenity> {
  const a = parse(amenityInput, input);
  try {
    return await sql().begin(async (tx) => {
      if (a.id) {
        const [before] = await tx<Amenity[]>`select * from amenities where id = ${a.id} for update`;
        if (!before) throw new AdminError("Amenity not found.");
        const [row] = await tx<Amenity[]>`
          update amenities set name = ${a.name}, description = ${a.description}, pricing_type = ${a.pricing_type},
            price = ${a.price}, max_quantity = ${a.max_quantity}, active = ${a.active ?? before.active}
          where id = ${a.id} returning *`;
        await log(tx, admin, "amenity:updated", null, {
          amenity_id: row.id,
          name: row.name,
          from: { price: before.price, pricing_type: before.pricing_type, max_quantity: before.max_quantity, active: before.active },
          to: { price: row.price, pricing_type: row.pricing_type, max_quantity: row.max_quantity, active: row.active },
        });
        return row;
      }
      const base = slugify(a.name);
      const taken = await tx<{ slug: string }[]>`select slug from amenities where slug = ${base} or slug like ${`${base}-%`}`;
      let slug = base;
      for (let n = 2; taken.some((t) => t.slug === slug); n++) slug = `${base}-${n}`;
      const [row] = await tx<Amenity[]>`
        insert into amenities (slug, name, description, pricing_type, price, max_quantity, active, sort)
        values (${slug}, ${a.name}, ${a.description}, ${a.pricing_type}, ${a.price}, ${a.max_quantity}, ${a.active ?? true},
                (select coalesce(max(sort), 0) + 1 from amenities))
        returning *`;
      await log(tx, admin, "amenity:created", null, { amenity_id: row.id, name: row.name, price: row.price });
      return row;
    });
  } catch (e) {
    mapDbError(e, { unique: "An amenity with that name already exists." });
  }
}

export async function setAmenityActive(id: string, active: boolean, admin: AdminActor): Promise<Amenity> {
  const amenityId = parse(uuid, id);
  return sql().begin(async (tx) => {
    const [row] = await tx<Amenity[]>`update amenities set active = ${Boolean(active)} where id = ${amenityId} returning *`;
    if (!row) throw new AdminError("Amenity not found.");
    await log(tx, admin, active ? "amenity:activated" : "amenity:deactivated", null, { amenity_id: row.id, name: row.name });
    return row;
  });
}

/** Sets the display order to the order of `ids` (1, 2, 3, ...). */
export async function reorderAmenities(ids: string[], admin: AdminActor): Promise<void> {
  const list = parse(z.array(z.string().uuid()).min(1).max(200), ids);
  if (new Set(list).size !== list.length) throw new AdminError("Each amenity can appear only once.");
  await sql().begin(async (tx) => {
    for (let i = 0; i < list.length; i++) {
      const res = await tx`update amenities set sort = ${i + 1} where id = ${list[i]}`;
      if (res.count === 0) throw new AdminError("One of those amenities no longer exists. Reload and try again.");
    }
    await log(tx, admin, "amenities:reordered", null, { order: list });
  });
}

const AMENITY_IN_USE = "Used by a reservation; deactivate it instead.";

/** Deletes an amenity that no reservation has ever used. */
export async function deleteAmenity(id: string, admin: AdminActor): Promise<void> {
  const amenityId = parse(uuid, id);
  try {
    await sql().begin(async (tx) => {
      const [{ used }] = await tx<{ used: boolean }[]>`
        select exists (select 1 from reservation_amenities where amenity_id = ${amenityId}) as used`;
      if (used) throw new AdminError(AMENITY_IN_USE);
      const [row] = await tx<Amenity[]>`delete from amenities where id = ${amenityId} returning *`;
      if (!row) throw new AdminError("Amenity not found.");
      await log(tx, admin, "amenity:deleted", null, { amenity_id: row.id, name: row.name, slug: row.slug });
    });
  } catch (e) {
    mapDbError(e, { foreignKey: AMENITY_IN_USE });
  }
}

// ---------------------------------------------------------------- settings: rates

export type RateRow = Rate & { created_at: string; in_force: boolean };

/** Rate history for a type, newest effective date first; `in_force` marks the row pricing arrivals today. */
export async function listRates(typeId: string): Promise<RateRow[]> {
  const id = parse(uuid, typeId);
  const today = todayInKarachi();
  const rows = await sql()<(Rate & { created_at: string })[]>`
    select * from rates where apartment_type_id = ${id} order by effective_from desc, created_at desc`;
  const current = rows.find((r) => r.effective_from <= today);
  return rows.map((r) => ({ ...r, in_force: r === current }));
}

export const rateInput = z.object({
  typeId: z.string().uuid("Choose an apartment."),
  nightlyRate: intIn(1, 10_000_000, "Enter the nightly rate in whole rupees."),
  extraAdultPerNight: nullableInt(0, 10_000_000, "Enter a whole number of rupees, or leave it empty for no extra-guest charge."),
  effectiveFrom: isoDate,
});

/**
 * Schedules a rate from a date (today or later). Stays are priced at the latest rate effective on their arrival
 * date; existing reservations keep their stored breakdown. A second rate for the same date replaces the first.
 */
export async function addRate(
  input: { typeId: string; nightlyRate: number | string; extraAdultPerNight: number | string | null; effectiveFrom: string },
  admin: AdminActor,
): Promise<Rate> {
  const r = parse(rateInput, input);
  if (r.effectiveFrom < todayInKarachi()) {
    throw new AdminError("Choose today or a later date.", { effectiveFrom: "Choose today or a later date." });
  }
  return sql().begin(async (tx) => {
    const [type] = await tx<ApartmentType[]>`select * from apartment_types where id = ${r.typeId} for update`;
    if (!type) throw new AdminError("Apartment type not found.", { typeId: "Apartment type not found." });
    const [existing] = await tx<Rate[]>`
      select * from rates where apartment_type_id = ${r.typeId} and effective_from = ${r.effectiveFrom} limit 1`;
    const [row] = existing
      ? await tx<Rate[]>`
          update rates set nightly_rate = ${r.nightlyRate}, extra_adult_per_night = ${r.extraAdultPerNight}
          where id = ${existing.id} returning *`
      : await tx<Rate[]>`
          insert into rates (apartment_type_id, nightly_rate, extra_adult_per_night, effective_from)
          values (${r.typeId}, ${r.nightlyRate}, ${r.extraAdultPerNight}, ${r.effectiveFrom}) returning *`;
    await log(tx, admin, existing ? "rate:updated" : "rate:added", null, {
      rate_id: row.id,
      type: type.short_name,
      nightly_rate: row.nightly_rate,
      extra_adult_per_night: row.extra_adult_per_night,
      effective_from: row.effective_from,
      ...(existing ? { from: { nightly_rate: existing.nightly_rate, extra_adult_per_night: existing.extra_adult_per_night } } : {}),
    });
    return row;
  });
}

// ---------------------------------------------------------------- settings: units

export const unitInput = z.object({
  id: z.preprocess(emptyToNull, z.string().uuid().nullable()).optional(),
  typeId: z.string().uuid("Choose an apartment type."),
  name: required(60, "Enter a unit name."),
  sort: z.preprocess(emptyToNull, z.coerce.number().int().min(0).max(1000).nullable()).optional(),
});

/** Creates a unit of a type, or renames/reorders one (a unit never changes type). */
export async function saveUnit(
  input: { id?: string | null; typeId: string; name: string; sort?: number | string | null },
  admin: AdminActor,
): Promise<Unit> {
  const u = parse(unitInput, input);
  return sql().begin(async (tx) => {
    if (u.id) {
      const [before] = await tx<Unit[]>`select * from units where id = ${u.id} for update`;
      if (!before) throw new AdminError("Unit not found.");
      const [row] = await tx<Unit[]>`
        update units set name = ${u.name}, sort = ${u.sort ?? before.sort} where id = ${u.id} returning *`;
      await log(tx, admin, "unit:updated", null, { unit_id: row.id, from: before.name, to: row.name, sort: row.sort });
      return row;
    }
    const [type] = await tx<ApartmentType[]>`select * from apartment_types where id = ${u.typeId}`;
    if (!type) throw new AdminError("Apartment type not found.", { typeId: "Apartment type not found." });
    const [created] = await tx<Unit[]>`
      insert into units (apartment_type_id, name, sort)
      select ${u.typeId}, ${u.name}, coalesce(${u.sort ?? null}::int, (select coalesce(max(sort), 0) + 1 from units where apartment_type_id = ${u.typeId}))
      returning *`;
    await log(tx, admin, "unit:created", null, { unit_id: created.id, name: created.name, type: type.short_name });
    return created;
  });
}

/** Activates or deactivates a unit. Refused while the unit has active reservations that have not yet ended. */
export async function setUnitActive(id: string, active: boolean, admin: AdminActor): Promise<Unit> {
  const unitId = parse(uuid, id);
  const today = todayInKarachi();
  return sql().begin(async (tx) => {
    const [unit] = await tx<Unit[]>`select * from units where id = ${unitId} for update`;
    if (!unit) throw new AdminError("Unit not found.");
    if (!active) {
      const future = await tx<{ reference: string }[]>`
        select reference from reservations
        where unit_id = ${unitId} and status in ('reserved','payment_submitted','confirmed','checked_in') and check_out > ${today}
        order by check_in limit 3`;
      if (future.length) {
        throw new AdminError(
          `This unit has upcoming reservations (${future.map((f) => f.reference).join(", ")}). Move them to another unit first.`,
        );
      }
    }
    const [row] = await tx<Unit[]>`update units set active = ${Boolean(active)} where id = ${unitId} returning *`;
    await log(tx, admin, active ? "unit:activated" : "unit:deactivated", null, { unit_id: row.id, name: row.name });
    return row;
  });
}

// ---------------------------------------------------------------- settings: apartment types

export const TYPE_FIELDS = [
  "standard_guests",
  "max_guests",
  "min_nights",
  "bathrooms",
  "bed_configuration",
  "size_sqft",
  "description",
  "active",
] as const satisfies readonly (keyof ApartmentType)[];

export const typeInput = z
  .object({
    standard_guests: nullableInt(1, 30, "Enter the standard number of guests, or leave it empty until confirmed."),
    max_guests: nullableInt(1, 30, "Enter the maximum number of guests, or leave it empty until confirmed."),
    min_nights: intIn(1, 30, "Enter a minimum between 1 and 30 nights."),
    bathrooms: z.preprocess(emptyToNull, text(40).nullable()),
    bed_configuration: z.preprocess(emptyToNull, text(200).nullable()),
    size_sqft: nullableInt(100, 50_000, "Enter the size in square feet, or leave it empty."),
    description: text(2000),
    active: boolish,
  })
  .partial();

/**
 * Updates whitelisted fields of an apartment type. Standard and maximum guests are set together; while both are
 * empty the type is not reservable online (isReservable()).
 */
export async function updateType(id: string, fields: Record<string, unknown>, admin: AdminActor): Promise<ApartmentType> {
  const typeId = parse(uuid, id);
  const picked = Object.fromEntries(Object.entries(fields).filter(([k]) => (TYPE_FIELDS as readonly string[]).includes(k)));
  const input = parse(typeInput, picked);
  try {
    return await sql().begin(async (tx) => {
      const [current] = await tx<ApartmentType[]>`select * from apartment_types where id = ${typeId} for update`;
      if (!current) throw new AdminError("Apartment type not found.");
      const merged = { ...current, ...input };
      if ((merged.standard_guests === null) !== (merged.max_guests === null)) {
        const msg = "Set both the standard and the maximum number of guests, or leave both empty.";
        throw new AdminError(msg, { [merged.standard_guests === null ? "standard_guests" : "max_guests"]: msg });
      }
      if (merged.standard_guests !== null && merged.max_guests !== null && merged.max_guests < merged.standard_guests) {
        throw new AdminError("The maximum cannot be lower than the standard number of guests.", {
          max_guests: "The maximum cannot be lower than the standard number of guests.",
        });
      }
      const changes: Record<string, string | number | boolean | null> = {};
      const logged: Record<string, { from: unknown; to: unknown }> = {};
      for (const [k, v] of Object.entries(input)) {
        const before = current[k as keyof ApartmentType];
        if (v === undefined || before === v) continue;
        changes[k] = v as string | number | boolean | null;
        logged[k] = { from: before, to: v };
      }
      if (Object.keys(changes).length === 0) return current;
      const [row] = await tx<ApartmentType[]>`update apartment_types set ${tx(changes)} where id = ${typeId} returning *`;
      await log(tx, admin, "type:updated", null, { type_id: row.id, type: row.short_name, changes: logged });
      return row;
    });
  } catch (e) {
    mapDbError(e);
  }
}
