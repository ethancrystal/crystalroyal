import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addUnit, connect, createReservation, insertReservation, reset, sqlState, type Fixture, type Sql } from "./helpers";

// Double-booking is impossible at the database level: the exclusion constraint on reservations (active statuses only,
// half-open [check_in, check_out)) and on unit_blocks, and unit_is_free() / type_night_availability() that read both.

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

describe("reservations_no_overlap exclusion constraint", () => {
  it("rejects a second active reservation on overlapping nights of the same unit", async () => {
    await insertReservation(sql, { typeId: f.threeId, unitId: f.unitA, checkIn: "2027-03-02", checkOut: "2027-03-05" });
    const state = await sqlState(
      insertReservation(sql, { typeId: f.threeId, unitId: f.unitA, checkIn: "2027-03-04", checkOut: "2027-03-06" }),
    );
    expect(state).toBe("23P01");
  });

  it("rejects a stay inside another and a stay surrounding another", async () => {
    await insertReservation(sql, { typeId: f.threeId, unitId: f.unitA, checkIn: "2027-03-02", checkOut: "2027-03-08" });
    expect(
      await sqlState(insertReservation(sql, { typeId: f.threeId, unitId: f.unitA, checkIn: "2027-03-03", checkOut: "2027-03-04" })),
    ).toBe("23P01");
    expect(
      await sqlState(insertReservation(sql, { typeId: f.threeId, unitId: f.unitA, checkIn: "2027-03-01", checkOut: "2027-03-09" })),
    ).toBe("23P01");
  });

  it("allows adjacent stays: the check-out day is the next check-in day", async () => {
    await insertReservation(sql, { typeId: f.threeId, unitId: f.unitA, checkIn: "2027-03-02", checkOut: "2027-03-05" });
    expect(
      await sqlState(insertReservation(sql, { typeId: f.threeId, unitId: f.unitA, checkIn: "2027-03-05", checkOut: "2027-03-07" })),
    ).toBe("ok");
    expect(
      await sqlState(insertReservation(sql, { typeId: f.threeId, unitId: f.unitA, checkIn: "2027-02-28", checkOut: "2027-03-02" })),
    ).toBe("ok");
  });

  it("applies to every active status and none of the ended ones", async () => {
    for (const status of ["reserved", "payment_submitted", "confirmed", "checked_in"] as const) {
      await reset(sql);
      await insertReservation(sql, { typeId: f.threeId, unitId: f.unitA, checkIn: "2027-03-02", checkOut: "2027-03-05", status });
      expect(
        await sqlState(insertReservation(sql, { typeId: f.threeId, unitId: f.unitA, checkIn: "2027-03-03", checkOut: "2027-03-04" })),
        status,
      ).toBe("23P01");
    }
    for (const status of ["completed", "cancelled", "expired"] as const) {
      await reset(sql);
      await insertReservation(sql, { typeId: f.threeId, unitId: f.unitA, checkIn: "2027-03-02", checkOut: "2027-03-05", status });
      expect(
        await sqlState(insertReservation(sql, { typeId: f.threeId, unitId: f.unitA, checkIn: "2027-03-03", checkOut: "2027-03-04" })),
        status,
      ).toBe("ok");
    }
  });

  it("allows the same nights on a different unit", async () => {
    const unitB = await addUnit(sql, f.threeId, "Test unit B", 2);
    await insertReservation(sql, { typeId: f.threeId, unitId: f.unitA, checkIn: "2027-03-02", checkOut: "2027-03-05" });
    expect(
      await sqlState(insertReservation(sql, { typeId: f.threeId, unitId: unitB, checkIn: "2027-03-02", checkOut: "2027-03-05" })),
    ).toBe("ok");
  });

  it("refuses a departure on or before the arrival", async () => {
    expect(
      await sqlState(insertReservation(sql, { typeId: f.threeId, unitId: f.unitA, checkIn: "2027-03-05", checkOut: "2027-03-05" })),
    ).toBe("23514");
  });

  it("refuses to reactivate a cancelled reservation onto nights that are now taken", async () => {
    const old = await insertReservation(sql, {
      typeId: f.threeId,
      unitId: f.unitA,
      checkIn: "2027-03-02",
      checkOut: "2027-03-05",
      status: "cancelled",
    });
    await insertReservation(sql, { typeId: f.threeId, unitId: f.unitA, checkIn: "2027-03-03", checkOut: "2027-03-06" });
    expect(await sqlState(sql`update reservations set status = 'confirmed' where id = ${old.id}`)).toBe("23P01");
  });
});

