import "server-only";
import { z } from "zod";
import { db } from "@/lib/db/sql";
import { todayInKarachi } from "@/lib/dates";
import { OCCUPYING } from "@/lib/status";
import type { Rate, Reservation, Unit } from "@/lib/types";
import type { AdminActor } from "@/lib/db/admin-queries";

// Small server-only reads (and one attribution write) for the reservations console that admin-queries.ts does not
// cover. Parameterised SQL only; nothing here changes a reservation's status.

const uuid = z.string().uuid();

/** Units of the same type, other than the current one, that are active and free for every night of the stay. */
export async function freeUnitsForMove(r: Pick<Reservation, "id" | "apartment_type_id" | "unit_id" | "check_in" | "check_out" | "status">): Promise<Unit[]> {
  if (!OCCUPYING.includes(r.status)) return [];
  return db()<Unit[]>`
    select u.* from units u
    where u.apartment_type_id = ${r.apartment_type_id} and u.active and u.id <> ${r.unit_id}
      and unit_is_free(u.id, ${r.check_in}, ${r.check_out}, ${r.id})
    order by u.sort, u.name`;
}

export interface ReceiptRow {
  id: string;
  reservation_id: string;
  receipt_path: string | null;
  reference: string;
}

/** The payment row behind a receipt link (with its reservation's reference for the download name), or null. */
export async function getReceiptRow(paymentId: string): Promise<ReceiptRow | null> {
  if (!uuid.safeParse(paymentId).success) return null;
  const [row] = await db()<ReceiptRow[]>`
    select p.id, p.reservation_id, p.receipt_path, r.reference
    from payments p join reservations r on r.id = p.reservation_id
    where p.id = ${paymentId}`;
  return row ?? null;
}

/** Which reservation a payment belongs to (to refuse a form that pairs a payment with another reservation). */
export async function paymentReservationId(paymentId: string): Promise<string | null> {
  if (!uuid.safeParse(paymentId).success) return null;
  const [row] = await db()<{ reservation_id: string }[]>`select reservation_id from payments where id = ${paymentId}`;
  return row?.reservation_id ?? null;
}

export type PreviewRate = Pick<Rate, "apartment_type_id" | "nightly_rate" | "extra_adult_per_night" | "effective_from">;

/**
 * Rates for the phone-booking price preview: per type, the rate in force today and every later one (a stay is
 * priced at the latest rate effective on its arrival). The server prices again from the database on submit.
 */
export async function previewRates(): Promise<PreviewRate[]> {
  const today = todayInKarachi();
  return db()<PreviewRate[]>`
    select r.apartment_type_id, r.nightly_rate, r.extra_adult_per_night, r.effective_from
    from rates r
    where r.effective_from >= coalesce(
      (select max(x.effective_from) from rates x where x.apartment_type_id = r.apartment_type_id and x.effective_from <= ${today}),
      ${today}::date)
    order by r.apartment_type_id, r.effective_from, r.created_at`;
}

/**
 * create_reservation() writes the "created" activity entry with actor 'admin' but no actor id. Attribute it to the
 * admin who added the phone booking, so every admin action carries the admin's user id.
 */
export async function attributeCreation(reservationId: string, admin: AdminActor): Promise<void> {
  await db()`
    update activity_log
    set actor_id = ${admin.userId}, detail = detail || ${db().json({ by: admin.email, channel: "manual" } as never)}
    where reservation_id = ${reservationId} and action = 'created' and actor = 'admin' and actor_id is null`;
}
