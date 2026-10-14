import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { canTransition, RESERVATION_STATUSES, TRANSITIONS, type ReservationStatus } from "@/lib/status";
import { connect, insertReservation, reset, sqlState, statusOf, type Fixture, type Sql } from "./helpers";

// transition_reservation(): the only way status changes. It must agree with src/lib/status.ts TRANSITIONS for every
// pair, set the timestamps, write activity_log, and extend a rejected receipt's hold once.

let sql: Sql;
let f: Fixture;

beforeAll(() => {
  sql = connect();
});
afterAll(async () => {
  await sql.end();
});
beforeEach(async () => {
  f = await reset(sql);
});

const transition = (id: string, to: ReservationStatus, detail: Record<string, unknown> = {}) =>
  sql`select * from transition_reservation(${id}, ${to}::reservation_status, 'admin', 'test-admin', ${sql.json(detail as never)})`;

const PAIRS = RESERVATION_STATUSES.flatMap((from) => RESERVATION_STATUSES.map((to) => [from, to] as const));

describe("the transition table", () => {
  it("transition_allowed() in the database equals TRANSITIONS in status.ts for all 49 pairs", async () => {
    const rows = await sql<{ f: ReservationStatus; t: ReservationStatus; ok: boolean }[]>`
      select f, t, transition_allowed(f, t) as ok
      from unnest(enum_range(null::reservation_status)) f, unnest(enum_range(null::reservation_status)) t`;
    expect(rows).toHaveLength(49);
    for (const r of rows) expect(r.ok, `${r.f} -> ${r.t}`).toBe(canTransition(r.f, r.t));
  });

  it("the enum and status.ts list the same statuses", async () => {
    const [r] = await sql<{ v: string[] }[]>`select enum_range(null::reservation_status)::text[] as v`;
    expect([...r.v].sort()).toEqual([...RESERVATION_STATUSES].sort());
  });

  it.each(PAIRS)("%s -> %s", async (from, to) => {
    const r = await insertReservation(sql, {
      typeId: f.threeId,
      unitId: f.unitA,
      checkIn: "2027-06-02",
      checkOut: "2027-06-05",
      status: from,
      holdExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    const before = await sql<{ n: number }[]>`select count(*)::int as n from activity_log where reservation_id = ${r.id}`;
    if (TRANSITIONS[from].includes(to)) {
      await transition(r.id, to, { reason: "test" });
      expect(await statusOf(sql, r.id)).toBe(to);
      const log = await sql<{ action: string; actor: string; actor_id: string }[]>`
        select action, actor, actor_id from activity_log where reservation_id = ${r.id} order by created_at desc limit 1`;
      expect(log[0]).toEqual({ action: `status:${to}`, actor: "admin", actor_id: "test-admin" });
    } else {
      const state = await sqlState(transition(r.id, to));
      expect(state).toBe("P0001");
      expect(await statusOf(sql, r.id)).toBe(from);
      const after = await sql<{ n: number }[]>`select count(*)::int as n from activity_log where reservation_id = ${r.id}`;
      expect(after[0].n).toBe(before[0].n);
    }
  });

  it("refuses with a readable message", async () => {
    const r = await insertReservation(sql, { typeId: f.threeId, unitId: f.unitA, checkIn: "2027-06-02", checkOut: "2027-06-05", status: "completed" });
    await expect(transition(r.id, "confirmed")).rejects.toThrow("A reservation cannot move from completed to confirmed");
  });

  it("raises for an unknown reservation", async () => {
    await expect(transition("00000000-0000-4000-8000-000000000000", "confirmed")).rejects.toThrow("reservation not found");
  });
});

describe("side effects", () => {
  it("sets confirmed_at, checked_in_at, completed_at along the happy path", async () => {
    const r = await insertReservation(sql, {
      typeId: f.threeId,
      unitId: f.unitA,
      checkIn: "2027-06-02",
      checkOut: "2027-06-05",
      status: "reserved",
      holdExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    for (const to of ["payment_submitted", "confirmed", "checked_in", "completed"] as const) await transition(r.id, to);
    const [row] = await sql`
      select confirmed_at is not null as c, checked_in_at is not null as i, completed_at is not null as d, cancelled_at
      from reservations where id = ${r.id}`;
    expect(row).toEqual({ c: true, i: true, d: true, cancelled_at: null });
    const log = await sql<{ action: string }[]>`select action from activity_log where reservation_id = ${r.id} order by created_at`;
    expect(log.map((l) => l.action)).toEqual(["status:payment_submitted", "status:confirmed", "status:checked_in", "status:completed"]);
  });

  it("cancelling records the time and the reason, and frees the nights", async () => {
    const r = await insertReservation(sql, { typeId: f.threeId, unitId: f.unitA, checkIn: "2027-06-02", checkOut: "2027-06-05" });
    await transition(r.id, "cancelled", { reason: "Guest changed plans" });
    const [row] = await sql`select cancelled_at is not null as at, cancel_reason from reservations where id = ${r.id}`;
    expect(row).toEqual({ at: true, cancel_reason: "Guest changed plans" });
    const again = await insertReservation(sql, { typeId: f.threeId, unitId: f.unitA, checkIn: "2027-06-02", checkOut: "2027-06-05" });
    expect(again.id).toBeTruthy();
  });

  it("a rejected receipt (payment_submitted -> reserved) extends the hold by hold_hours, once", async () => {
    await sql`update settings set hold_hours = 12 where id`;
    const soon = new Date(Date.now() + 10 * 60_000).toISOString();
    const r = await insertReservation(sql, {
      typeId: f.threeId,
      unitId: f.unitA,
      checkIn: "2027-06-02",
      checkOut: "2027-06-05",
      status: "reserved",
      holdExpiresAt: soon,
    });
    const hold = async () => {
      const [x] = await sql<{ minutes: number; extended: boolean; at: Date }[]>`
        select round(extract(epoch from hold_expires_at - now()) / 60)::int as minutes, hold_extended as extended,
               hold_expires_at as at
        from reservations where id = ${r.id}`;
      return x;
    };

    // Uploading a receipt keeps the hold as it is.
    await transition(r.id, "payment_submitted");
    expect((await hold()).minutes).toBeLessThanOrEqual(10);

    // First rejection: a fresh hold of 12 hours from now.
    await transition(r.id, "reserved", { reason: "Amount does not match" });
    const first = await hold();
    expect(first.extended).toBe(true);
    expect(first.minutes).toBeGreaterThanOrEqual(12 * 60 - 1);
    expect(first.minutes).toBeLessThanOrEqual(12 * 60);

    // Time passes; a second receipt is rejected too: no second extension.
    await sql`update reservations set hold_expires_at = now() + interval '30 minutes' where id = ${r.id}`;
    const before = await hold();
    await transition(r.id, "payment_submitted");
    await transition(r.id, "reserved");
    const second = await hold();
    expect(second.extended).toBe(true);
    expect(second.at.getTime()).toBe(before.at.getTime());
  });

  it("other transitions leave the hold alone", async () => {
    const soon = new Date(Date.now() + 10 * 60_000).toISOString();
    const r = await insertReservation(sql, {
      typeId: f.threeId,
      unitId: f.unitA,
      checkIn: "2027-06-02",
      checkOut: "2027-06-05",
      status: "reserved",
      holdExpiresAt: soon,
    });
    await transition(r.id, "confirmed");
    const [row] = await sql<{ at: Date; extended: boolean }[]>`select hold_expires_at as at, hold_extended as extended from reservations where id = ${r.id}`;
    expect(row.at.toISOString()).toBe(soon);
    expect(row.extended).toBe(false);
  });
});
