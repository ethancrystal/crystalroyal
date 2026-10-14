import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { todayInKarachi } from "@/lib/dates";
import { addUnit, connect, createReservation, insertReservation, reset, type Fixture, type Sql } from "./helpers";

// create_reservation(p jsonb): serialises per type, picks the lowest-sorted free active unit, allocates
// CRA-YYMM-NNNN from reference_counters, inserts the reservation, its amenities and a log line, all in one call.

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

const karachiYymm = () => {
  const t = todayInKarachi();
  return `${t.slice(2, 4)}${t.slice(5, 7)}`;
};

describe("unit assignment", () => {
  it("assigns the lowest-sorted free unit, then the next, then reports not_available", async () => {
    const unitB = await addUnit(sql, f.threeId, "Test unit B", 2);
    const first = await createReservation(sql, f.threeId, "2027-04-02", "2027-04-05");
    const second = await createReservation(sql, f.threeId, "2027-04-03", "2027-04-04");
    const third = await createReservation(sql, f.threeId, "2027-04-03", "2027-04-05");
    expect(first).toMatchObject({ ok: true, unit_id: f.unitA });
    expect(second).toMatchObject({ ok: true, unit_id: unitB });
    expect(third).toEqual({ ok: false, error: "not_available" });
  });

  it("orders by sort before name, whatever the insertion order", async () => {
    const zeta = await addUnit(sql, f.threeId, "Test unit Z", 0);
    await addUnit(sql, f.threeId, "Test unit 0", 5);
    expect(await createReservation(sql, f.threeId, "2027-04-02", "2027-04-05")).toMatchObject({ ok: true, unit_id: zeta });
    // equal sort: by name
    await sql`update units set sort = 0 where apartment_type_id = ${f.threeId}`;
    const [byName] = await sql<{ id: string }[]>`
      select id from units where apartment_type_id = ${f.threeId} and id <> ${zeta} order by name limit 1`;
    expect(await createReservation(sql, f.threeId, "2027-04-02", "2027-04-05")).toMatchObject({ ok: true, unit_id: byName.id });
  });

  it("skips a unit whose nights are blocked and a unit that is inactive", async () => {
    const unitB = await addUnit(sql, f.threeId, "Test unit B", 2);
    const unitC = await addUnit(sql, f.threeId, "Test unit C", 3);
    await sql`insert into unit_blocks (unit_id, starts_on, ends_on, reason) values (${f.unitA}, '2027-04-01', '2027-04-10', 'maintenance')`;
    await sql`update units set active = false where id = ${unitB}`;
    expect(await createReservation(sql, f.threeId, "2027-04-02", "2027-04-05")).toMatchObject({ ok: true, unit_id: unitC });
  });

  it("skips a unit that already holds any of the nights, but not an adjacent stay", async () => {
    const unitB = await addUnit(sql, f.threeId, "Test unit B", 2);
    await insertReservation(sql, { typeId: f.threeId, unitId: f.unitA, checkIn: "2027-04-04", checkOut: "2027-04-06" });
    expect(await createReservation(sql, f.threeId, "2027-04-02", "2027-04-05")).toMatchObject({ ok: true, unit_id: unitB });
    // ends the day the existing stay begins: unit A again
    expect(await createReservation(sql, f.threeId, "2027-04-01", "2027-04-04")).toMatchObject({ ok: true, unit_id: f.unitA });
  });

  it("never assigns a unit of another type", async () => {
    await insertReservation(sql, { typeId: f.threeId, unitId: f.unitA, checkIn: "2027-04-01", checkOut: "2027-04-10" });
    expect(await createReservation(sql, f.threeId, "2027-04-02", "2027-04-03")).toEqual({ ok: false, error: "not_available" });
    expect(await createReservation(sql, f.twoId, "2027-04-02", "2027-04-03")).toMatchObject({ ok: true, unit_id: f.twoUnit });
  });

  it("returns clean errors for bad dates and unknown or inactive types", async () => {
    expect(await createReservation(sql, f.threeId, "2027-04-05", "2027-04-05")).toEqual({ ok: false, error: "bad_dates" });
    expect(await createReservation(sql, "00000000-0000-4000-8000-000000000000", "2027-04-02", "2027-04-03")).toEqual({
      ok: false,
      error: "unknown_type",
    });
    await sql`update apartment_types set active = false where id = ${f.twoId}`;
    try {
      expect(await createReservation(sql, f.twoId, "2027-04-02", "2027-04-03")).toEqual({ ok: false, error: "unknown_type" });
    } finally {
      await sql`update apartment_types set active = true where id = ${f.twoId}`;
    }
  });
});

