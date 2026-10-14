import { describe, expect, it } from "vitest";
import {
  dayLabel,
  dayState,
  ledgerDate,
  ledgerFor,
  monthFullyTaken,
  monthLabel,
  monthWeeks,
  moveDate,
  partyNote,
  problemMessage,
  rangeProblem,
  selectNight,
  shiftMonths,
  spokenDate,
  viewFor,
  weekdayIndex,
  type NightState,
  type SelectContext,
} from "@/components/calendar-logic";
import { priceStay, type PriceInput } from "@/lib/pricing";

// November 2026 as drawn on the canvas: 12–14 and 20–21 reserved, 27–28 blocked; today is 14 October 2026.
const STATES: Record<string, NightState> = {
  "2026-11-12": "reserved",
  "2026-11-13": "reserved",
  "2026-11-14": "reserved",
  "2026-11-20": "reserved",
  "2026-11-21": "reserved",
  "2026-11-27": "blocked",
  "2026-11-28": "blocked",
};
const ctx: SelectContext = {
  today: "2026-10-14",
  stateOf: (d) => (d.startsWith("2026-11") ? (STATES[d] ?? "free") : d.startsWith("2026-10") ? "free" : undefined),
  minNights: 1,
  maxNights: 30,
};
const none = { arrive: "", depart: "" };

describe("calendar grid", () => {
  it("weeks start on Monday; November 2026 begins on a Sunday", () => {
    expect(weekdayIndex("2026-11-02")).toBe(0);
    expect(weekdayIndex("2026-11-01")).toBe(6);
    const weeks = monthWeeks("2026-11-01");
    expect(weeks[0]).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(weeks[1][0]).toBe("2026-11-02");
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
  });
  it("December 2026 begins on a Tuesday", () => {
    expect(monthWeeks("2026-12-01")[0].slice(0, 2)).toEqual([null, "2026-12-01"]);
  });
  it("labels months and days in words", () => {
    expect(monthLabel("2026-11-01")).toBe("November 2026");
    expect(spokenDate("2026-11-02")).toBe("Monday 2 November 2026");
    expect(ledgerDate("2026-11-02", "2026-10-14")).toBe("Mon 2 Nov");
    expect(ledgerDate("2027-01-09", "2026-10-14")).toBe("Sat 9 Jan 2027");
  });
});

describe("day state and spoken label", () => {
  const sel = { arrive: "2026-11-02", depart: "2026-11-05", today: "2026-10-14" };
  it("marks arrival, nights and departure", () => {
    expect(dayState("2026-11-02", sel)).toBe("selected");
    expect(dayState("2026-11-04", sel)).toBe("selected");
    expect(dayState("2026-11-05", sel)).toBe("departure");
    expect(dayState("2026-11-06", sel)).toBe("available");
  });
  it("reserved, blocked and past", () => {
    expect(dayState("2026-11-12", { ...sel, state: "reserved" })).toBe("reserved");
    expect(dayState("2026-11-27", { ...sel, state: "blocked" })).toBe("blocked");
    expect(dayState("2026-10-13", sel)).toBe("past");
  });
  it("a departure on a reserved night still reads as the departure", () => {
    expect(dayState("2026-11-12", { arrive: "2026-11-09", depart: "2026-11-12", today: "2026-10-14", state: "reserved" })).toBe(
      "departure",
    );
  });
  it("speaks every state in words", () => {
    expect(dayLabel("2026-11-02", "available", "")).toBe("Monday 2 November 2026, available");
    expect(dayLabel("2026-11-02", "selected", "2026-11-02")).toBe("Monday 2 November 2026, arrival");
    expect(dayLabel("2026-11-03", "selected", "2026-11-02")).toBe("Tuesday 3 November 2026, in your stay");
    expect(dayLabel("2026-11-12", "reserved", "")).toBe("Thursday 12 November 2026, reserved");
    expect(dayLabel("2026-11-27", "blocked", "")).toBe("Friday 27 November 2026, unavailable");
  });
});

