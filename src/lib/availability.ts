import { nightsOf } from "./dates";
import { OCCUPYING, type ReservationStatus } from "./status";

export interface StayLike {
  check_in: string;
  check_out: string;
  status: ReservationStatus;
}

/** Two stays overlap when they share at least one night. A turnover day (one leaves, one arrives) is not an overlap. */
export function staysOverlap(aIn: string, aOut: string, bIn: string, bOut: string): boolean {
  return aIn < bOut && bIn < aOut;
}

/** Pure mirror of the database function `is_available`. */
export function isAvailable(
  checkIn: string,
  checkOut: string,
  reservations: StayLike[],
  blockedNights: string[],
): boolean {
  if (checkOut <= checkIn) return false;
  const blocked = new Set(blockedNights);
  if (nightsOf(checkIn, checkOut).some((n) => blocked.has(n))) return false;
  return !reservations.some(
    (r) => OCCUPYING.includes(r.status) && staysOverlap(checkIn, checkOut, r.check_in, r.check_out),
  );
}
