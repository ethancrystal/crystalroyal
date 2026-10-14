import { describe, expect, it } from "vitest";
import { renderEmail, type EmailKind } from "@/lib/emails";
import type { Reservation, Settings } from "@/lib/types";

// The emails from the copy deck: subjects verbatim, each guest email carrying the reference, the status link and
// the WhatsApp number; owner emails carrying the admin link. Concierge voice: no exclamation marks.

const SITE = "https://crystalroyal.test";
const TOKEN = "tok_abcdefghijklmnopqrstuvwxyz0123456789ABCDE";

const reservation: Reservation = {
  id: "11111111-2222-4333-8444-555555555555",
  reference: "CRA-2611-0042",
  access_token: TOKEN,
  apartment_type_id: "type-3",
  unit_id: "unit-3a",
  check_in: "2026-11-02",
  check_out: "2026-11-05",
  adults: 2,
  children: 4,
  guest_name: "Ayesha Khan",
  guest_phone: "+923001234567",
  guest_email: "ayesha@example.com",
  arrival_time: "15:00",
  requests: "",
  status: "reserved",
  source: "web",
  nightly_rate: 25000,
  nights: 3,
  subtotal_nights: 75000,
  extra_adults: 0,
  extra_adults_amount: 0,
  amenities_amount: 30000,
  tax_rate_percent: null,
  tax_label: "",
  tax_amount: 0,
  total: 105000,
  amount_due: 105000,
  currency: "PKR",
  hold_expires_at: "2026-11-03T04:40:00Z", // 09:40 PKT
  hold_extended: false,
  confirmed_at: null,
  checked_in_at: null,
  completed_at: null,
  cancelled_at: null,
  cancel_reason: null,
  cancellation_requested_at: null,
  admin_notes: "",
  created_at: "2026-11-02T16:40:00Z",
  updated_at: "2026-11-02T16:40:00Z",
};

const settings: Settings = {
  tax_rate_percent: null,
  tax_label: "[Applicable taxes]",
  hold_hours: 12,
  confirm_within_hours: "[__]",
  deposit_policy: "full",
  free_cancellation_days: null,
  cancellation_text: "[Free cancellation up to __ days before arrival. After that, the amount paid is retained.]",
  child_max_age: null,
  child_extra_policy: "same_as_adult",
  child_extra_fee: null,
  bank_name: "Meezan Bank Limited",
  account_title: "[Crystal Royal Apartment]",
  account_number: "[__________]",
  iban: "[PK__ MEZN ____ ____ ____ ____]",
  branch: "[Branch name and code]",
  swift: "[MEZNPKKA — confirm]",
  raast_id: "[optional Raast ID or mobile number]",
  whatsapp_number: "[92XXXXXXXXXX]",
  phone_display: "[+92 XXX XXXXXXX]",
  email: "[reservations@crystalroyalapartment.com]",
  owner_notify_email: "[owner@crystalroyalapartment.com]",
  check_in: "[15:00]",
  check_out: "[11:00]",
  min_nights: 1,
  max_nights: 30,
  receipt_retention_months: 12,
};

const render = (kind: EmailKind, extra: Record<string, string> = {}, r: Partial<Reservation> = {}) =>
  renderEmail(kind, { reservation: { ...reservation, ...r }, settings, extra, siteUrl: SITE });

const statusUrl = `${SITE}/reservation/CRA-2611-0042?t=${TOKEN}`;
const adminUrl = `${SITE}/admin/reservations/${reservation.id}`;

