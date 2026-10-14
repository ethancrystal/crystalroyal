import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/admin-auth";
import { openReceipt } from "@/lib/storage";
import { getReceiptRow } from "@/components/admin/reservations/data";

// GET /api/admin/receipt/{paymentId}: a guest's transfer receipt, for signed-in admins only. With Supabase Storage
// it redirects to a signed URL valid for 60 seconds; locally it streams the bytes. Never cached, never indexed.

export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
} as const;

const paymentId = z.string().uuid();

function plain(status: number, text: string) {
  return new NextResponse(text, { status, headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" } });
}

export async function GET(_req: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const admin = await getAdmin();
  if (!admin) return plain(401, "Sign in to the console to view receipts.");

  const { paymentId: raw } = await params;
  const id = paymentId.safeParse(raw);
  if (!id.success) return plain(404, "Receipt not found.");
  const row = await getReceiptRow(id.data);
  if (!row?.receipt_path) return plain(404, "Receipt not found.");

  let file: Awaited<ReturnType<typeof openReceipt>>;
  try {
    file = await openReceipt(row.receipt_path);
  } catch (e) {
    const missing = typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === "ENOENT";
    if (!missing) console.error("receipt could not be opened", row.id, e);
    return plain(missing ? 404 : 502, missing ? "Receipt not found." : "The receipt could not be opened just now. Try again.");
  }

  if ("url" in file) {
    return NextResponse.redirect(file.url, { status: 302, headers: NO_STORE });
  }
  const ext = row.receipt_path.split(".").pop() ?? "bin";
  return new NextResponse(Buffer.from(file.bytes), {
    status: 200,
    headers: {
      ...NO_STORE,
      "Content-Type": file.mime,
      "Content-Length": String(file.bytes.byteLength),
      "Content-Disposition": `inline; filename="receipt-${row.reference}.${ext}"`,
      // The type comes from the file's magic bytes (sniffReceipt), never from the uploader.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
