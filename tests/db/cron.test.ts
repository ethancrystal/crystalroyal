import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from "vitest";
import { addDays, todayInKarachi } from "@/lib/dates";
import { connect, createReservation, insertReservation, reset, statusOf, type Fixture, type Sql } from "./helpers";

// The two cron route handlers, called the way Vercel Cron calls them, against the tests' database.
// notify() is replaced by a stand-in that records the call and logs `email:{kind}` like the real one does.

const SECRET = "test-cron-secret";
process.env.DATABASE_URL = inject("databaseUrl");
process.env.CRON_SECRET = SECRET;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const mocked = vi.hoisted(() => ({
  sent: [] as { kind: string; id: string; extra?: Record<string, string> }[],
  log: null as null | ((kind: string, id: string) => Promise<unknown>),
}));
const sent = mocked.sent;

vi.mock("@/lib/notify", () => ({
  notify: async (kind: string, id: string, extra?: Record<string, string>) => {
    mocked.sent.push({ kind, id, extra });
    await mocked.log?.(kind, id);
  },
}));

type Handler = (req: Request) => Promise<Response>;
let sql: Sql;
let expireHolds: Handler;
let receiptRetention: Handler;
let f: Fixture;

beforeAll(async () => {
  sql = connect();
  mocked.log = (kind, id) =>
    sql`insert into activity_log (reservation_id, actor, action, detail) values (${id}, 'system', ${`email:${kind}`}, '{}')`;
  expireHolds = (await import("@/app/api/cron/expire-holds/route")).GET;
  receiptRetention = (await import("@/app/api/cron/receipt-retention/route")).GET;
});
afterAll(async () => {
  await sql.end();
  await (globalThis as { __crSql?: { end: () => Promise<void> } }).__crSql?.end();
});
beforeEach(async () => {
  f = await reset(sql);
  sent.length = 0;
});

const call = (h: Handler, auth: string | null = `Bearer ${SECRET}`) =>
  h(new Request("http://localhost/api/cron", { headers: auth ? { authorization: auth } : {} }));

