import "server-only";
import { rmdir, unlink } from "node:fs/promises";
import path from "node:path";
import { db } from "./db/sql";
import { env, hasSupabaseStorage } from "./env";
import { todayInKarachi } from "./dates";

// Receipt retention (brief: "a monthly cron deletes receipts receipt_retention_months after check-out and records
// the deletion"). Used by /api/cron/receipt-retention. For each payment whose reservation checked out at least
// settings.receipt_retention_months ago and still has a receipt: delete the object from the private `receipts`
// bucket (Supabase Storage REST, service key) or from ./.data/receipts locally, then clear payments.receipt_path and
// log `receipt_deleted` to activity_log. The payment row itself (amount, status, who verified) is kept.
// Idempotent: an object already gone counts as deleted, and cleared rows are never selected again.

/** Same shape saveReceipt() writes: {reservation uuid}/{uuid}.{ext}. Anything else is never passed to storage. */
const RECEIPT_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/;
const LOCAL_ROOT = path.join(process.cwd(), ".data", "receipts");
const MAX_PER_RUN = 500;

export type DeleteOutcome = "deleted" | "missing";

/** Deletes one receipt object. "missing" when it was already gone. Throws when storage refuses or is unreachable. */
export async function deleteReceiptObject(objectPath: string): Promise<DeleteOutcome> {
  if (!RECEIPT_PATH.test(objectPath)) throw new Error("not a receipt path");
  if (hasSupabaseStorage()) {
    const res = await fetch(`${env.supabaseUrl}/storage/v1/object/receipts/${objectPath}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${env.supabaseServiceKey}`, apikey: env.supabaseServiceKey ?? "" },
      cache: "no-store",
    });
    if (res.ok) return "deleted";
    const body = await res.text().catch(() => "");
    // Storage answers 404, or 400 with {"statusCode":"404","error":"not_found"}, for an object that does not exist.
    if (res.status === 404 || (res.status === 400 && /not.?found/i.test(body))) return "missing";
    throw new Error(`storage delete failed: ${res.status} ${body.slice(0, 200)}`);
  }
  if (env.isProduction) throw new Error("Supabase Storage is not configured.");
  const file = path.resolve(LOCAL_ROOT, objectPath);
  if (!file.startsWith(LOCAL_ROOT + path.sep)) throw new Error("not a receipt path");
  try {
    await unlink(file);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return "missing";
    throw e;
  }
  // Tidy the reservation's folder once its last receipt is gone (fails harmlessly while others remain).
  await rmdir(path.dirname(file)).catch(() => undefined);
  return "deleted";
}

export interface DueReceipt {
  payment_id: string;
  reservation_id: string;
  receipt_path: string;
  check_out: string;
  retention_months: number;
}

/** Payments still holding a receipt whose reservation checked out `receipt_retention_months` or more ago. */
export async function receiptsDue(today: string = todayInKarachi(), limit = MAX_PER_RUN): Promise<DueReceipt[]> {
  return db()<DueReceipt[]>`
    select p.id as payment_id, p.reservation_id, p.receipt_path, r.check_out, s.receipt_retention_months as retention_months
    from payments p
    join reservations r on r.id = p.reservation_id
    cross join settings s
    where s.id and p.receipt_path is not null
      and (r.check_out + make_interval(months => greatest(s.receipt_retention_months, 0)))::date <= ${today}::date
    order by r.check_out, p.created_at, p.id
    limit ${limit}`;
}

/** Clears the path (only if it is still the one deleted) and records the deletion. */
async function recordDeletion(row: DueReceipt, outcome: DeleteOutcome): Promise<void> {
  await db().begin(async (tx) => {
    const cleared = await tx`
      update payments set receipt_path = null
      where id = ${row.payment_id} and receipt_path = ${row.receipt_path}
      returning id`;
    if (cleared.length === 0) return;
    const detail = {
      payment_id: row.payment_id,
      check_out: row.check_out,
      retention_months: row.retention_months,
      object: outcome === "deleted" ? "deleted" : "already gone",
    };
    await tx`
      insert into activity_log (reservation_id, actor, actor_id, action, detail)
      values (${row.reservation_id}, 'system', null, 'receipt_deleted', ${tx.json(detail)})`;
  });
}

export interface RetentionResult {
  /** receipts removed from storage and cleared */
  deleted: number;
  /** objects that were already gone; their paths were cleared */
  missing: number;
  /** storage refused or was unreachable; retried on the next run */
  failed: number;
  /** still due after this run (time budget or failures) */
  remaining: number;
}

/** Deletes every receipt past retention, within a time budget so the function never runs into its limit. */
export async function deleteExpiredReceipts(opts: { today?: string; budgetMs?: number } = {}): Promise<RetentionResult> {
  const today = opts.today ?? todayInKarachi();
  const deadline = Date.now() + (opts.budgetMs ?? 45_000);
  const due = await receiptsDue(today);
  const out: RetentionResult = { deleted: 0, missing: 0, failed: 0, remaining: 0 };
  for (const row of due) {
    if (Date.now() > deadline) break;
    let outcome: DeleteOutcome;
    try {
      outcome = await deleteReceiptObject(row.receipt_path);
    } catch (e) {
      out.failed++;
      console.error(`receipt retention: could not delete the receipt of payment ${row.payment_id}`, e);
      continue;
    }
    await recordDeletion(row, outcome);
    out[outcome]++;
  }
  const [left] = await db()<{ n: number }[]>`
    select count(*)::int as n from payments p
    join reservations r on r.id = p.reservation_id
    cross join settings s
    where s.id and p.receipt_path is not null
      and (r.check_out + make_interval(months => greatest(s.receipt_retention_months, 0)))::date <= ${today}::date`;
  out.remaining = left?.n ?? 0;
  return out;
}
