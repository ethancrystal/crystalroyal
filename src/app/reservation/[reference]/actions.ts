"use server";

import { after } from "next/server";
import { z } from "zod";
import {
  countReceipts,
  addPayment,
  getReservationForGuest,
  logActivity,
  requestCancellation as markCancellationRequested,
  transition,
} from "@/lib/db/queries";
import { notify } from "@/lib/notify";
import { rateLimit, verifyTurnstile } from "@/lib/protect";
import { TransitionError } from "@/lib/status";
import { RECEIPT_MAX_BYTES, RECEIPTS_PER_RESERVATION, saveReceipt, sniffReceipt } from "@/lib/storage";
import { accessToken, cancelReason, reference } from "@/lib/validation";

// Guest actions on a reservation page. Each one checks the reference and the 32-byte access token in constant time
// (getReservationForGuest), changes status only through transition(), and sends email through notify() after the
// database work, once the response has gone (after()), so an email failure never fails the guest's action.

// ---------------------------------------------------------------- receipt upload

export type UploadResult =
  | { status: "idle" }
  | { status: "done"; fileName: string }
  | { status: "error"; message: string };

const UPLOAD_FAILED = "We could not upload the file. Check your connection and try again, or send it on WhatsApp.";

const uploadInput = z.object({
  reference,
  t: accessToken,
  receipt: z.instanceof(File, { message: "Choose the receipt to upload." }),
  turnstile: z.string().max(4096).nullable(),
});

/** A short, safe file name to echo back ("transfer-receipt.png"); never trusted for anything else. */
function displayName(name: string): string {
  const clean = name.replace(/[\u0000-\u001f\u007f<>]/g, "").trim();
  return clean.length > 80 ? `${clean.slice(0, 60)}…${clean.slice(-16)}` : clean || "Your receipt";
}

export async function uploadReceipt(_prev: UploadResult, formData: FormData): Promise<UploadResult> {
  const parsed = uploadInput.safeParse({
    reference: formData.get("reference"),
    t: formData.get("t"),
    receipt: formData.get("receipt"),
    turnstile: (formData.get("cf-turnstile-response") as string | null) ?? null,
  });
  if (!parsed.success) {
    const fileIssue = parsed.error.issues.find((i) => i.path[0] === "receipt");
    return { status: "error", message: fileIssue ? "Choose the receipt to upload." : UPLOAD_FAILED };
  }
  const { receipt: file } = parsed.data;

  if (!(await verifyTurnstile(parsed.data.turnstile))) {
    return { status: "error", message: "We could not confirm this upload. Wait a moment, then choose the file again." };
  }
  if (!(await rateLimit("upload"))) {
    return {
      status: "error",
      message: "We have received several uploads from this connection. Please try again later, or send the receipt on WhatsApp.",
    };
  }

  const r = await getReservationForGuest(parsed.data.reference, parsed.data.t);
  if (!r) return { status: "error", message: "We cannot open this reservation. Use the link in your email." };
  if (r.status !== "reserved" && r.status !== "payment_submitted") {
    return {
      status: "error",
      message:
        r.status === "expired"
          ? "Your hold has ended. The dates may still be free; reserve again to hold them."
          : "This reservation is not waiting for a receipt. If you need help, WhatsApp us.",
    };
  }

  if (file.size === 0) {
    // A form sent without a file carries an empty, nameless one.
    return { status: "error", message: file.name ? "This file is empty. Choose the receipt again." : "Choose the receipt to upload." };
  }
  if (file.size > RECEIPT_MAX_BYTES) {
    return { status: "error", message: "This file is larger than 10 MB. Choose a smaller copy, or send it on WhatsApp." };
  }
  // Type by magic bytes only; the browser's claimed type and the file name are ignored.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffReceipt(bytes);
  if (!kind) {
    return { status: "error", message: "This file is not a JPG, PNG, WEBP or PDF. Choose a photo or PDF of the receipt." };
  }
  if ((await countReceipts(r.id)) >= RECEIPTS_PER_RESERVATION) {
    return {
      status: "error",
      message: `We already have ${RECEIPTS_PER_RESERVATION} receipts for this reservation. Please send any further copy on WhatsApp.`,
    };
  }

  // Image EXIF is not stripped: no image library is present (noted in the handover). Receipts stay private.
  let receiptPath: string;
  try {
    receiptPath = await saveReceipt(r.id, bytes, kind.mime, kind.ext);
  } catch (e) {
    console.error("receipt storage failed", e);
    return { status: "error", message: UPLOAD_FAILED };
  }

  try {
    const payment = await addPayment({
      reservation_id: r.id,
      method: "bank_transfer",
      amount: null,
      receipt_path: receiptPath,
      receipt_status: "submitted",
    });
    if (r.status === "reserved") {
      await transition(r.id, "payment_submitted", "guest", null, { payment_id: payment.id });
    } else {
      await logActivity({ reservation_id: r.id, actor: "guest", actor_id: null, action: "receipt:additional", detail: { payment_id: payment.id } });
    }
  } catch (e) {
    if (e instanceof TransitionError) {
      // The hold ended (or the property acted) while the file was on its way. The receipt is kept and the owner is
      // told, because the guest may have paid.
      after(async () => {
        await notify("owner_receipt_uploaded", r.id);
      });
      return { status: "error", message: "Your hold has ended. The dates may still be free; reserve again to hold them." };
    }
    console.error("receipt record failed", e);
    return { status: "error", message: UPLOAD_FAILED };
  }

  after(async () => {
    await notify("receipt_received", r.id);
    await notify("owner_receipt_uploaded", r.id);
  });
  return { status: "done", fileName: displayName(file.name) };
}

// ---------------------------------------------------------------- cancellation request

export type CancelResult =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "error"; message: string; field?: "reason" };

const cancelInput = z.object({ reference, t: accessToken, reason: cancelReason });

/** Asks the property to cancel. Sets cancellation_requested_at and emails the owner; the status does not change. */
export async function requestCancellation(_prev: CancelResult, formData: FormData): Promise<CancelResult> {
  const parsed = cancelInput.safeParse({
    reference: formData.get("reference"),
    t: formData.get("t"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) {
    const reasonIssue = parsed.error.issues.find((i) => i.path[0] === "reason");
    if (reasonIssue) return { status: "error", field: "reason", message: reasonIssue.message };
    return { status: "error", message: "We cannot open this reservation. Use the link in your email." };
  }
  if (!(await rateLimit("cancelRequest"))) {
    return { status: "error", message: "We have received several requests from this connection. Please WhatsApp us instead." };
  }
  const r = await getReservationForGuest(parsed.data.reference, parsed.data.t);
  if (!r) return { status: "error", message: "We cannot open this reservation. Use the link in your email." };
  if (r.status !== "reserved" && r.status !== "payment_submitted" && r.status !== "confirmed") {
    return { status: "error", message: "This reservation can no longer be cancelled online. If you need help, WhatsApp us." };
  }
  // Asking twice changes nothing and sends nothing more.
  if (r.cancellation_requested_at) return { status: "sent" };

  try {
    await markCancellationRequested(r.id, parsed.data.reason);
  } catch (e) {
    console.error("cancellation request failed", e);
    return { status: "error", message: "We could not send your request. Try again, or WhatsApp us." };
  }
  const reason = parsed.data.reason;
  after(async () => {
    await notify("owner_cancellation_requested", r.id, { reason });
  });
  return { status: "sent" };
}