describe("cron authorisation", () => {
  it.each([
    ["no header", null],
    ["wrong secret", "Bearer not-the-secret"],
    ["secret without the Bearer scheme", SECRET],
    ["a longer string starting with the secret", `Bearer ${SECRET}x`],
  ])("refuses %s with 401", async (_label, auth) => {
    for (const h of [expireHolds, receiptRetention]) {
      const res = await call(h, auth);
      expect(res.status).toBe(401);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("does nothing when refused", async () => {
    const r = await insertReservation(sql, {
      typeId: f.threeId, unitId: f.unitA, checkIn: "2027-10-01", checkOut: "2027-10-03", status: "reserved",
      holdExpiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    await call(expireHolds, "Bearer nope");
    expect(await statusOf(sql, r.id)).toBe("reserved");
  });
});

describe("GET /api/cron/expire-holds", () => {
  it("expires past-due holds, reminds holds ending within two hours, completes finished stays; then has nothing to do", async () => {
    const today = todayInKarachi();
    const unitB = (await sql<{ id: string }[]>`
      insert into units (apartment_type_id, name, sort) values (${f.threeId}, 'Test unit B', 2) returning id`)[0].id;

    const ended = await createReservation(sql, f.threeId, "2027-10-01", "2027-10-04", { adults: 2, children: 1 });
    const endingSoon = await createReservation(sql, f.threeId, "2027-10-05", "2027-10-07");
    const endingLater = await createReservation(sql, f.threeId, "2027-10-08", "2027-10-09");
    if (!ended.ok || !endingSoon.ok || !endingLater.ok) throw new Error("expected ok");
    await sql`update reservations set hold_expires_at = now() - interval '5 minutes' where id = ${ended.id}`;
    await sql`update reservations set hold_expires_at = now() + interval '90 minutes' where id = ${endingSoon.id}`;
    await sql`update reservations set hold_expires_at = now() + interval '5 hours' where id = ${endingLater.id}`;

    const leftYesterday = await insertReservation(sql, {
      typeId: f.threeId, unitId: unitB, checkIn: addDays(today, -3), checkOut: addDays(today, -1), status: "checked_in",
    });
    const leavingToday = await insertReservation(sql, {
      typeId: f.threeId, unitId: unitB, checkIn: addDays(today, -1), checkOut: today, status: "checked_in",
    });

    const res = await call(expireHolds);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, expired: 1, reminded: 1, remindersOn: true, completed: 1 });

    expect(await statusOf(sql, ended.id)).toBe("expired");
    expect(await statusOf(sql, endingSoon.id)).toBe("reserved");
    expect(await statusOf(sql, endingLater.id)).toBe("reserved");
    expect(await statusOf(sql, leftYesterday.id)).toBe("completed");
    expect(await statusOf(sql, leavingToday.id)).toBe("checked_in");

    expect(sent).toEqual([
      { kind: "hold_ended", id: ended.id, extra: { slug: "three-bedroom" } },
      { kind: "hold_reminder", id: endingSoon.id, extra: undefined },
    ]);
    const [completed] = await sql`select actor, action from activity_log where reservation_id = ${leftYesterday.id}`;
    expect(completed).toEqual({ actor: "system", action: "status:completed" });

    // Idempotent: the second run finds nothing and sends nothing.
    sent.length = 0;
    const again = await call(expireHolds);
    expect(await again.json()).toEqual({ ok: true, expired: 0, reminded: 0, remindersOn: true, completed: 0 });
    expect(sent).toEqual([]);
  });

  it("sends no reminders when holds are shorter than four hours", async () => {
    await sql`update settings set hold_hours = 3 where id`;
    const r = await createReservation(sql, f.threeId, "2027-10-05", "2027-10-07");
    if (!r.ok) throw new Error("expected ok");
    await sql`update reservations set hold_expires_at = now() + interval '60 minutes' where id = ${r.id}`;
    const res = await call(expireHolds);
    expect(await res.json()).toEqual({ ok: true, expired: 0, reminded: 0, remindersOn: false, completed: 0 });
    expect(sent).toEqual([]);
  });

  it("names the right apartment in the reserve-again link of a two-bedroom hold", async () => {
    const r = await createReservation(sql, f.twoId, "2027-10-05", "2027-10-07");
    if (!r.ok) throw new Error("expected ok");
    await sql`update reservations set hold_expires_at = now() - interval '1 minute' where id = ${r.id}`;
    await call(expireHolds);
    expect(sent).toEqual([{ kind: "hold_ended", id: r.id, extra: { slug: "two-bedroom" } }]);
  });
});

describe("GET /api/cron/receipt-retention", () => {
  const root = path.join(process.cwd(), ".data", "receipts");

  it("deletes receipts past retention, clears their paths, logs each deletion, keeps the rest", async () => {
    const today = todayInKarachi();
    const monthsAgo = async (n: number) =>
      (await sql<{ d: string }[]>`select (${today}::date - make_interval(months => ${n}))::date as d`)[0].d;
    await sql`update settings set receipt_retention_months = 12 where id`;

    const oldOut = await monthsAgo(13);
    const old = await insertReservation(sql, {
      typeId: f.threeId, unitId: f.unitA, checkIn: addDays(oldOut, -2), checkOut: oldOut, status: "completed",
    });
    const recentOut = await monthsAgo(11);
    const recent = await insertReservation(sql, {
      typeId: f.threeId, unitId: f.unitA, checkIn: addDays(recentOut, -2), checkOut: recentOut, status: "completed",
    });
    // Exactly at the boundary: twelve months after check-out is the day it goes.
    const boundaryOut = await monthsAgo(12);
    const boundary = await insertReservation(sql, {
      typeId: f.twoId, unitId: f.twoUnit, checkIn: addDays(boundaryOut, -1), checkOut: boundaryOut, status: "cancelled",
    });

    const onDisk = `${old.id}/${randomUUID()}.png`;
    const alreadyGone = `${old.id}/${randomUUID()}.pdf`;
    const kept = `${recent.id}/${randomUUID()}.jpg`;
    const atBoundary = `${boundary.id}/${randomUUID()}.webp`;
    for (const p of [onDisk, kept, atBoundary]) {
      await mkdir(path.dirname(path.join(root, p)), { recursive: true });
      await writeFile(path.join(root, p), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    }
    const pay = async (reservationId: string, receiptPath: string, status: string) =>
      (await sql<{ id: string }[]>`
        insert into payments (reservation_id, method, amount, receipt_path, receipt_status)
        values (${reservationId}, 'bank_transfer', 50000, ${receiptPath}, ${status}) returning id`)[0].id;
    const p1 = await pay(old.id, onDisk, "verified");
    const p2 = await pay(old.id, alreadyGone, "rejected");
    const p3 = await pay(recent.id, kept, "verified");
    const p4 = await pay(boundary.id, atBoundary, "submitted");
    const cashOnly = await pay(old.id, null as unknown as string, "verified");

    try {
      const res = await call(receiptRetention);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, deleted: 2, missing: 1, failed: 0, remaining: 0 });

      expect(existsSync(path.join(root, onDisk))).toBe(false);
      expect(existsSync(path.join(root, atBoundary))).toBe(false);
      expect(existsSync(path.join(root, kept))).toBe(true);

      const rows = await sql<{ id: string; receipt_path: string | null; receipt_status: string; amount: number }[]>`
        select id, receipt_path, receipt_status, amount from payments`;
      const byId = new Map(rows.map((r) => [r.id, r]));
      expect(byId.get(p1)).toMatchObject({ receipt_path: null, receipt_status: "verified", amount: 50000 });
      expect(byId.get(p2)).toMatchObject({ receipt_path: null, receipt_status: "rejected" });
      expect(byId.get(p3)).toMatchObject({ receipt_path: kept });
      expect(byId.get(p4)).toMatchObject({ receipt_path: null });
      expect(byId.get(cashOnly)).toMatchObject({ receipt_path: null, amount: 50000 });

      const log = await sql<{ reservation_id: string; actor: string; payment_id: string; object: string }[]>`
        select reservation_id, actor, detail->>'payment_id' as payment_id, detail->>'object' as object
        from activity_log where action = 'receipt_deleted' order by detail->>'payment_id'`;
      expect(log).toHaveLength(3);
      expect(log.find((l) => l.payment_id === p1)).toMatchObject({ reservation_id: old.id, actor: "system", object: "deleted" });
      expect(log.find((l) => l.payment_id === p2)).toMatchObject({ reservation_id: old.id, object: "already gone" });
      expect(log.find((l) => l.payment_id === p4)).toMatchObject({ reservation_id: boundary.id, object: "deleted" });

      // Idempotent.
      const again = await call(receiptRetention);
      expect(await again.json()).toEqual({ ok: true, deleted: 0, missing: 0, failed: 0, remaining: 0 });
    } finally {
      await import("node:fs/promises").then((fs) =>
        Promise.all([old.id, recent.id, boundary.id].map((id) => fs.rm(path.join(root, id), { recursive: true, force: true }))),
      );
    }
  });

  it("follows the retention setting", async () => {
    await sql`update settings set receipt_retention_months = 3 where id`;
    const today = todayInKarachi();
    const out = (await sql<{ d: string }[]>`select (${today}::date - interval '4 months')::date as d`)[0].d;
    const r = await insertReservation(sql, { typeId: f.threeId, unitId: f.unitA, checkIn: addDays(out, -1), checkOut: out, status: "completed" });
    const receipt = `${r.id}/${randomUUID()}.png`;
    await sql`insert into payments (reservation_id, amount, receipt_path, receipt_status) values (${r.id}, 1, ${receipt}, 'verified')`;
    const res = await call(receiptRetention);
    expect(await res.json()).toEqual({ ok: true, deleted: 0, missing: 1, failed: 0, remaining: 0 });
  });

  it("leaves a path it cannot trust in place and reports it", async () => {
    const r = await insertReservation(sql, { typeId: f.threeId, unitId: f.unitA, checkIn: "2024-01-01", checkOut: "2024-01-03", status: "completed" });
    await sql`insert into payments (reservation_id, amount, receipt_path, receipt_status) values (${r.id}, 1, '../../etc/passwd', 'verified')`;
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await call(receiptRetention).finally(() => quiet.mockRestore());
    expect(quiet).toHaveBeenCalledOnce();
    expect(await res.json()).toEqual({ ok: true, deleted: 0, missing: 0, failed: 1, remaining: 1 });
    const [p] = await sql`select receipt_path from payments where reservation_id = ${r.id}`;
    expect(p.receipt_path).toBe("../../etc/passwd");
  });
});
