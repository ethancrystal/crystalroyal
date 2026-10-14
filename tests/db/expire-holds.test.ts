import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, createReservation, insertReservation, reset, statusOf, type Fixture, type Sql } from "./helpers";

// expire_holds(): the cron's database half. Only `reserved` rows whose hold has passed move to `expired`, through
// transition_reservation (so it is logged), and the nights become free again. Running it twice changes nothing more.

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

const minutesFromNow = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

describe("expire_holds()", () => {
  it("expires only reserved rows whose hold has passed", async () => {
    const unitB = await (async () => {
      const [u] = await sql<{ id: string }[]>`
        insert into units (apartment_type_id, name, sort) values (${f.threeId}, 'Test unit B', 2) returning id`;
      return u.id;
    })();
    const pastDue = await insertReservation(sql, {
      typeId: f.threeId, unitId: f.unitA, checkIn: "2027-07-01", checkOut: "2027-07-03", status: "reserved", holdExpiresAt: minutesFromNow(-1),
    });
    const stillHeld = await insertReservation(sql, {
      typeId: f.threeId, unitId: f.unitA, checkIn: "2027-07-03", checkOut: "2027-07-05", status: "reserved", holdExpiresAt: minutesFromNow(30),
    });
    const noHold = await insertReservation(sql, {
      typeId: f.threeId, unitId: f.unitA, checkIn: "2027-07-05", checkOut: "2027-07-07", status: "reserved", holdExpiresAt: null,
    });
    const receiptIn = await insertReservation(sql, {
      typeId: f.threeId, unitId: unitB, checkIn: "2027-07-01", checkOut: "2027-07-03", status: "payment_submitted", holdExpiresAt: minutesFromNow(-60),
    });
    const confirmed = await insertReservation(sql, {
      typeId: f.threeId, unitId: unitB, checkIn: "2027-07-03", checkOut: "2027-07-05", status: "confirmed", holdExpiresAt: minutesFromNow(-60),
    });
    const cancelled = await insertReservation(sql, {
      typeId: f.threeId, unitId: unitB, checkIn: "2027-07-05", checkOut: "2027-07-07", status: "cancelled", holdExpiresAt: minutesFromNow(-60),
    });

    const expired = await sql<{ id: string; status: string }[]>`select id, status from expire_holds()`;
    expect(expired).toEqual([{ id: pastDue.id, status: "expired" }]);

    expect(await statusOf(sql, pastDue.id)).toBe("expired");
    expect(await statusOf(sql, stillHeld.id)).toBe("reserved");
    expect(await statusOf(sql, noHold.id)).toBe("reserved");
    expect(await statusOf(sql, receiptIn.id)).toBe("payment_submitted");
    expect(await statusOf(sql, confirmed.id)).toBe("confirmed");
    expect(await statusOf(sql, cancelled.id)).toBe("cancelled");

    const log = await sql`select actor, actor_id, action from activity_log where reservation_id = ${pastDue.id}`;
    expect(log).toEqual([{ actor: "system", actor_id: null, action: "status:expired" }]);
  });

  it("is idempotent", async () => {
    await insertReservation(sql, {
      typeId: f.threeId, unitId: f.unitA, checkIn: "2027-07-01", checkOut: "2027-07-03", status: "reserved", holdExpiresAt: minutesFromNow(-5),
    });
    expect(await sql`select id from expire_holds()`).toHaveLength(1);
    expect(await sql`select id from expire_holds()`).toHaveLength(0);
    const [n] = await sql<{ n: number }[]>`select count(*)::int as n from activity_log where action = 'status:expired'`;
    expect(n.n).toBe(1);
  });

  it("frees the nights for the next guest", async () => {
    const first = await createReservation(sql, f.threeId, "2027-07-10", "2027-07-13");
    if (!first.ok) throw new Error("expected ok");
    expect(await createReservation(sql, f.threeId, "2027-07-11", "2027-07-12")).toEqual({ ok: false, error: "not_available" });
    await sql`update reservations set hold_expires_at = now() - interval '1 minute' where id = ${first.id}`;
    await sql`select expire_holds()`;
    expect(await createReservation(sql, f.threeId, "2027-07-11", "2027-07-12")).toMatchObject({ ok: true, unit_id: f.unitA });
  });

  it("a hold ending a minute from now is honoured", async () => {
    const r = await insertReservation(sql, {
      typeId: f.threeId, unitId: f.unitA, checkIn: "2027-07-01", checkOut: "2027-07-03", status: "reserved", holdExpiresAt: minutesFromNow(1),
    });
    await sql`select expire_holds()`;
    expect(await statusOf(sql, r.id)).toBe("reserved");
  });
});
