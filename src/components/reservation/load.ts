import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import {
  amountPaid,
  getReservationForGuest,
  getSettings,
  listApartmentTypes,
  listPayments,
  listReservationAmenities,
} from "@/lib/db/queries";
import { accessToken, reference as referenceSchema } from "@/lib/validation";
import { moneyView } from "./format";

// One read for every guest reservation route: the reference and the ?t= access token are checked (constant time)
// before anything else is read; an unknown reference or a wrong token is a 404 that reveals nothing.

export type SearchParams = Record<string, string | string[] | undefined>;

export function tokenFrom(sp: SearchParams): string | null {
  const raw = sp.t;
  const t = Array.isArray(raw) ? raw[0] : raw;
  return accessToken.safeParse(t).success ? (t as string) : null;
}

/** The guest's reservation or null, after zod checks of both parts of the link. */
export async function guestReservation(reference: string, token: string | null) {
  if (!token || !referenceSchema.safeParse(reference).success) return null;
  return getReservationForGuest(reference, token);
}

export const loadGuestView = cache(async (reference: string, token: string | null) => {
  const r = await guestReservation(reference, token);
  if (!r || !token) notFound();
  const [settings, types, payments, amenities, paid] = await Promise.all([
    getSettings(),
    listApartmentTypes(),
    listPayments(r.id),
    listReservationAmenities(r.id),
    amountPaid(r.id),
  ]);
  const type = types.find((t) => t.id === r.apartment_type_id) ?? null;
  const q = `t=${encodeURIComponent(token)}`;
  const base = `/reservation/${r.reference}`;
  return {
    r,
    token,
    settings,
    type,
    typeName: type?.name ?? "Your apartment",
    payments,
    amenities,
    money: moneyView(r, paid),
    links: {
      status: `${base}?${q}`,
      pay: `${base}/pay?${q}`,
      voucher: `${base}/voucher?${q}`,
      ics: `${base}/calendar.ics?${q}`,
      reserveAgain: type
        ? `/reserve/${type.slug}?arrive=${r.check_in}&depart=${r.check_out}&adults=${r.adults}&children=${r.children}`
        : "/",
      apartment: type ? `/apartments/${type.slug}` : "/",
    },
  };
});

export type GuestView = Awaited<ReturnType<typeof loadGuestView>>;

export const SETTLED = new Set(["confirmed", "checked_in", "completed"]);
