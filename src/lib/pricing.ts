import type { ChildPolicy, DepositPolicy, PricingType } from "./types";

// One pure pricing function, used for the browser preview and, authoritatively, on the server.

export interface PriceInput {
  nights: number;
  adults: number;
  children: number;
  nightlyRate: number;
  standardGuests: number;
  maxGuests: number;
  minNights: number;
  extraAdultPerNight: number | null;
  childPolicy: ChildPolicy;
  /** Per-night charge for a child counted as an extra guest when childPolicy = "reduced". */
  childExtraPerNight: number | null;
  taxRatePercent: number | null;
  depositPolicy: DepositPolicy;
  amenities: { id: string; name: string; pricingType: PricingType; price: number | null; quantity: number }[];
}

export interface AmenityLine {
  id: string;
  name: string;
  pricingType: PricingType;
  quantity: number;
  unitPrice: number | null;
  /** null when the amenity has no confirmed price: it is requested, not charged. */
  lineTotal: number | null;
}

export interface PriceBreakdown {
  nights: number;
  guests: number;
  nightlyRate: number;
  subtotalNights: number;
  extraGuests: number;
  extraAdults: number;
  extraChildren: number;
  extraAmount: number;
  amenityLines: AmenityLine[];
  amenitiesAmount: number;
  unpricedAmenities: number;
  /** null when the tax rate is not configured: show "plus applicable taxes". */
  taxRatePercent: number | null;
  taxAmount: number;
  total: number;
  amountDue: number;
  depositPolicy: DepositPolicy;
}

export class PricingError extends Error {}

export function amenityLineTotal(
  pricingType: PricingType,
  price: number,
  quantity: number,
  nights: number,
  guests: number,
): number {
  switch (pricingType) {
    case "per_stay":
      return price * quantity;
    case "per_night":
      return price * quantity * nights;
    case "per_guest_per_night":
      return price * quantity * guests * nights;
    case "per_trip":
    case "per_day":
      return price * quantity;
  }
}

export function priceStay(input: PriceInput): PriceBreakdown {
  const { nights, adults, children } = input;
  if (!Number.isInteger(nights) || nights < 1) throw new PricingError("A stay must be at least one night.");
  if (nights < input.minNights) throw new PricingError(`The minimum stay is ${input.minNights} nights.`);
  if (!Number.isInteger(adults) || adults < 1) throw new PricingError("At least one adult is required.");
  if (!Number.isInteger(children) || children < 0) throw new PricingError("Children must be zero or more.");

  const guests = adults + children;
  if (guests > input.maxGuests) {
    throw new PricingError(`This apartment accommodates at most ${input.maxGuests} guests.`);
  }
  const extraGuests = Math.max(0, guests - input.standardGuests);
  if (extraGuests > 0 && input.extraAdultPerNight === null) {
    throw new PricingError(`This apartment accommodates ${input.standardGuests} guests.`);
  }

  // Default: every extra guest is charged the extra-adult fee.
  // When the child policy differs, adults take the standard places first and the remaining extra places are children.
  let extraAdults = extraGuests;
  let extraChildren = 0;
  if (input.childPolicy !== "adult") {
    extraAdults = Math.min(extraGuests, Math.max(0, adults - input.standardGuests));
    extraChildren = extraGuests - extraAdults;
  }
  const adultFee = input.extraAdultPerNight ?? 0;
  const childFee =
    input.childPolicy === "free"
      ? 0
      : input.childPolicy === "reduced"
        ? (input.childExtraPerNight ?? adultFee)
        : adultFee;

  const subtotalNights = nights * input.nightlyRate;
  const extraAmount = (extraAdults * adultFee + extraChildren * childFee) * nights;

  let unpricedAmenities = 0;
  const amenityLines: AmenityLine[] = input.amenities
    .filter((a) => a.quantity > 0)
    .map((a) => {
      if (a.price === null) {
        unpricedAmenities++;
        return { id: a.id, name: a.name, pricingType: a.pricingType, quantity: a.quantity, unitPrice: null, lineTotal: null };
      }
      return {
        id: a.id,
        name: a.name,
        pricingType: a.pricingType,
        quantity: a.quantity,
        unitPrice: a.price,
        lineTotal: amenityLineTotal(a.pricingType, a.price, a.quantity, nights, guests),
      };
    });
  const amenitiesAmount = amenityLines.reduce((s, l) => s + (l.lineTotal ?? 0), 0);

  const taxable = subtotalNights + extraAmount + amenitiesAmount;
  const taxAmount = input.taxRatePercent === null ? 0 : Math.round((taxable * input.taxRatePercent) / 100);
  const total = Math.round(taxable + taxAmount);
  const amountDue = input.depositPolicy === "50" ? Math.round(total * 0.5) : total;

  return {
    nights,
    guests,
    nightlyRate: input.nightlyRate,
    subtotalNights,
    extraGuests,
    extraAdults,
    extraChildren,
    extraAmount,
    amenityLines,
    amenitiesAmount,
    unpricedAmenities,
    taxRatePercent: input.taxRatePercent,
    taxAmount,
    total,
    amountDue,
    depositPolicy: input.depositPolicy,
  };
}

export const PRICING_TYPE_LABEL: Record<PricingType, string> = {
  per_stay: "per stay",
  per_night: "per night",
  per_guest_per_night: "per guest per night",
  per_trip: "per trip",
  per_day: "per day",
};
