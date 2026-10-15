import "server-only";
import { db } from "./sql";
import { todayInKarachi, addDays, nightsBetween } from "../dates";
import { safeEqual } from "../security";
import { TransitionError, type ReservationStatus } from "../status";
import type {
  ActivityEntry,
  Amenity,
  ApartmentType,
  Payment,
  PaymentMethod,
  Rate,
  Reservation,
  ReservationAmenity,
  Settings,
  Unit,
} from "../types";

// Server-only data access shared by the guest site, the reserve flow, payment pages and cron.
// Admin-only queries live in admin-queries.ts. Public reads never return guest data.

const sql = () => db();

// ---------- Catalogue ----------

export async function getSettings(): Promise<Settings> {
  const [s] = await sql()<Settings[]>`select * from settings where id`;
  if (!s) throw new Error("settings row missing; run supabase/seed.sql");
  return s;
}

export type TypeWithRate = ApartmentType & { rate: Rate | null };

/** Active apartment types in display order, each with the rate in force today (Karachi). */
export async function listApartmentTypes(): Promise<TypeWithRate[]> {
  const today = todayInKarachi();
  const types = await sql()<ApartmentType[]>`select * from apartment_types where active order by sort, name`;
  const rates = await sql()<Rate[]>`
    select distinct on (apartment_type_id) * from rates
    where effective_from <= ${today}
    order by apartment_type_id, effective_from desc`;
  return types.map((t) => ({ ...t, rate: rates.find((r) => r.apartment_type_id === t.id) ?? null }));
}

export async function getApartmentTypeBySlug(slug: string): Promise<TypeWithRate | null> {
  const all = await listApartmentTypes();
  return all.find((t) => t.slug === slug) ?? null;
}

/** The rate for a stay: the latest row with effective_from <= check_in. The whole stay is priced at it. */
export async function rateFor(typeId: string, checkIn: string): Promise<Rate | null> {
  const [r] = await sql()<Rate[]>`
    select * from rates where apartment_type_id = ${typeId} and effective_from <= ${checkIn}
    order by effective_from desc limit 1`;
  return r ?? null;
}

export async function listAmenities(activeOnly = true): Promise<Amenity[]> {
  return activeOnly
    ? sql()<Amenity[]>`select * from amenities where active order by sort, name`
    : sql()<Amenity[]>`select * from amenities order by sort, name`;
}

export async function listUnits(typeId?: string): Promise<Unit[]> {
  return typeId
    ? sql()<Unit[]>`select * from units where apartment_type_id = ${typeId} order by sort, name`
    : sql()<Unit[]>`select * from units order by apartment_type_id, sort, name`;
}

// ---------- Availability (no guest data) ----------

/**
 * Releases holds past their deadline. The scheduled job only runs once a day on Vercel's free plan, so availability
 * checks and new reservations call this first; an unpaid hold never blocks dates past its deadline. Throttled
 * per server instance; the database function is idempotent. The "hold ended" email is sent by the daily job.
 */
let lastSweep = 0;
export async function sweepExpiredHolds(): Promise<void> {
  const now = Date.now();
  if (now - lastSweep < 15_000) return;
  lastSweep = now;
  try {
    await sql()`select count(*) from expire_holds()`;
  } catch (e) {
    console.error("sweepExpiredHolds failed", e);
  }
}


export async function nightAvailability(
  typeId: string,
  from: string,
  to: string,
): Promise<{ night: string; available: boolean }[]> {
  if (to <= from) return [];
  await sweepExpiredHolds();
  return sql()<{ night: string; available: boolean }[]>`select night, available from type_night_availability(${typeId}, ${from}, ${to})`;
}

/** True when at least one active unit of the type is free for every night of [checkIn, checkOut). */
export async function isTypeAvailable(typeId: string, checkIn: string, checkOut: string): Promise<boolean> {
  await sweepExpiredHolds();
  const [r] = await sql()<{ ok: boolean }[]>`
    select exists (select 1 from units u where u.apartment_type_id = ${typeId} and u.active
                   and unit_is_free(u.id, ${checkIn}, ${checkOut})) as ok`;
  return Boolean(r?.ok);
}

