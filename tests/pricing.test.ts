import { describe, expect, it } from "vitest";
import { priceStay, PricingError, type PriceInput } from "@/lib/pricing";

const three: PriceInput = {
  nights: 1,
  adults: 2,
  children: 4,
  nightlyRate: 25000,
  standardGuests: 6,
  maxGuests: 8,
  minNights: 1,
  extraAdultPerNight: 5000,
  childPolicy: "same_as_adult",
  childExtraPerNight: null,
  taxRatePercent: null,
  depositPolicy: "full",
  amenities: [],
};

describe("priceStay: three-bedroom nightly totals", () => {
  it("6 guests = 25,000 per night", () => expect(priceStay(three).total).toBe(25000));
  it("7 guests = 30,000 per night", () => expect(priceStay({ ...three, adults: 3 }).total).toBe(30000));
  it("8 guests = 35,000 per night", () => expect(priceStay({ ...three, adults: 4 }).total).toBe(35000));
  it("3 nights, 2 adults + 4 children = 75,000", () => {
    const p = priceStay({ ...three, nights: 3 });
    expect(p.subtotalNights).toBe(75000);
    expect(p.total).toBe(75000);
    expect(p.extraGuests).toBe(0);
  });
  it("9 guests is refused", () => {
    expect(() => priceStay({ ...three, adults: 5 })).toThrow(PricingError);
  });
});

describe("priceStay: validation", () => {
  it("enforces minimum stay", () => expect(() => priceStay({ ...three, minNights: 2 })).toThrow(/minimum stay/));
  it("enforces min and max nights", () =>
    expect(() => priceStay({ ...three, nights: 31, maxNights: 30 })).toThrow("Stays are from 1 to 30 nights."));
  it("party of nine gets the exact message", () =>
    expect(() => priceStay({ ...three, adults: 5, children: 4 })).toThrow(
      "This apartment accommodates up to 8 guests. For a larger party, write to us and we will suggest an arrangement.",
    ));
  it("needs an adult", () => expect(() => priceStay({ ...three, adults: 0 })).toThrow(/adult/));
  it("refuses extra guests when the type has no extra-guest rule", () => {
    expect(() => priceStay({ ...three, standardGuests: 4, maxGuests: 6, extraAdultPerNight: null })).toThrow(PricingError);
  });
});

describe("priceStay: child policy for guests above standard", () => {
  const eight = { ...three, adults: 4, children: 4 };
  it("same_as_adult charges every extra guest the adult fee", () => {
    expect(priceStay(eight).extraAmount).toBe(10000);
  });
  it("free: children above standard are free, adults counted first", () => {
    const p = priceStay({ ...eight, childPolicy: "free" });
    expect(p.extraAdults).toBe(0);
    expect(p.extraChildren).toBe(2);
    expect(p.extraAmount).toBe(0);
  });
  it("reduced: children above standard pay the child fee", () => {
    const p = priceStay({ ...eight, childPolicy: "reduced", childExtraPerNight: 2000 });
    expect(p.extraAmount).toBe(4000);
  });
  it("adults take standard places first", () => {
    const p = priceStay({ ...three, adults: 7, children: 1, childPolicy: "free" });
    expect(p.extraAdults).toBe(1);
    expect(p.extraChildren).toBe(1);
    expect(p.extraAmount).toBe(5000);
  });
});

describe("priceStay: amenities", () => {
  const am = (pricingType: any, price: number | null, quantity = 1) => ({ id: "a", name: "x", pricingType, price, quantity });
  const base = { ...three, nights: 3 }; // 6 guests, 3 nights
  it("per_stay", () => expect(priceStay({ ...base, amenities: [am("per_stay", 1000, 2)] }).amenitiesAmount).toBe(2000));
  it("per_night", () => expect(priceStay({ ...base, amenities: [am("per_night", 1000)] }).amenitiesAmount).toBe(3000));
  it("per_guest_per_night", () =>
    expect(priceStay({ ...base, amenities: [am("per_guest_per_night", 500)] }).amenitiesAmount).toBe(500 * 6 * 3));
  it("per_trip", () => expect(priceStay({ ...base, amenities: [am("per_trip", 4000, 2)] }).amenitiesAmount).toBe(8000));
  it("per_day", () => expect(priceStay({ ...base, amenities: [am("per_day", 6000, 3)] }).amenitiesAmount).toBe(18000));
  it("unpriced amenity is requested, never charged", () => {
    const p = priceStay({ ...base, amenities: [am("per_stay", null)] });
    expect(p.amenitiesAmount).toBe(0);
    expect(p.unpricedAmenities).toBe(1);
    expect(p.amenityLines[0].lineTotal).toBeNull();
  });
  it("quantity 0 is ignored", () => expect(priceStay({ ...base, amenities: [am("per_stay", 1000, 0)] }).amenityLines).toHaveLength(0));
});

describe("priceStay: tax and deposit", () => {
  it("no tax line until a rate is set", () => {
    const p = priceStay(three);
    expect(p.taxRatePercent).toBeNull();
    expect(p.taxAmount).toBe(0);
  });
  it("rounds tax to whole rupees", () => {
    const p = priceStay({ ...three, taxRatePercent: 13 }); // 25000 * 0.13 = 3250
    expect(p.taxAmount).toBe(3250);
    expect(p.total).toBe(28250);
    const q = priceStay({ ...three, nightlyRate: 17001, taxRatePercent: 13 }); // 2210.13
    expect(q.taxAmount).toBe(2210);
  });
  it("50% deposit", () => {
    const p = priceStay({ ...three, nights: 3, depositPolicy: "50" });
    expect(p.total).toBe(75000);
    expect(p.amountDue).toBe(37500);
  });
  it("full deposit due equals total", () => expect(priceStay(three).amountDue).toBe(25000));
});
