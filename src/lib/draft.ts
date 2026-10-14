import "server-only";
import { cookies } from "next/headers";
import { requireDraftSecret, env } from "./env";
import { signPayload, verifyPayload } from "./security";

// Reserve-flow draft state. Non-sensitive choices (dates, party, amenities) travel in the URL; the guest's
// details live only in this signed, httpOnly cookie until step 4 creates the reservation. Nothing is written
// to the database before then.

export interface Draft {
  slug: string;
  arrive: string;
  depart: string;
  adults: number;
  children: number;
  /** "id:qty,..." as in the URL */
  amenities: string;
  guest?: { name: string; phone: string; email: string; arrivalTime: string; requests: string };
  /** Set after a successful reserve: a re-submit of the same draft within a minute returns this reservation. */
  created?: { fingerprint: string; reference: string; token: string; at: number };
}

const COOKIE = "cr_draft";
const MAX_AGE = 60 * 60 * 6; // 6 hours

export async function readDraft(): Promise<Draft | null> {
  const store = await cookies();
  return verifyPayload<Draft>(store.get(COOKIE)?.value, requireDraftSecret());
}

export async function writeDraft(d: Draft): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, signPayload(d, requireDraftSecret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearDraftGuest(): Promise<void> {
  const d = await readDraft();
  if (d) await writeDraft({ ...d, guest: undefined });
}

/** Identifies one draft for the idempotency check. */
export function draftFingerprint(d: Draft): string {
  return [d.slug, d.arrive, d.depart, d.adults, d.children, d.amenities, d.guest?.phone ?? "", d.guest?.email ?? ""].join("|");
}
