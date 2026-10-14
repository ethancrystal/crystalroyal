"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import {
  AdminError,
  PAYMENT_METHODS,
  addNote,
  adminErrorMessage,
  cancelReservation,
  checkIn,
  checkOut,
  moveUnit,
  recordPayment,
  rejectPayment,
  verifyPayment,
  type EmailHint,
} from "@/lib/db/admin-queries";
import { notify } from "@/lib/notify";
import { paymentReservationId } from "@/components/admin/reservations/data";
import { detailHref, type ActionState, type DoneCode } from "@/components/admin/reservations/shared";

// Server actions of the reservation detail page. Every one: requireAdmin(), zod on the posted fields, the
// admin-queries mutation (which re-validates, changes status only through transition() and writes activity_log with
// the admin's user id), then notify() after the response so an email failure never fails the action. A refusal comes
// back as ActionState; success redirects to the detail page with a "Saved." notice.

const id = z.string().uuid("Reservation not found.");
const reason = z.string().trim().min(2, "Give a short reason.").max(500, "Keep the reason under 500 characters.");

function fields(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

function invalid(error: z.ZodError): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: error.issues[0]?.message ?? "Check the form and try again.", fieldErrors };
}

function refused(e: unknown): ActionState {
  return e instanceof AdminError
    ? { error: e.message, fieldErrors: e.fieldErrors }
    : { error: adminErrorMessage(e) };
}

/** Sends the suggested email after the response (notify() never throws; a failure is logged to activity_log). */
function sendLater(reservationId: string, email: EmailHint, extra?: Record<string, string>) {
  if (!email) return;
  const payload = { ...(email.extra ?? {}), ...(extra ?? {}) };
  after(() => notify(email.kind, reservationId, payload));
}

function done(reservationId: string, code: DoneCode): never {
  revalidatePath("/admin", "layout");
  redirect(detailHref(reservationId, code));
}

async function receiptOf(reservationId: string, paymentId: string): Promise<ActionState | null> {
  const owner = await paymentReservationId(paymentId);
  return owner === reservationId ? null : { error: "That receipt does not belong to this reservation. Reload the page." };
}

// ---------------------------------------------------------------- receipts

const receiptInput = z.object({ reservationId: id, paymentId: z.string().uuid("Receipt not found.") });

export async function verifyReceiptAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const p = receiptInput.safeParse(fields(form));
  if (!p.success) return invalid(p.error);
  const mismatch = await receiptOf(p.data.reservationId, p.data.paymentId);
  if (mismatch) return mismatch;
  let email: EmailHint;
  try {
    ({ email } = await verifyPayment(p.data.paymentId, admin));
  } catch (e) {
    return refused(e);
  }
  sendLater(p.data.reservationId, email);
  done(p.data.reservationId, email ? "verified" : "receipt_verified");
}

const rejectInput = receiptInput.extend({ reason });

export async function rejectReceiptAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const p = rejectInput.safeParse(fields(form));
  if (!p.success) return invalid(p.error);
  const mismatch = await receiptOf(p.data.reservationId, p.data.paymentId);
  if (mismatch) return mismatch;
  let email: EmailHint;
  try {
    ({ email } = await rejectPayment(p.data.paymentId, p.data.reason, admin));
  } catch (e) {
    return refused(e);
  }
  sendLater(p.data.reservationId, email, { reason: p.data.reason });
  done(p.data.reservationId, email ? "rejected" : "rejected_quiet");
}

// ---------------------------------------------------------------- payments

const recordInput = z.object({
  reservationId: id,
  method: z.enum(PAYMENT_METHODS, { errorMap: () => ({ message: "Choose how it was paid." }) }),
  amount: z.coerce
    .number({ invalid_type_error: "Enter the amount received in whole rupees." })
    .int("Enter the amount received in whole rupees.")
    .min(1, "Enter the amount received in whole rupees.")
    .max(100_000_000, "Enter the amount received in whole rupees."),
  bankReference: z.string().trim().max(100, "Keep the reference under 100 characters.").default(""),
});

export async function recordPaymentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const p = recordInput.safeParse(fields(form));
  if (!p.success) return invalid(p.error);
  let email: EmailHint;
  try {
    ({ email } = await recordPayment(
      { reservationId: p.data.reservationId, method: p.data.method, amount: p.data.amount, bankReference: p.data.bankReference || null },
      admin,
    ));
  } catch (e) {
    return refused(e);
  }
  sendLater(p.data.reservationId, email);
  done(p.data.reservationId, email ? "recorded_confirmed" : "recorded");
}

// ---------------------------------------------------------------- status

export async function cancelAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const p = z.object({ reservationId: id, reason }).safeParse(fields(form));
  if (!p.success) return invalid(p.error);
  let email: EmailHint;
  try {
    ({ email } = await cancelReservation(p.data.reservationId, p.data.reason, admin));
  } catch (e) {
    return refused(e);
  }
  sendLater(p.data.reservationId, email, { reason: p.data.reason });
  done(p.data.reservationId, "cancelled");
}

export async function checkInAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const p = z.object({ reservationId: id }).safeParse(fields(form));
  if (!p.success) return invalid(p.error);
  try {
    await checkIn(p.data.reservationId, admin);
  } catch (e) {
    return refused(e);
  }
  done(p.data.reservationId, "checked_in");
}

export async function checkOutAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const p = z.object({ reservationId: id }).safeParse(fields(form));
  if (!p.success) return invalid(p.error);
  try {
    await checkOut(p.data.reservationId, admin);
  } catch (e) {
    return refused(e);
  }
  done(p.data.reservationId, "checked_out");
}

// ---------------------------------------------------------------- unit and notes

export async function moveUnitAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const p = z.object({ reservationId: id, unitId: z.string().uuid("Choose a unit.") }).safeParse(fields(form));
  if (!p.success) return invalid(p.error);
  try {
    await moveUnit(p.data.reservationId, p.data.unitId, admin);
  } catch (e) {
    return refused(e);
  }
  done(p.data.reservationId, "moved");
}

export async function addNoteAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const p = z
    .object({ reservationId: id, text: z.string().trim().min(1, "Write the note first.").max(2000, "Keep the note under 2,000 characters.") })
    .safeParse(fields(form));
  if (!p.success) return invalid(p.error);
  try {
    await addNote(p.data.reservationId, p.data.text, admin);
  } catch (e) {
    return refused(e);
  }
  done(p.data.reservationId, "note");
}