describe("unit_blocks", () => {
  it("rejects overlapping blocks on one unit and allows adjacent ones", async () => {
    await sql`insert into unit_blocks (unit_id, starts_on, ends_on, reason) values (${f.unitA}, '2027-03-02', '2027-03-05', 'maintenance')`;
    expect(
      await sqlState(sql`insert into unit_blocks (unit_id, starts_on, ends_on) values (${f.unitA}, '2027-03-04', '2027-03-06')`),
    ).toBe("23P01");
    expect(
      await sqlState(sql`insert into unit_blocks (unit_id, starts_on, ends_on) values (${f.unitA}, '2027-03-05', '2027-03-06')`),
    ).toBe("ok");
  });

  it("a block makes that unit unavailable for the nights it covers, and only those", async () => {
    await sql`insert into unit_blocks (unit_id, starts_on, ends_on, reason) values (${f.unitA}, '2027-03-02', '2027-03-05', 'owner_use')`;
    const free = async (a: string, b: string) => {
      const [r] = await sql<{ free: boolean }[]>`select unit_is_free(${f.unitA}, ${a}::date, ${b}::date) as free`;
      return r.free;
    };
    expect(await free("2027-03-02", "2027-03-05")).toBe(false);
    expect(await free("2027-03-04", "2027-03-07")).toBe(false);
    expect(await free("2027-02-27", "2027-03-03")).toBe(false);
    expect(await free("2027-03-05", "2027-03-07")).toBe(true);
    expect(await free("2027-02-27", "2027-03-02")).toBe(true);
  });

  it("create_reservation refuses blocked nights cleanly when the type's only unit is blocked", async () => {
    await sql`insert into unit_blocks (unit_id, starts_on, ends_on) values (${f.unitA}, '2027-03-02', '2027-03-05')`;
    expect(await createReservation(sql, f.threeId, "2027-03-03", "2027-03-04")).toEqual({ ok: false, error: "not_available" });
    const r = await createReservation(sql, f.threeId, "2027-03-05", "2027-03-07");
    expect(r.ok).toBe(true);
  });

  it("type_night_availability: a night is available while any active unit is free", async () => {
    const unitB = await addUnit(sql, f.threeId, "Test unit B", 2);
    await sql`insert into unit_blocks (unit_id, starts_on, ends_on) values (${f.unitA}, '2027-03-02', '2027-03-04')`;
    await insertReservation(sql, { typeId: f.threeId, unitId: unitB, checkIn: "2027-03-03", checkOut: "2027-03-05" });
    const rows = await sql<{ night: string; available: boolean }[]>`
      select night, available from type_night_availability(${f.threeId}, '2027-03-01'::date, '2027-03-06'::date)`;
    expect(rows.map((r) => [r.night, r.available])).toEqual([
      ["2027-03-01", true],
      ["2027-03-02", true], // A blocked, B free
      ["2027-03-03", false], // A blocked, B reserved
      ["2027-03-04", true], // A free again, B reserved
      ["2027-03-05", true],
    ]);
    // An inactive unit offers nothing.
    await sql`update units set active = false where id = ${unitB}`;
    const [n] = await sql<{ available: boolean }[]>`
      select available from type_night_availability(${f.threeId}, '2027-03-02'::date, '2027-03-03'::date)`;
    expect(n.available).toBe(false);
  });
});
