import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { inject } from "vitest";
import { addDays, nightsBetween } from "@/lib/dates";
import type { ReservationStatus } from "@/lib/status";

// Shared helpers for the database tests. Each test file opens its own pool on the tests' cluster
// (tests/db/global-setup.ts) and calls reset() before each test.

export type Sql = postgres.Sql;

export function connect(max = 4): Sql {
  return postgres(inject("databaseUrl"), {
    max,
    prepare: false,
    onnotice: () => undefined,
    types: {
      // Dates as "YYYY-MM-DD", like src/lib/db/sql.ts.
      date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
    },
  });
}

export interface Fixture {
  threeId: string;
  twoId: string;
  /** the seeded three-bedroom unit (sort 1) */
  unitA: string;
  twoUnit: string;
}

/** Removes everything the tests create and restores the seed's catalogue and settings. */
export async function reset(sql: Sql): Promise<Fixture> {
  await sql`delete from activity_log`;
  await sql`delete from payments`;
  await sql`delete from reservation_amenities`;
  await sql`delete from reservations`;
  await sql`delete from unit_blocks`;
  await sql`delete from reference_counters`;
  await sql`delete from units where name like 'Test %'`;
  await sql`update units set active = true, sort = 1`;
  await sql`update settings set hold_hours = 12, receipt_retention_months = 12 where id`;
  const types = await sql<{ id: string; slug: string }[]>`select id, slug from apartment_types`;
  const threeId = types.find((t) => t.slug === "three-bedroom")!.id;
  const twoId = types.find((t) => t.slug === "two-bedroom")!.id;
  const [a] = await sql<{ id: string }[]>`select id from units where apartment_type_id = ${threeId}`;
  const [b] = await sql<{ id: string }[]>`select id from units where apartment_type_id = ${twoId}`;
  return { threeId, twoId, unitA: a.id, twoUnit: b.id };
}

export async function addUnit(sql: Sql, typeId: string, name: string, sort: number): Promise<string> {
  const [u] = await sql<{ id: string }[]>`
    insert into units (apartment_type_id, name, sort) values (${typeId}, ${name}, ${sort}) returning id`;
  return u.id;
}

/** The jsonb create_reservation() takes, priced like the server would for a party within standard occupancy. */
export function reservationPayload(typeId: string, checkIn: string, checkOut: string, over: Record<string, unknown> = {}) {
  const nights = nightsBetween(checkIn, checkOut);
  const total = 25000 * nights;
  return {
    apartment_type_id: typeId,
    check_in: checkIn,
    check_out: checkOut,
    adults: 2,
    children: 0,
    guest_name: "Test Guest",
    guest_phone: "+923001234567",
    guest_email: "guest@example.com",
    arrival_time: "",
    requests: "",
    nightly_rate: 25000,
    nights,
    subtotal_nights: total,
    extra_adults: 0,
    extra_adults_amount: 0,
    amenities_amount: 0,
    tax_rate_percent: null,
    tax_label: "",
    tax_amount: 0,
    total,
    amount_due: total,
    amenities: [],
    ...over,
  };
}

export type CreateResult =
  | { ok: true; id: string; reference: string; access_token: string; unit_id: string }
  | { ok: false; error: string };

export async function createReservation(
  sql: Sql,
  typeId: string,
  checkIn: string,
  checkOut: string,
  over: Record<string, unknown> = {},
): Promise<CreateResult> {
  const p = reservationPayload(typeId, checkIn, checkOut, over);
  const [row] = await sql<{ r: CreateResult }[]>`select create_reservation(${sql.json(p as never)}) as r`;
  return row.r;
}

let seq = 0;

/** Inserts a reservation row directly (bypassing create_reservation), for constraint and transition tests. */
export async function insertReservation(
  sql: Sql,
  r: {
    typeId: string;
    unitId: string;
    checkIn: string;
    checkOut: string;
    status?: ReservationStatus;
    holdExpiresAt?: string | null;
    holdExtended?: boolean;
  },
): Promise<{ id: string; reference: string; access_token: string }> {
  seq++;
  const nights = nightsBetween(r.checkIn, r.checkOut);
  const [row] = await sql<{ id: string; reference: string; access_token: string }[]>`
    insert into reservations (reference, access_token, apartment_type_id, unit_id, check_in, check_out, adults, children,
      guest_name, guest_phone, guest_email, status, nightly_rate, nights, subtotal_nights, total, amount_due,
      hold_expires_at, hold_extended)
    values (${`CRA-9999-${String(seq).padStart(4, "0")}`}, ${randomBytes(32).toString("base64url")}, ${r.typeId}, ${r.unitId},
      ${r.checkIn}, ${r.checkOut}, 2, 0, 'Test Guest', '+923001234567', 'guest@example.com', ${r.status ?? "confirmed"},
      25000, ${nights}, ${25000 * nights}, ${25000 * nights}, ${25000 * nights},
      ${r.holdExpiresAt ?? null}, ${r.holdExtended ?? false})
    returning id, reference, access_token`;
  return row;
}

export async function statusOf(sql: Sql, id: string): Promise<ReservationStatus> {
  const [r] = await sql<{ status: ReservationStatus }[]>`select status from reservations where id = ${id}`;
  return r.status;
}

/** Postgres SQLSTATE of a rejected promise (e.g. 23P01 exclusion_violation), or the message. */
export async function sqlState(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return err.code ?? err.message ?? "error";
  }
  return "ok";
}

export { addDays };
