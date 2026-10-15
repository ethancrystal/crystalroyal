import { db } from "@/lib/db/sql";
import { completeFinishedStays, expireHolds, expiredNeedingEmail, getSettings, holdsNeedingReminder } from "@/lib/db/queries";
import { notify } from "@/lib/notify";
import { CRON_HEADERS, refuseUnlessCron } from "../authorize";

// GET /api/cron/expire-holds — Vercel Cron, once a day on the Hobby plan (vercel.json). Requires Authorization: Bearer CRON_SECRET.
//  1. Expires `reserved` holds past hold_expires_at (expire_holds(), via transition_reservation) and emails each
//     guest "Your hold has ended" with a reserve-again link for the same type and dates.
//  2. When settings.hold_hours >= 4, sends the reminder to holds ending within the next 2 hours that have not had one.
//  3. Marks checked-in stays completed once their check-out day has passed in Karachi.
// Idempotent: a second run finds nothing to do. expire_holds() returns only the rows that run transitioned, so each
// "hold ended" email goes out once; reminders are skipped once `email:hold_reminder` is logged for the reservation.
// Emails go through notify(), which never throws, after the database work.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Holds shorter than this get no reminder: the reminder would arrive about as soon as the reservation email. */
const REMINDER_MIN_HOLD_HOURS = 4;
const REMINDER_WINDOW_MINUTES = 120;

export async function GET(req: Request) {
  const refused = refuseUnlessCron(req);
  if (refused) return refused;

  try {
    const settings = await getSettings();

    await expireHolds();
    // Includes holds already released by an availability check, which does not send the email.
    const expired = await expiredNeedingEmail();
    if (expired.length > 0) {
      const slugs = await typeSlugs();
      for (const r of expired) {
        const slug = slugs.get(r.apartment_type_id);
        await notify("hold_ended", r.id, slug ? { slug } : {});
      }
    }

    let reminded = 0;
    const remindersOn = settings.hold_hours >= REMINDER_MIN_HOLD_HOURS;
    if (remindersOn) {
      const due = await holdsNeedingReminder(REMINDER_WINDOW_MINUTES);
      for (const r of due) {
        await notify("hold_reminder", r.id);
        reminded++;
      }
    }

    const completed = await completeFinishedStays();

    return Response.json(
      { ok: true, expired: expired.length, reminded, remindersOn, completed: completed.length },
      { headers: CRON_HEADERS },
    );
  } catch (e) {
    console.error("cron expire-holds failed", e);
    return Response.json({ ok: false, error: "The cron run failed; see the server log." }, { status: 500, headers: CRON_HEADERS });
  }
}

/** apartment_type_id -> slug, inactive types included (a hold can outlive a type being hidden). */
async function typeSlugs(): Promise<Map<string, string>> {
  const rows = await db()<{ id: string; slug: string }[]>`select id, slug from apartment_types`;
  return new Map(rows.map((t) => [t.id, t.slug]));
}