describe("the reservation row", () => {
  it("stores the breakdown, a hold of hold_hours, the amenities and a 'created' log line", async () => {
    await sql`update settings set hold_hours = 12 where id`;
    const [amenity] = await sql<{ id: string }[]>`select id from amenities where slug = 'airport-transfer'`;
    const r = await createReservation(sql, f.threeId, "2027-04-02", "2027-04-05", {
      adults: 2,
      children: 4,
      amenities: [{ amenity_id: amenity.id, name: "Airport transfer", pricing_type: "per_trip", quantity: 2, unit_price: null, line_total: null }],
    });
    if (!r.ok) throw new Error("expected ok");
    const [row] = await sql<
      { status: string; total: number; amount_due: number; nights: number; children: number; source: string; hold_hours: number; hold_extended: boolean }[]
    >`
      select status, total, amount_due, nights, children, source, hold_extended,
        round(extract(epoch from hold_expires_at - created_at) / 3600)::int as hold_hours
      from reservations where id = ${r.id}`;
    expect(row).toMatchObject({ status: "reserved", total: 75000, amount_due: 75000, nights: 3, children: 4, source: "web", hold_hours: 12, hold_extended: false });
    const lines = await sql`select name_snapshot, quantity, unit_price, line_total from reservation_amenities where reservation_id = ${r.id}`;
    expect(lines).toEqual([{ name_snapshot: "Airport transfer", quantity: 2, unit_price: null, line_total: null }]);
    const log = await sql<{ actor: string; action: string }[]>`select actor, action from activity_log where reservation_id = ${r.id}`;
    expect(log).toEqual([{ actor: "guest", action: "created" }]);
  });

  it("an admin booking created as confirmed has no hold and is logged as the admin's", async () => {
    const r = await createReservation(sql, f.threeId, "2027-04-02", "2027-04-05", { status: "confirmed", source: "admin" });
    if (!r.ok) throw new Error("expected ok");
    const [row] = await sql`select status, source, hold_expires_at, confirmed_at is not null as confirmed from reservations where id = ${r.id}`;
    expect(row).toMatchObject({ status: "confirmed", source: "admin", hold_expires_at: null, confirmed: true });
    const [log] = await sql`select actor from activity_log where reservation_id = ${r.id}`;
    expect(log.actor).toBe("admin");
  });

  it("issues a 32-byte base64url access token, unique per reservation", async () => {
    const a = await createReservation(sql, f.threeId, "2027-04-02", "2027-04-03");
    const b = await createReservation(sql, f.threeId, "2027-04-03", "2027-04-04");
    if (!a.ok || !b.ok) throw new Error("expected ok");
    expect(a.access_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(a.access_token, "base64url")).toHaveLength(32);
    expect(a.access_token).not.toBe(b.access_token);
  });
});

describe("reference CRA-YYMM-NNNN", () => {
  it("uses the Karachi year and month and increments the running number", async () => {
    const refs: string[] = [];
    for (const [a, b] of [
      ["2027-05-01", "2027-05-02"],
      ["2027-05-02", "2027-05-03"],
      ["2027-05-03", "2027-05-04"],
    ]) {
      const r = await createReservation(sql, f.threeId, a, b);
      if (!r.ok) throw new Error("expected ok");
      refs.push(r.reference);
    }
    const yymm = karachiYymm();
    expect(refs).toEqual([`CRA-${yymm}-0001`, `CRA-${yymm}-0002`, `CRA-${yymm}-0003`]);
    for (const ref of refs) expect(ref).toMatch(/^CRA-\d{4}-\d{4}$/);
  });

  it("continues from the month's counter and ignores other months", async () => {
    const yymm = karachiYymm();
    await sql`insert into reference_counters (yymm, last) values (${yymm}, 41), ('0001', 900)`;
    const r = await createReservation(sql, f.threeId, "2027-05-01", "2027-05-02");
    expect(r).toMatchObject({ ok: true, reference: `CRA-${yymm}-0042` });
    const [other] = await sql<{ last: number }[]>`select last from reference_counters where yymm = '0001'`;
    expect(other.last).toBe(900);
  });

  it("does not use up a number when the dates are not available", async () => {
    await insertReservation(sql, { typeId: f.threeId, unitId: f.unitA, checkIn: "2027-05-01", checkOut: "2027-05-10" });
    expect(await createReservation(sql, f.threeId, "2027-05-02", "2027-05-03")).toEqual({ ok: false, error: "not_available" });
    const r = await createReservation(sql, f.threeId, "2027-05-10", "2027-05-11");
    expect(r).toMatchObject({ ok: true, reference: `CRA-${karachiYymm()}-0001` });
  });
});
