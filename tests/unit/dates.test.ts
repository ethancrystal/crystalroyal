import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  formatDate,
  formatDateTimeKarachi,
  isIsoDate,
  monthStart,
  nightsBetween,
  nightsOf,
  todayInKarachi,
} from "@/lib/dates";

// Every date is Karachi time (UTC+5, no daylight saving). Calendar days are ISO strings with no time zone.

describe("todayInKarachi", () => {
  it("is still the same day one second before Karachi midnight (18:59:59 UTC)", () => {
    expect(todayInKarachi(new Date("2026-11-01T18:59:59Z"))).toBe("2026-11-01");
  });
  it("turns over at Karachi midnight, while it is still the previous day in UTC", () => {
    expect(todayInKarachi(new Date("2026-11-01T19:00:00Z"))).toBe("2026-11-02");
    expect(todayInKarachi(new Date("2026-11-01T23:59:59Z"))).toBe("2026-11-02");
  });
  it("agrees with UTC after UTC midnight", () => {
    expect(todayInKarachi(new Date("2026-11-02T00:30:00Z"))).toBe("2026-11-02");
  });
  it("crosses the year in Karachi first", () => {
    expect(todayInKarachi(new Date("2026-12-31T18:59:00Z"))).toBe("2026-12-31");
    expect(todayInKarachi(new Date("2026-12-31T19:00:00Z"))).toBe("2027-01-01");
  });
  it("ignores the machine's own time zone", () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = "America/Los_Angeles";
      expect(todayInKarachi(new Date("2026-11-01T19:30:00Z"))).toBe("2026-11-02");
    } finally {
      process.env.TZ = original;
    }
  });
  it("returns YYYY-MM-DD", () => expect(todayInKarachi()).toMatch(/^\d{4}-\d{2}-\d{2}$/));
});

describe("nightsOf and nightsBetween", () => {
  it("a stay occupies [check-in, check-out): the departure day is not a night", () => {
    expect(nightsOf("2026-11-02", "2026-11-05")).toEqual(["2026-11-02", "2026-11-03", "2026-11-04"]);
    expect(nightsBetween("2026-11-02", "2026-11-05")).toBe(3);
  });
  it("crosses month and year ends", () => {
    expect(nightsOf("2026-11-29", "2026-12-02")).toEqual(["2026-11-29", "2026-11-30", "2026-12-01"]);
    expect(nightsOf("2026-12-31", "2027-01-02")).toEqual(["2026-12-31", "2027-01-01"]);
  });
  it("counts the leap day", () => {
    expect(nightsBetween("2028-02-28", "2028-03-01")).toBe(2);
    expect(nightsBetween("2027-02-28", "2027-03-01")).toBe(1);
  });
  it("is empty when departure is not after arrival", () => {
    expect(nightsOf("2026-11-05", "2026-11-05")).toEqual([]);
    expect(nightsOf("2026-11-05", "2026-11-02")).toEqual([]);
  });
});

describe("addDays", () => {
  it("rolls over months, years and leap days", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(addDays("2026-11-02", -2)).toBe("2026-10-31");
    expect(addDays("2026-11-02", 0)).toBe("2026-11-02");
  });
});

describe("addMonths", () => {
  it("returns the first day of the month n months away", () => {
    expect(addMonths("2026-10-14", 1)).toBe("2026-11-01");
    expect(addMonths("2026-10-01", 0)).toBe("2026-10-01");
    expect(addMonths("2026-12-31", 1)).toBe("2027-01-01");
    expect(addMonths("2026-10-14", 12)).toBe("2027-10-01");
  });
  it("never overflows from a long month into the one after next", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-01");
    expect(addMonths("2026-08-31", 1)).toBe("2026-09-01");
  });
  it("goes backwards across a year", () => {
    expect(addMonths("2026-03-15", -1)).toBe("2026-02-01");
    expect(addMonths("2026-01-05", -1)).toBe("2025-12-01");
  });
  it("monthStart", () => expect(monthStart("2026-11-17")).toBe("2026-11-01"));
});

describe("isIsoDate", () => {
  it("accepts real calendar days only", () => {
    expect(isIsoDate("2026-11-02")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2027-02-29")).toBe(false);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-1-2")).toBe(false);
    expect(isIsoDate("2026-11-02T00:00:00Z")).toBe(false);
    expect(isIsoDate(20261102)).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
});

describe("formatting", () => {
  it("formatDate shows a calendar day without shifting it", () => {
    expect(formatDate("2026-11-02")).toBe("Mon, 2 Nov 2026");
    expect(formatDate("2026-11-02", { weekday: "long", month: "long", year: undefined })).toBe("Monday 2 November");
  });
  it("formatDateTimeKarachi shows an instant in Karachi time", () => {
    // 04:40 UTC is 09:40 in Karachi (the copy deck's "09:40 PKT").
    expect(formatDateTimeKarachi("2026-11-03T04:40:00Z")).toBe("Tue 3 Nov, 09:40 Karachi time");
    expect(formatDateTimeKarachi("2026-11-03T04:40:00Z").replace(" Karachi time", " PKT")).toBe("Tue 3 Nov, 09:40 PKT");
  });
  it("formatDateTimeKarachi moves to the next Karachi day after 19:00 UTC", () => {
    expect(formatDateTimeKarachi("2026-11-02T19:15:00Z")).toBe("Tue 3 Nov, 00:15 Karachi time");
  });
});