describe("selecting a stay", () => {
  it("first tap is the arrival, second the departure", () => {
    const a = selectNight(none, "2026-11-02", ctx);
    expect(a).toEqual({ selection: { arrive: "2026-11-02", depart: "" }, problem: null });
    const b = selectNight(a.selection, "2026-11-05", ctx);
    expect(b).toEqual({ selection: { arrive: "2026-11-02", depart: "2026-11-05" }, problem: null });
  });
  it("a second tap before the first swaps them", () => {
    const r = selectNight({ arrive: "2026-11-05", depart: "" }, "2026-11-02", ctx);
    expect(r.selection).toEqual({ arrive: "2026-11-02", depart: "2026-11-05" });
  });
  it("tapping the arrival again clears it; a tap after a full range starts again", () => {
    expect(selectNight({ arrive: "2026-11-02", depart: "" }, "2026-11-02", ctx).selection).toEqual(none);
    expect(selectNight({ arrive: "2026-11-02", depart: "2026-11-05" }, "2026-11-08", ctx).selection).toEqual({
      arrive: "2026-11-08",
      depart: "",
    });
  });
  it("a range may not contain an unavailable night", () => {
    const r = selectNight({ arrive: "2026-11-10", depart: "" }, "2026-11-16", ctx);
    expect(r.selection).toEqual({ arrive: "2026-11-10", depart: "" });
    expect(r.problem).toEqual({ kind: "crosses", night: "2026-11-12" });
    expect(problemMessage(r.problem!)).toBe(
      "Thursday 12 November is not available, so your stay cannot include it. Choose other dates.",
    );
  });
  it("the departure may land on the first night of a reservation or a block (half-open ranges)", () => {
    expect(selectNight({ arrive: "2026-11-09", depart: "" }, "2026-11-12", ctx).selection).toEqual({
      arrive: "2026-11-09",
      depart: "2026-11-12",
    });
    expect(selectNight({ arrive: "2026-11-22", depart: "" }, "2026-11-27", ctx).problem).toBeNull();
    // ...and a stay may begin on the morning a reservation ends.
    expect(selectNight(none, "2026-11-15", ctx).problem).toBeNull();
  });
  it("an unavailable night cannot be the arrival", () => {
    const r = selectNight(none, "2026-11-13", ctx);
    expect(r.selection).toEqual(none);
    expect(problemMessage(r.problem!)).toBe("Friday 13 November is already reserved. Choose another arrival.");
    const s = selectNight({ arrive: "2026-11-30", depart: "" }, "2026-11-28", ctx);
    expect(s.problem).toEqual({ kind: "taken", night: "2026-11-28", state: "blocked" });
  });
  it("past nights are refused", () => {
    expect(selectNight(none, "2026-10-13", ctx).problem?.kind).toBe("past");
    expect(selectNight(none, "2026-10-14", ctx).problem).toBeNull();
  });
  it("enforces the minimum and maximum stay", () => {
    const strict = { ...ctx, minNights: 2, maxNights: 5 };
    const short = selectNight({ arrive: "2026-11-02", depart: "" }, "2026-11-03", strict);
    expect(short.problem).toEqual({ kind: "length", min: 2, max: 5 });
    expect(problemMessage(short.problem!)).toBe("Stays are from 2 to 5 nights.");
    expect(selectNight({ arrive: "2026-11-02", depart: "" }, "2026-11-08", strict).problem?.kind).toBe("length");
    expect(selectNight({ arrive: "2026-11-02", depart: "" }, "2026-11-07", strict).problem).toBeNull();
  });
  it("nights whose state is not loaded yet do not block a range", () => {
    expect(rangeProblem("2026-11-29", "2026-12-03", ctx)).toBeNull();
  });
  it("a stale arrival in the past starts a fresh selection", () => {
    expect(selectNight({ arrive: "2026-10-01", depart: "" }, "2026-11-02", ctx).selection).toEqual({
      arrive: "2026-11-02",
      depart: "",
    });
  });
});

describe("keyboard and paging", () => {
  it("arrow keys move by day and week; Home and End to the week's ends", () => {
    expect(moveDate("2026-11-30", "ArrowRight")).toBe("2026-12-01");
    expect(moveDate("2026-11-02", "ArrowLeft")).toBe("2026-11-01");
    expect(moveDate("2026-11-02", "ArrowUp")).toBe("2026-10-26");
    expect(moveDate("2026-11-02", "ArrowDown")).toBe("2026-11-09");
    expect(moveDate("2026-11-04", "Home")).toBe("2026-11-02");
    expect(moveDate("2026-11-04", "End")).toBe("2026-11-08");
    expect(moveDate("2026-11-04", "Enter")).toBeNull();
  });
  it("page keys keep the day within the month's length", () => {
    expect(shiftMonths("2027-01-31", 1)).toBe("2027-02-28");
    expect(moveDate("2026-12-31", "PageUp")).toBe("2026-11-30");
  });
  it("the view follows focus and never starts before the current month", () => {
    expect(viewFor("2026-11-01", 2, "2026-12-15", "2026-10-01")).toBe("2026-11-01");
    expect(viewFor("2026-11-01", 2, "2027-01-04", "2026-10-01")).toBe("2026-12-01");
    expect(viewFor("2026-11-01", 1, "2026-12-01", "2026-10-01")).toBe("2026-12-01");
    expect(viewFor("2026-11-01", 2, "2026-10-20", "2026-10-01")).toBe("2026-10-01");
    expect(viewFor("2026-10-01", 2, "2026-09-28", "2026-10-01")).toBe("2026-10-01");
  });
  it("detects a month with no free nights", () => {
    const full = (d: string): NightState | undefined => (d.startsWith("2026-12") ? "reserved" : "free");
    expect(monthFullyTaken("2026-12-01", "2026-10-14", full)).toBe(true);
    expect(monthFullyTaken("2026-11-01", "2026-10-14", full)).toBe(false);
    expect(monthFullyTaken("2026-12-01", "2026-10-14", () => undefined)).toBe(false);
  });
});