/** Nearest free stay of the same length, searching forward up to `searchDays` from the requested arrival. */
export async function nearestFreeRange(
  typeId: string,
  checkIn: string,
  checkOut: string,
  searchDays = 60,
): Promise<{ checkIn: string; checkOut: string } | null> {
  const nights = nightsBetween(checkIn, checkOut);
  const today = todayInKarachi();
  for (let i = 1; i <= searchDays; i++) {
    const start = addDays(checkIn, i);
    if (start < today) continue;
    const end = addDays(start, nights);
    if (await isTypeAvailable(typeId, start, end)) return { checkIn: start, checkOut: end };
  }
  return null;
}

// ---------- Reservations ----------

export interface CreateReservationInput {
  apartment_type_id: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  guest_name: string;
  guest_phone: string;
  guest_email: string;
  arrival_time: string;
  requests: string;
  nightly_rate: number;
  nights: number;
  subtotal_nights: number;
  extra_adults: number;
  extra_adults_amount: number;
  amenities_amount: number;
  tax_rate_percent: number | null;
  tax_label: string;
  tax_amount: number;
  total: number;
  amount_due: number;
  status?: "reserved" | "confirmed";
  source?: "web" | "admin";
  amenities: {
    amenity_id: string;
    name: string;
    pricing_type: string;
    quantity: number;
    unit_price: number | null;
    line_total: number | null;
  }[];
}

export type CreateReservationResult =
  | { ok: true; id: string; reference: string; access_token: string; unit_id: string }
  | { ok: false; error: "not_available" | "unknown_type" | "bad_dates" };

/**
 * Calls create_reservation() in one transaction: serialises per type, assigns the lowest-sorted free unit,
 * allocates CRA-YYMM-NNNN and inserts. Callers must pass totals computed by quoteStay() from database rows.
 */
export async function createReservation(input: CreateReservationInput): Promise<CreateReservationResult> {
  await sweepExpiredHolds();
  const [row] = await sql()<{ r: CreateReservationResult }[]>`select create_reservation(${sql().json(input as never)}) as r`;
  return row.r;
}

export async function getReservationByReference(reference: string): Promise<Reservation | null> {
  const [r] = await sql()<Reservation[]>`select * from reservations where reference = ${reference}`;
  return r ?? null;
}

export async function getReservationById(id: string): Promise<Reservation | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await sql()<Reservation[]>`select * from reservations where id = ${id}`;
  return r ?? null;
}

/** Guest access: the reference plus the 32-byte access token, compared in constant time. */
export async function getReservationForGuest(reference: string, token: string | undefined | null): Promise<Reservation | null> {
  if (!token || !/^CRA-\d{4}-\d{4}$/.test(reference)) return null;
  const r = await getReservationByReference(reference);
  if (!r) return null;
  return safeEqual(r.access_token, token) ? r : null;
}

export async function listReservationAmenities(reservationId: string): Promise<ReservationAmenity[]> {
  return sql()<ReservationAmenity[]>`select * from reservation_amenities where reservation_id = ${reservationId} order by name_snapshot`;
}

export async function listPayments(reservationId: string): Promise<Payment[]> {
  return sql()<Payment[]>`select * from payments where reservation_id = ${reservationId} order by created_at`;
}

export async function amountPaid(reservationId: string): Promise<number> {
  const [r] = await sql()<{ paid: number }[]>`
    select coalesce(sum(amount), 0)::int as paid from payments where reservation_id = ${reservationId} and receipt_status = 'verified'`;
  return r?.paid ?? 0;
}

