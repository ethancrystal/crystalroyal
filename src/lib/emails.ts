import { formatDate, formatDateTimeKarachi } from "./dates";
import { formatPKR } from "./money";
import type { Reservation, Settings } from "./types";

// The nine emails from the copy deck. Text-first; the HTML is a minimal ivory layout with one charcoal button.
// Each carries the reference, the status link and the WhatsApp number.

export type EmailKind =
  | "reservation_received"
  | "hold_reminder"
  | "receipt_received"
  | "owner_receipt_uploaded"
  | "confirmed"
  | "receipt_rejected"
  | "hold_ended"
  | "cancelled"
  | "owner_new_reservation"
  | "owner_cancellation_requested";

export interface EmailContext {
  reservation: Reservation;
  settings: Settings;
  extra: Record<string, string>;
  siteUrl: string;
}

function stayRange(r: Reservation): string {
  const a = formatDate(r.check_in, { weekday: undefined, year: undefined, month: "long" });
  const b = formatDate(r.check_out, { weekday: undefined, year: undefined, month: "long" });
  const sameMonth = a.split(" ").slice(1).join(" ") === b.split(" ").slice(1).join(" ");
  return `${sameMonth ? a.split(" ")[0] : a} to ${b}`;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(paragraphs: string[], button: { label: string; href: string } | null, footer: string): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  const btn = button
    ? `<p style="margin:24px 0"><a href="${esc(button.href)}" style="display:inline-block;background:#2C2C2C;color:#F4F1EA;padding:14px 24px;text-decoration:none;font-family:Jost,Arial,sans-serif;font-size:13px;letter-spacing:.14em;text-transform:uppercase">${esc(button.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#F4F1EA"><div style="max-width:600px;margin:0 auto;padding:40px 28px;font-family:Jost,Arial,sans-serif;font-size:16px;line-height:1.6;color:#2C2C2C">
<p style="margin:0 0 28px;font-size:12px;letter-spacing:.22em;color:#7A5F3B">CRYSTAL ROYAL APARTMENT</p>${body}${btn}
<p style="margin:32px 0 0;padding-top:16px;border-top:1px solid #D9D4C7;font-size:13px;color:#595959">${esc(footer).replace(/\n/g, "<br>")}</p></div></body></html>`;
}

export async function renderEmail(
  kind: EmailKind,
  ctx: EmailContext,
): Promise<{ subject: string; text: string; html: string }> {
  const { reservation: r, settings: s, extra, siteUrl } = ctx;
  const statusUrl = `${siteUrl}/reservation/${r.reference}?t=${r.access_token}`;
  const payUrl = `${siteUrl}/reservation/${r.reference}/pay?t=${r.access_token}`;
  const adminUrl = `${siteUrl}/admin/reservations/${r.id}`;
  const hold = r.hold_expires_at ? formatDateTimeKarachi(r.hold_expires_at).replace(" Karachi time", " PKT") : "";
  const amount = formatPKR(r.amount_due);
  const footer = `Reservation ${r.reference}\nYour reservation page: ${statusUrl}\nWhatsApp ${s.phone_display}`;
  const ownerFooter = `Reservation ${r.reference}\nAdmin: ${adminUrl}`;

  let subject = "";
  let lines: string[] = [];
  let button: { label: string; href: string } | null = { label: "Your reservation", href: statusUrl };
  let foot = footer;

  switch (kind) {
    case "reservation_received":
      subject = `Your reservation ${r.reference} — payment instructions`;
      lines = [
        `Dear ${r.guest_name},`,
        `Thank you. Your dates are held: ${stayRange(r)}, ${r.adults} adults and ${r.children} children.`,
        `To confirm, transfer ${amount} to our Meezan Bank account and put ${r.reference} in the payment note. The account details are on your payment page.`,
        `Your dates are held until ${hold}.`,
      ];
      button = { label: "Settle by transfer", href: payUrl };
      break;
    case "hold_reminder":
      subject = `Your dates are held until ${hold}`;
      lines = [
        `Dear ${r.guest_name},`,
        `A gentle note: your dates for ${stayRange(r)} are held until ${hold}. If you have already made the transfer, upload the receipt or send it on WhatsApp and we will confirm.`,
      ];
      button = { label: "Upload your receipt", href: payUrl };
      break;
    case "receipt_received":
      subject = "We have your receipt";
      lines = [
        `Dear ${r.guest_name},`,
        `We have your transfer receipt for ${r.reference}. We confirm once the transfer arrives, usually within ${s.confirm_within_hours} hours.`,
      ];
      break;
    case "owner_receipt_uploaded":
      subject = `Receipt uploaded: ${r.reference}, ${amount}`;
      lines = [`${r.guest_name} uploaded a transfer receipt for ${r.reference} (${stayRange(r)}).`, `Amount due: ${amount}.`];
      button = { label: "Verify the receipt", href: adminUrl };
      foot = ownerFooter;
      break;
    case "confirmed":
      subject = `Your stay is confirmed — ${stayRange(r)}`;
      lines = [
        `Dear ${r.guest_name},`,
        `Your stay is confirmed. We look forward to welcoming you on ${formatDate(r.check_in, { year: undefined, month: "long", weekday: "long" })} from ${s.check_in}.`,
        "Please bring a valid CNIC or passport for each adult; it is shown at check-in and never collected online.",
        "Your voucher and directions are on your reservation page.",
      ];
      button = { label: "Your voucher", href: `${siteUrl}/reservation/${r.reference}/voucher?t=${r.access_token}` };
      break;
    case "receipt_rejected":
      subject = `Receipt not matched — ${r.reference}`;
      lines = [
        `Dear ${r.guest_name},`,
        `We could not match this receipt to a transfer. ${extra.reason ?? ""}`.trim(),
        `Upload a clearer copy, or send it on WhatsApp. Your dates are held until ${hold}.`,
      ];
      button = { label: "Upload again", href: payUrl };
      break;
    case "hold_ended":
      subject = `Your hold on ${stayRange(r)} has ended`;
      lines = [
        `Dear ${r.guest_name},`,
        "Your hold has ended. The dates may still be free; reserve again to hold them.",
      ];
      button = { label: "Reserve again", href: `${siteUrl}/reserve/${extra.slug ?? "three-bedroom"}?arrive=${r.check_in}&depart=${r.check_out}&adults=${r.adults}&children=${r.children}` };
      break;
    case "cancelled":
      subject = `Reservation ${r.reference} cancelled`;
      lines = [`Dear ${r.guest_name},`, `Reservation ${r.reference} for ${stayRange(r)} has been cancelled.`, extra.reason ? `Reason: ${extra.reason}` : ""].filter(Boolean);
      break;
    case "owner_new_reservation":
      subject = `New reservation: ${r.reference}`;
      lines = [`${r.guest_name}, ${r.guest_phone}`, `${stayRange(r)} · ${r.adults} adults, ${r.children} children · ${amount} due.`, `Held until ${hold}.`];
      button = { label: "Open the reservation", href: adminUrl };
      foot = ownerFooter;
      break;
    case "owner_cancellation_requested":
      subject = `Cancellation requested: ${r.reference}`;
      lines = [`${r.guest_name} asked to cancel ${r.reference} (${stayRange(r)}).`, extra.reason ? `Reason given: ${extra.reason}` : ""].filter(Boolean);
      button = { label: "Open the reservation", href: adminUrl };
      foot = ownerFooter;
      break;
  }

  const text = [...lines, button ? `${button.label}: ${button.href}` : "", "", foot].filter((l) => l !== undefined).join("\n\n");
  return { subject, text, html: layout(lines, button, foot) };
}
