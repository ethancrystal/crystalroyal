import type { NextRequest } from "next/server";
import { SETTLED, guestReservation, tokenFrom } from "@/components/reservation/load";
import { partyLine, stayIcs } from "@/components/reservation/format";
import { getSettings, listApartmentTypes } from "@/lib/db/queries";
import { SITE, isPlaceholder } from "@/lib/site";

// "Add to calendar": the stay as an .ics file. Reference and token are checked like every reservation route; only
// a confirmed, checked-in or completed stay has an event. Times are the owner's check-in and check-out in
// Asia/Karachi; while either is a placeholder the event is all-day. The file carries no access token.

const HEADERS = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };

function notFound(): Response {
  return new Response("Not found", { status: 404, headers: { ...HEADERS, "Content-Type": "text/plain; charset=utf-8" } });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ reference: string }> }): Promise<Response> {
  const { reference } = await params;
  // zod checks of both parts of the link (reference pattern, 43-character base64url token) before any read.
  const r = await guestReservation(reference, tokenFrom({ t: req.nextUrl.searchParams.get("t") ?? undefined }));
  if (!r || !SETTLED.has(r.status)) return notFound();

  const [s, types] = await Promise.all([getSettings(), listApartmentTypes()]);
  const typeName = types.find((t) => t.id === r.apartment_type_id)?.name ?? "Apartment";
  const address = [SITE.addressLine, SITE.neighbourhood].filter((p) => !isPlaceholder(p));
  const description = [
    `Reservation ${r.reference}`,
    `${typeName}, ${partyLine(r.adults, r.children)}`,
    isPlaceholder(s.check_in) || isPlaceholder(s.check_out) ? null : `Check-in from ${s.check_in}, check-out by ${s.check_out} (Karachi time).`,
    SITE.idAtCheckIn,
    isPlaceholder(s.phone_display) ? null : `WhatsApp ${s.phone_display}`,
  ]
    .filter(Boolean)
    .join("\n");

  const body = stayIcs({
    reference: r.reference,
    typeName,
    checkIn: r.check_in,
    checkOut: r.check_out,
    checkInTime: s.check_in,
    checkOutTime: s.check_out,
    location: [...address, "Karachi, Pakistan"].join(", "),
    description,
  });
  return new Response(body, {
    status: 200,
    headers: {
      ...HEADERS,
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${r.reference}.ics"`,
    },
  });
}