describe("party note", () => {
  it("matches the canvas copy", () => {
    expect(partyNote(6, 6, 8)).toBe("6 guests. Up to 6 as standard, 8 at most.");
    expect(partyNote(1, 6, 8)).toBe("1 guest. Up to 6 as standard, 8 at most.");
    expect(partyNote(8, 6, 8)).toBe("Eight guests is the maximum for this apartment.");
  });
});

describe("price ledger", () => {
  const three: PriceInput = {
    nights: 3,
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

  it("standard party, no tax rate: nights, taxes note, total before tax", () => {
    const l = ledgerFor(priceStay(three), { taxLabel: "[Applicable taxes]" });
    expect(l.lines).toEqual([
      { key: "nights", label: "3 nights × PKR 25,000", amount: "75,000" },
      { key: "tax", label: "Taxes", amount: null, note: "plus applicable taxes" },
    ]);
    expect(l.totalLabel).toBe("Total before tax");
    expect(l.total).toBe("75,000");
    expect(l.due).toBeNull();
  });

  it("additional guests line", () => {
    const l = ledgerFor(priceStay({ ...three, adults: 4 }), { taxLabel: "[Applicable taxes]" });
    expect(l.lines[1]).toEqual({ key: "extra", label: "2 additional guests × PKR 5,000 × 3 nights", amount: "30,000" });
    expect(l.total).toBe("105,000");
    const one = ledgerFor(priceStay({ ...three, nights: 1, adults: 3 }), { taxLabel: "" });
    expect(one.lines[0].label).toBe("1 night × PKR 25,000");
    expect(one.lines[1].label).toBe("1 additional guest × PKR 5,000 × 1 night");
  });

  it("splits adults and children when the child policy differs", () => {
    const b = priceStay({ ...three, adults: 7, children: 1, childPolicy: "reduced", childExtraPerNight: 2000 });
    const l = ledgerFor(b, { taxLabel: "", extraAdultFee: 5000, extraChildFee: 2000 });
    expect(l.lines.map((x) => x.label)).toContain("1 additional adult × PKR 5,000 × 3 nights");
    expect(l.lines.map((x) => x.label)).toContain("1 additional child × PKR 2,000 × 3 nights");
    const free = ledgerFor(priceStay({ ...three, adults: 5, children: 3, childPolicy: "free" }), { taxLabel: "" });
    expect(free.lines.find((x) => x.key === "extra-children")).toEqual({
      key: "extra-children",
      label: "2 additional children, no charge",
      amount: "0",
    });
  });

  it("unpriced amenities are quoted separately; priced ones are added", () => {
    const b = priceStay({
      ...three,
      amenities: [
        { id: "a1", name: "Airport transfer", pricingType: "per_trip", price: null, quantity: 1 },
        { id: "a2", name: "Daily housekeeping", pricingType: "per_night", price: 1000, quantity: 1 },
      ],
    });
    const l = ledgerFor(b, { taxLabel: "" });
    expect(l.lines.find((x) => x.key === "amenity-a1")).toEqual({
      key: "amenity-a1",
      label: "Airport transfer × 1",
      amount: null,
      note: "Quoted separately",
      placeholder: "[PKR __]",
    });
    expect(l.lines.find((x) => x.key === "amenity-a2")?.amount).toBe("3,000");
    expect(l.total).toBe("78,000");
  });

  it("with a tax rate: the tax line carries the label and the total is 'Total'; 50% deposit adds Due now", () => {
    const b = priceStay({ ...three, taxRatePercent: 16, depositPolicy: "50" });
    const l = ledgerFor(b, { taxLabel: "[Applicable taxes]" });
    expect(l.lines.at(-1)).toEqual({ key: "tax", label: "[Applicable taxes] 16%", amount: "12,000" });
    expect(l.totalLabel).toBe("Total");
    expect(l.total).toBe("87,000");
    expect(l.due).toEqual({ label: "Due now (50%)", amount: "43,500" });
  });
});

describe("a conflicting range chosen elsewhere", () => {
  it("keeps taken nights drawn as taken inside the range", () => {
    const sel = { arrive: "2026-11-09", depart: "2026-11-16", today: "2026-10-14" };
    expect(dayState("2026-11-09", sel)).toBe("selected");
    expect(dayState("2026-11-12", { ...sel, state: "reserved" })).toBe("reserved");
    expect(dayState("2026-11-16", sel)).toBe("departure");
    expect(rangeProblem(sel.arrive, sel.depart, ctx)).toEqual({ kind: "crosses", night: "2026-11-12" });
  });
});
