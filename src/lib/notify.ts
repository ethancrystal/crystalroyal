import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";
import { getReservationById, getSettings, logActivity } from "./db/queries";
import { renderEmail, type EmailKind } from "./emails";
import { isPlaceholder } from "./site";

// Transactional email. Sending never blocks or fails the user's action: call after the database work has
// committed; failures are retried once and then logged to activity_log.

export type { EmailKind };

export interface Outgoing {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

async function deliver(msg: Outgoing): Promise<void> {
  if (env.resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.emailFrom,
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
        reply_to: msg.replyTo,
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
    return;
  }
  // Development: write to ./.data/outbox so nothing real is sent while placeholders remain.
  const dir = path.join(process.cwd(), ".data", "outbox");
  await mkdir(dir, { recursive: true });
  const name = `${new Date().toISOString().replace(/[:.]/g, "-")}-${msg.subject.replace(/[^a-z0-9]+/gi, "-").slice(0, 60)}`;
  await writeFile(path.join(dir, `${name}.txt`), `To: ${msg.to}\nSubject: ${msg.subject}\n\n${msg.text}\n`);
  await writeFile(path.join(dir, `${name}.html`), msg.html);
}

/**
 * Sends one of the nine emails for a reservation. Owner emails go to settings.owner_notify_email.
 * `extra` carries per-email data (e.g. { reason } for a rejected receipt).
 */
export async function notify(kind: EmailKind, reservationId: string, extra: Record<string, string> = {}): Promise<void> {
  try {
    const [r, settings] = await Promise.all([getReservationById(reservationId), getSettings()]);
    if (!r) return;
    const msg = await renderEmail(kind, { reservation: r, settings, extra, siteUrl: env.siteUrl });
    const ownerKinds: EmailKind[] = ["owner_receipt_uploaded", "owner_new_reservation", "owner_cancellation_requested"];
    const to = ownerKinds.includes(kind) ? settings.owner_notify_email : r.guest_email;
    if (isPlaceholder(to)) {
      await logActivity({ reservation_id: r.id, actor: "system", actor_id: null, action: `email:${kind}:skipped`, detail: { reason: "no address" } });
      return;
    }
    const out: Outgoing = { ...msg, to, replyTo: isPlaceholder(settings.email) ? undefined : settings.email };
    try {
      await deliver(out);
    } catch (first) {
      console.error(`email ${kind} failed, retrying once`, first);
      await deliver(out);
    }
    await logActivity({ reservation_id: r.id, actor: "system", actor_id: null, action: `email:${kind}`, detail: { to } });
  } catch (e) {
    console.error(`email ${kind} failed`, e);
    try {
      await logActivity({
        reservation_id: reservationId,
        actor: "system",
        actor_id: null,
        action: `email:${kind}:failed`,
        detail: { error: e instanceof Error ? e.message.slice(0, 300) : "unknown" },
      });
    } catch {
      /* never throw from notify */
    }
  }
}
