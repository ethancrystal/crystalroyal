import { describe, expect, it } from "vitest";
import { formatNumber, formatPKR } from "@/lib/money";

// Whole rupees, Western grouping, "PKR 25,000". Never decimals.

describe("formatPKR", () => {
  it.each([
    [25000, "PKR 25,000"],
    [17000, "PKR 17,000"],
    [5000, "PKR 5,000"],
    [75000, "PKR 75,000"],
    [105000, "PKR 105,000"],
    [1234567, "PKR 1,234,567"],
    [999, "PKR 999"],
    [0, "PKR 0"],
  ])("%d -> %s", (n, s) => expect(formatPKR(n)).toBe(s));

  it("rounds to whole rupees and never shows decimals", () => {
    expect(formatPKR(999.5)).toBe("PKR 1,000");
    expect(formatPKR(12.4)).toBe("PKR 12");
    expect(formatPKR(37500.49)).toBe("PKR 37,500");
    expect(formatPKR(1e7 + 0.3)).not.toMatch(/\./);
  });

  it("uses Western grouping, not lakh grouping", () => {
    expect(formatPKR(1000000)).toBe("PKR 1,000,000");
  });

  it("does not depend on the machine's locale", () => {
    expect(formatPKR(25000)).not.toMatch(/ | |\./);
  });
});

describe("formatNumber", () => {
  it("groups without the currency", () => {
    expect(formatNumber(75000)).toBe("75,000");
    expect(formatNumber(35000.6)).toBe("35,001");
  });
});
