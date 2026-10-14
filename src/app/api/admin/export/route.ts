import { NextResponse, type NextRequest } from "next/server";
import { getAdmin } from "@/lib/admin-auth";
import { parseReservationFilter, reservationsCsv } from "@/lib/db/admin-queries";
import { todayInKarachi } from "@/lib/dates";

// GET /api/admin/export?q=&status=&type=&unit=&from=&to= : the reservations matching the list's current filter as
// CSV (RFC 4180, CRLF, cells guarded against spreadsheet formulas by reservationsCsv()). Signed-in admins only.
// The filter is parsed with zod by parseReservationFilter(): unknown or malformed values are dropped.

export const dynamic = "force-dynamic";

const PRIVATE = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

export async function GET(req: NextRequest) {
  const admin = await getAdmin();
  if (!admin) {
    return new NextResponse("Sign in to the console to export reservations.", {
      status: 401,
      headers: { ...PRIVATE, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const filter = parseReservationFilter(req.nextUrl.searchParams);
  let csv: string;
  try {
    csv = await reservationsCsv(filter);
  } catch (e) {
    console.error("reservations export failed", e);
    return new NextResponse("The export could not be prepared just now. Try again.", {
      status: 500,
      headers: { ...PRIVATE, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  // A byte-order mark so Excel opens the UTF-8 file with names intact.
  return new NextResponse(`﻿${csv}`, {
    status: 200,
    headers: {
      ...PRIVATE,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reservations-${todayInKarachi()}.csv"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
