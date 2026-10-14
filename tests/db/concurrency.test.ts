import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from "vitest";
import { addUnit, reservationPayload, reset, type CreateResult, type Fixture, type Sql, connect } from "./helpers";

// Ten guests press "Reserve" for the same nights at the same moment, each on their own database connection.
// create_reservation() locks the apartment type's row, so exactly as many succeed as there are free units and the
// rest get a clean { ok: false, error: 'not_available' } (never an exception, never a double booking).

const CALLERS = 10;

let admin: Sql;
let clients: Sql[];
let f: Fixture;

beforeAll(async () => {
  admin = connect();
  clients = Array.from({ length: CALLERS }, () =>
    postgres(inject("databaseUrl"), { max: 1, prepare: false, onnotice: () => undefined }),
  );
  // Open every connection first so the ten calls really start together.
  const pids = await Promise.all(clients.map(async (c) => (await c<{ pid: number }[]>`select pg_backend_pid() as pid`)[0].pid));
  expect(new Set(pids).size).toBe(CALLERS);
});
afterAll(async () => {
  await Promise.all(clients.map((c) => c.end()));
  await admin.end();
});
beforeEach(async () => {
  f = await reset(admin);
});

async function race(checkIn: string, checkOut: string): Promise<CreateResult[]> {
  const p = reservationPayload(f.threeId, checkIn, checkOut);
  return Promise.all(
    clients.map(async (c) => (await c<{ r: CreateResult }[]>`select create_reservation(${c.json(p as never)}) as r`)[0].r),
  );
}

describe("simultaneous create_reservation calls", () => {
  it("one free unit: exactly one ok and nine not_available", async () => {
    const results = await race("2027-08-02", "2027-08-05");
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.error === "not_available")).toHaveLength(CALLERS - 1);
    const rows = await admin`select unit_id from reservations where check_in = '2027-08-02'`;
    expect(rows).toHaveLength(1);
    expect(rows[0].unit_id).toBe(f.unitA);
  });

  it("holds up over repeated rounds with overlapping, not identical, nights", async () => {
    for (const [a, b] of [
      ["2027-08-10", "2027-08-12"],
      ["2027-08-11", "2027-08-14"], // overlaps the round before: all ten refused
      ["2027-08-14", "2027-08-15"], // adjacent: one succeeds
    ]) {
      await race(a, b);
    }
    const rows = await admin<{ check_in: string; check_out: string }[]>`
      select check_in::text, check_out::text from reservations order by check_in`;
    expect(rows).toEqual([
      { check_in: "2027-08-10", check_out: "2027-08-12" },
      { check_in: "2027-08-14", check_out: "2027-08-15" },
    ]);
  });

  it("two free units: exactly two ok, on different units, and eight not_available", async () => {
    const unitB = await addUnit(admin, f.threeId, "Test unit B", 2);
    const results = await race("2027-08-20", "2027-08-23");
    const ok = results.filter((r): r is Extract<CreateResult, { ok: true }> => r.ok);
    expect(ok).toHaveLength(2);
    expect(new Set(ok.map((r) => r.unit_id))).toEqual(new Set([f.unitA, unitB]));
    expect(new Set(ok.map((r) => r.reference)).size).toBe(2);
    expect(results.filter((r) => !r.ok && r.error === "not_available")).toHaveLength(CALLERS - 2);
  });

  it("every success takes its own reference number", async () => {
    // Different nights per caller, so all ten succeed; the counter must not hand out a number twice.
    const results = await Promise.all(
      clients.map(async (c, i) => {
        const day = String(i + 1).padStart(2, "0");
        const next = String(i + 2).padStart(2, "0");
        const p = reservationPayload(f.threeId, `2027-09-${day}`, `2027-09-${next}`);
        return (await c<{ r: CreateResult }[]>`select create_reservation(${c.json(p as never)}) as r`)[0].r;
      }),
    );
    const refs = results.map((r) => (r.ok ? r.reference : "failed"));
    expect(refs).not.toContain("failed");
    expect(new Set(refs).size).toBe(CALLERS);
    const numbers = refs.map((r) => Number(r.slice(-4))).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: CALLERS }, (_, i) => i + 1));
  });
});