describe("subjects (copy deck)", () => {
  it.each<[EmailKind, string]>([
    ["reservation_received", "Your reservation CRA-2611-0042 — payment instructions"],
    ["receipt_received", "We have your receipt"],
    ["owner_receipt_uploaded", "Receipt uploaded: CRA-2611-0042, PKR 105,000"],
    ["confirmed", "Your stay is confirmed — 2 to 5 November"],
    ["receipt_rejected", "Receipt not matched — CRA-2611-0042"],
    ["hold_ended", "Your hold on 2 to 5 November has ended"],
    ["cancelled", "Reservation CRA-2611-0042 cancelled"],
    ["owner_new_reservation", "New reservation: CRA-2611-0042"],
  ])("%s: %s", async (kind, subject) => {
    expect((await render(kind)).subject).toBe(subject);
  });

  it("hold_reminder: 'Your dates are held until … 09:40 PKT'", async () => {
    // The copy deck writes "Your dates are held until 09:40 PKT tomorrow"; the template names the day instead of
    // "tomorrow" (see the requests in the ops report). The time and PKT must match.
    expect((await render("hold_reminder")).subject).toMatch(/^Your dates are held until .*09:40 PKT/);
  });

  it("owner_cancellation_requested names the reference", async () => {
    expect((await render("owner_cancellation_requested")).subject).toBe("Cancellation requested: CRA-2611-0042");
  });

  // Enable once stayRange() in src/lib/emails.ts writes both months for a stay that crosses a month end
  // (requested in the ops report); today it reads "30 to 2 December".
  it("a stay across a month end names both months", async () => {
    const s = (await render("confirmed", {}, { check_in: "2026-11-30", check_out: "2026-12-02" })).subject;
    expect(s).toBe("Your stay is confirmed — 30 November to 2 December");
  });
});

const GUEST: EmailKind[] = ["reservation_received", "hold_reminder", "receipt_received", "confirmed", "receipt_rejected", "hold_ended", "cancelled"];
const OWNER: EmailKind[] = ["owner_receipt_uploaded", "owner_new_reservation", "owner_cancellation_requested"];

describe("what every email carries", () => {
  it.each(GUEST)("%s (guest): reference, status link with the token, WhatsApp", async (kind) => {
    const { text, html } = await render(kind);
    expect(text).toContain("CRA-2611-0042");
    expect(text).toContain(statusUrl);
    expect(text).toContain("WhatsApp [+92 XXX XXXXXXX]");
    expect(html).toContain("CRA-2611-0042");
    expect(html).toContain(statusUrl);
    expect(text).not.toContain(adminUrl);
  });

  it.each(OWNER)("%s (owner): reference and the admin link, never the guest's token", async (kind) => {
    const { text } = await render(kind);
    expect(text).toContain("CRA-2611-0042");
    expect(text).toContain(adminUrl);
    expect(text).not.toContain(TOKEN);
  });

  it.each([...GUEST, ...OWNER])("%s: concierge voice, no exclamation marks", async (kind) => {
    const { subject, text } = await render(kind, { reason: "The amount does not match", slug: "three-bedroom" });
    expect(subject).not.toContain("!");
    expect(text).not.toContain("!");
  });
});

describe("bodies", () => {
  it("reservation received: amount, Meezan Bank, reference in the note, the hold in PKT, the pay link", async () => {
    const { text } = await render("reservation_received");
    expect(text).toContain("Dear Ayesha Khan,");
    expect(text).toContain("transfer PKR 105,000 to our Meezan Bank account and put CRA-2611-0042 in the payment note");
    expect(text).toContain("09:40 PKT");
    expect(text).toContain(`${SITE}/reservation/CRA-2611-0042/pay?t=${TOKEN}`);
  });

  it("confirmed: the arrival day and check-in time, ID at check-in, the voucher link", async () => {
    const { text } = await render("confirmed");
    expect(text).toContain("Monday 2 November from [15:00]");
    expect(text).toContain("CNIC or passport");
    expect(text).toContain(`${SITE}/reservation/CRA-2611-0042/voucher?t=${TOKEN}`);
  });

  it("receipt rejected: the copy deck line with the owner's reason", async () => {
    const { text } = await render("receipt_rejected", { reason: "The amount does not match." });
    expect(text).toContain("We could not match this receipt to a transfer. The amount does not match.");
    expect(text).toContain("Upload a clearer copy, or send it on WhatsApp.");
  });

  it("hold ended: the copy deck line and a reserve-again link for the same apartment, dates and party", async () => {
    const { text } = await render("hold_ended", { slug: "three-bedroom" });
    expect(text).toContain("Your hold has ended. The dates may still be free; reserve again to hold them.");
    expect(text).toContain(`${SITE}/reserve/three-bedroom?arrive=2026-11-02&depart=2026-11-05&adults=2&children=4`);
  });

  it("cancelled: the reason when one is given", async () => {
    expect((await render("cancelled", { reason: "At the guest's request" })).text).toContain("Reason: At the guest's request");
    expect((await render("cancelled")).text).not.toContain("Reason:");
  });

  it("escapes the guest's own words in the HTML", async () => {
    const { html } = await render("owner_new_reservation", {}, { guest_name: '<script>alert("x")</script>' });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
