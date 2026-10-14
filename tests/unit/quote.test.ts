import { describe, expect, it } from "vitest";
import { isReservable, OCCUPANCY_UNCONFIRMED, quoteStay, type QuoteRequest } from "@/lib/quote";
import { PricingError } from "@/lib/pricing";

// quoteStay() builds priceStay() input from database rows (as seeded): the authoritative price on the server and the
// preview in the browser. The worked examples are the brief's "facts that must not change".

const threeBedroom: QuoteRequest["type"] = { standard_guests: 6, max_guests: 8, min_nights: 1 };
const twoBedroom: QuoteRequest["type"] = { standard_guests: null, max_guests: null, min_nights: 1 };
const rate: QuoteRequest["rate"] = { nightly_rate: 25000, extra_adult_per_night: 5000 };
const settings: QuoteRequest["settings"] = {
  tax_rate_percent: null,
  deposit_policy: "full",
  child_extra_policy: "same_as_adult",
  child_extra_fee: null,
  min_nights: 1,
  max_nights: 30,
};
const airport = { id: "a1", name: "Airport transfer", pricing_type: "per_trip" as const, price: 4000, max_quantity: 4 };

const quote = (over: Partial<QuoteRequest> = {}) =>
  quoteStay({
    type: threeBedroom,
    rate,
    settings,
    checkIn: "2026-11-02",
    checkOut: "2026-11-03",
    adults: 2,
    children: 4,
    amenities: [],
    ...over,
  });

describe("isReservable", () => {
  it("the three-bedroom (occupancy set) can be reserved online", () => expect(isReservable(threeBedroom)).toBe(true));
  it("the two-bedroom (occupancy not yet confirmed) cannot", () => expect(isReservable(twoBedroom)).toBe(false));
  it("both standard and maximum occupancy are needed", () => {
    expect(isReservable({ standard_guests: 4, max_guests: null })).toBe(false);
    expect(isReservable({ standard_guests: null, max_guests: 6 })).toBe(false);
  });
});

describe("quoteStay: the worked examples (three-bedroom, PKR 25,000, guests 7 and 8 at PKR 5,000)", () => {
  it("6 guests: PKR 25,000 per night before tax", () => {
    const p = quote({ adults: 2, children: 4 });
    expect(p.total).toBe(25000);
    expect(p.extraGuests).toBe(0);
  });
  it("7 guests: PKR 30,000 per night before tax", () => {
    const p = quote({ adults: 3, children: 4 });
    expect(p.total).toBe(30000);
    expect(p.extraAmount).toBe(5000);
  });
  it("8 guests: PKR 35,000 per night before tax", () => {
    const p = quote({ adults: 4, children: 4 });
    expect(p.total).toBe(35000);
    expect(p.extraGuests).toBe(2);
  });
  it("3 nights for 2 adults and 4 children: PKR 75,000", () => {
    const p = quote({ checkOut: "2026-11-05" });
    expect(p.nights).toBe(3);
    expect(p.subtotalNights).toBe(75000);
    expect(p.total).toBe(75000);
    expect(p.amountDue).toBe(75000);
    expect(p.taxRatePercent).toBeNull();
  });
  it("the standard six may be four adults and two children too", () => {
    expect(quote({ adults: 4, children: 2 }).total).toBe(25000);
  });
});

describe("quoteStay: refusals", () => {
  it("refuses the two-bedroom with the occupancy line", () => {
    expect(() => quote({ type: twoBedroom, rate: { nightly_rate: 17000, extra_adult_per_night: null } })).toThrow(OCCUPANCY_UNCONFIRMED);
  });
  it("refuses a party of nine with the exact message", () => {
    expect(() => quote({ adults: 5, children: 4 })).toThrow(
      "This apartment accommodates up to 8 guests. For a larger party, write to us and we will suggest an arrangement.",
    );
  });
  it("refuses departure on or before arrival", () => {
    expect(() => quote({ checkOut: "2026-11-02" })).toThrow("Departure must be after arrival.");
    expect(() => quote({ checkOut: "2026-11-01" })).toThrow(PricingError);
  });
  it("applies the larger of the type's and the property's minimum stay, and the maximum", () => {
    expect(() => quote({ type: { ...threeBedroom, min_nights: 2 } })).toThrow("Stays are from 2 to 30 nights.");
    expect(() => quote({ settings: { ...settings, min_nights: 3 }, checkOut: "2026-11-04" })).toThrow("Stays are from 3 to 30 nights.");
    expect(() => quote({ checkOut: "2026-12-03" })).toThrow("Stays are from 1 to 30 nights.");
    expect(quote({ checkOut: "2026-12-02" }).nights).toBe(30);
  });
});

describe("quoteStay: amenity quantities", () => {
  it("accepts up to max_quantity and prices it", () => {
    const p = quote({ amenities: [{ amenity: airport, quantity: 4 }] });
    expect(p.amenitiesAmount).toBe(16000);
    expect(p.total).toBe(25000 + 16000);
  });
  it("refuses more than max_quantity, naming the amenity", () => {
    expect(() => quote({ amenities: [{ amenity: airport, quantity: 5 }] })).toThrow("Airport transfer: choose up to 4.");
  });
  it("refuses fractional and negative quantities", () => {
    expect(() => quote({ amenities: [{ amenity: airport, quantity: 1.5 }] })).toThrow(PricingError);
    expect(() => quote({ amenities: [{ amenity: airport, quantity: -1 }] })).toThrow(PricingError);
  });
  it("an unpriced amenity is requested, listed, and not charged", () => {
    const p = quote({ amenities: [{ amenity: { ...airport, price: null }, quantity: 2 }] });
    expect(p.amenityLines).toEqual([
      { id: "a1", name: "Airport transfer", pricingType: "per_trip", quantity: 2, unitPrice: null, lineTotal: null },
    ]);
    expect(p.unpricedAmenities).toBe(1);
    expect(p.total).toBe(25000);
  });
  it("quantity 0 means not requested", () => {
    expect(quote({ amenities: [{ amenity: airport, quantity: 0 }] }).amenityLines).toEqual([]);
  });
});

describe("quoteStay: settings flow through", () => {
  it("tax once the owner sets a rate", () => {
    const p = quote({ settings: { ...settings, tax_rate_percent: 15 }, checkOut: "2026-11-05" });
    expect(p.taxAmount).toBe(11250);
    expect(p.total).toBe(86250);
  });
  it("a 50% deposit", () => {
    const p = quote({ settings: { ...settings, deposit_policy: "50" }, checkOut: "2026-11-05" });
    expect(p.amountDue).toBe(37500);
  });
  it("free children above standard occupancy", () => {
    const p = quote({ settings: { ...settings, child_extra_policy: "free" }, adults: 2, children: 6 });
    expect(p.extraAmount).toBe(0);
    expect(p.total).toBe(25000);
  });
});
