import { deleteExpiredReceipts } from "@/lib/storage-retention";
import { CRON_HEADERS, refuseUnlessCron } from "../authorize";

// GET /api/cron/receipt-retention — Vercel Cron, monthly (vercel.json). Requires Authorization: Bearer CRON_SECRET.
// Deletes transfer receipts settings.receipt_retention_months after check-out (Supabase Storage or ./.data/receipts),
// clears payments.receipt_path and logs `receipt_deleted` for each. Idempotent; anything left over (storage outage,
// time budget) is picked up by the next run, or by calling this route again by hand with the secret.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const refused = refuseUnlessCron(req);
  if (refused) return refused;

  try {
    const result = await deleteExpiredReceipts();
    return Response.json({ ok: true, ...result }, { headers: CRON_HEADERS });
  } catch (e) {
    console.error("cron receipt-retention failed", e);
    return Response.json({ ok: false, error: "The cron run failed; see the server log." }, { status: 500, headers: CRON_HEADERS });
  }
}
