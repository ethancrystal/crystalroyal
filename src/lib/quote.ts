import { nightsBetween } from "./dates";
import { priceStay, PricingError, type PriceBreakdown } from "./pricing";
import type { Amenity, ApartmentType, Rate, Settings } from "./types";

// Builds priceStay() input from database rows. Pure: used by the server (authoritative) and by client previews
// that receive the same rows as props.

export interface QuoteRequest {
  type: Pick<ApartmentType, "standard_guests" | "max_guests" | "min_nights">;
  rate: Pick<Rate, "nightly_rate" | "extra_adult_per_night">;
  settings: Pick<
    Settings,
    "tax_rate_percent" | "deposit_policy" | "child_extra_policy" | "child_extra_fee" | "min_nights" | "max_nights"
  >;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  /** amenity rows with the requested quantity; quantities above max_quantity are refused. */
  amenities: { amenity: Pick<Amenity, "id" | "name" | "pricing_type" | "price" | "max_quantity">; quantity: number }[];
}

export const OCCUPANCY_UNCONFIRMED =
  "Occupancy and availability should be confirmed directly with the property.";

/** True when the type can be reserved online (occupancy has been confirmed by the owner). */
export function isReservable(type: Pick<ApartmentType, "standard_guests" | "max_guests">): boolean {
  return type.standard_guests !== null && type.max_guests !== null;
}

export function quoteStay(q: QuoteRequest): PriceBreakdown {
  if (!isReservable(q.type)) throw new PricingError(OCCUPANCY_UNCONFIRMED);
  if (q.checkOut <= q.checkIn) throw new PricingError("Departure must be after arrival.");
  for (const a of q.amenities) {
    if (!Number.isInteger(a.quantity) || a.quantity < 0 || a.quantity > a.amenity.max_quantity) {
      throw new PricingError(`${a.amenity.name}: choose up to ${a.amenity.max_quantity}.`);
    }
  }
  return priceStay({
    nights: nightsBetween(q.checkIn, q.checkOut),
    adults: q.adults,
    children: q.children,
    nightlyRate: q.rate.nightly_rate,
    standardGuests: q.type.standard_guests!,
    maxGuests: q.type.max_guests!,
    minNights: Math.max(q.type.min_nights, q.settings.min_nights),
    maxNights: q.settings.max_nights,
    extraAdultPerNight: q.rate.extra_adult_per_night,
    childPolicy: q.settings.child_extra_policy,
    childExtraPerNight: q.settings.child_extra_fee,
    taxRatePercent: q.settings.tax_rate_percent,
    depositPolicy: q.settings.deposit_policy,
    amenities: q.amenities.map((a) => ({
      id: a.amenity.id,
      name: a.amenity.name,
      pricingType: a.amenity.pricing_type,
      price: a.amenity.price,
      quantity: a.quantity,
    })),
  });
}