export async function addPayment(p: {
  reservation_id: string;
  method: PaymentMethod;
  amount: number | null;
  receipt_path: string | null;
  receipt_status: Payment["receipt_status"];
  bank_reference?: string | null;
  recorded_by?: string | null;
  verified_by?: string | null;
  note?: string;
}): Promise<Payment> {
  const [row] = await sql()<Payment[]>`
    insert into payments (reservation_id, method, amount, receipt_path, receipt_status, bank_reference, recorded_by, verified_by, verified_at, note)
    values (${p.reservation_id}, ${p.method}, ${p.amount}, ${p.receipt_path}, ${p.receipt_status}, ${p.bank_reference ?? null},
            ${p.recorded_by ?? null}, ${p.verified_by ?? null}, ${p.receipt_status === "verified" ? new Date().toISOString() : null}, ${p.note ?? ""})
    returning *`;
  return row;
}

export async function countReceipts(reservationId: string): Promise<number> {
  const [r] = await sql()<{ n: number }[]>`
    select count(*)::int as n from payments where reservation_id = ${reservationId} and receipt_path is not null`;
  return r?.n ?? 0;
}

/**
 * The only way status changes: transition_reservation() validates against the transition table,
 * sets the timestamps, extends a rejected hold once and writes activity_log, under a row lock.
 */
export async function transition(
  id: string,
  to: ReservationStatus,
  actor: ActivityEntry["actor"],
  actorId: string | null,
  detail: Record<string, unknown> = {},
): Promise<Reservation> {
  try {
    const [r] = await sql()<Reservation[]>`
      select * from transition_reservation(${id}, ${to}::reservation_status, ${actor}, ${actorId}, ${sql().json(detail as never)})`;
    return r;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("cannot move from")) throw new TransitionError(msg);
    throw e;
  }
}

export async function requestCancellation(id: string, reason?: string): Promise<void> {
  await sql()`update reservations set cancellation_requested_at = now() where id = ${id} and cancellation_requested_at is null`;
  await logActivity({ reservation_id: id, actor: "guest", actor_id: null, action: "cancellation_requested", detail: reason ? { reason } : {} });
}

export async function logActivity(e: Omit<ActivityEntry, "id" | "created_at">): Promise<void> {
  await sql()`
    insert into activity_log (reservation_id, actor, actor_id, action, detail)
    values (${e.reservation_id}, ${e.actor}, ${e.actor_id}, ${e.action}, ${sql().json(e.detail as never)})`;
}

export async function listActivity(reservationId: string): Promise<ActivityEntry[]> {
  return sql()<ActivityEntry[]>`select * from activity_log where reservation_id = ${reservationId} order by created_at`;
}

// ---------- Cron ----------

/** Expires reserved holds past their deadline. Idempotent. */
export async function expireHolds(): Promise<Reservation[]> {
  return sql()<Reservation[]>`select * from expire_holds()`;
}

/** Holds that expired (by the cron or by a lazy sweep) in the last 3 days and have not had the "hold ended" email. */
export async function expiredNeedingEmail(): Promise<Reservation[]> {
  return sql()<Reservation[]>`
    select r.* from reservations r
    where r.status = 'expired' and r.updated_at > now() - interval '3 days'
      and not exists (select 1 from activity_log a where a.reservation_id = r.id and a.action like 'email:hold_ended%')`;
}

/** Reserved holds ending within the next `withinMinutes` that have not had a reminder logged. */
export async function holdsNeedingReminder(withinMinutes = 120): Promise<Reservation[]> {
  return sql()<Reservation[]>`
    select r.* from reservations r
    where r.status = 'reserved' and r.hold_expires_at > now()
      and r.hold_expires_at <= now() + make_interval(mins => ${withinMinutes})
      and not exists (select 1 from activity_log a where a.reservation_id = r.id and a.action = 'email:hold_reminder')`;
}

/** Checked-in stays whose check-out day has passed in Karachi: mark completed. */
export async function completeFinishedStays(): Promise<Reservation[]> {
  const today = todayInKarachi();
  const due = await sql()<{ id: string }[]>`
    select id from reservations where status = 'checked_in' and check_out < ${today}`;
  const done: Reservation[] = [];
  for (const d of due) {
    try {
      done.push(await transition(d.id, "completed", "system", null));
    } catch (e) {
      if (!(e instanceof TransitionError)) throw e;
    }
  }
  return done;
}
