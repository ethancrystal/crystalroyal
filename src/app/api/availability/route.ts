import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { nightsBetween } from "@/lib/dates";
import { getApartmentTypeBySlug } from "@/lib/db/queries";
import { nightStates } from "@/lib/db/availability-queries";
import { rateLimit } from "@/lib/protect";
import { isoDate } from "@/lib/validation";

// GET /api/availability?type=<slug>&from=YYYY-MM-DD&to=YYYY-MM-DD
// Per-night state of an apartment type for [from, to). No guest data. Cached for 60 seconds at the edge.

export const dynamic = "force-dynamic";

const MAX_WINDOW_DAYS = 120;

const query = z
  .object({
    type: z.string().regex(/^[a-z0-9-]{1,60}$/, "Unknown apartment."),
    from: isoDate,
    to: isoDate,
  })
  .refine((q) => q.to > q.from, { message: "The end of the window must be after its start.", path: ["to"] })
  .refine((q) => nightsBetween(q.from, q.to) <= MAX_WINDOW_DAYS, {
    message: `Ask for at most ${MAX_WINDOW_DAYS} nights at a time.`,
    path: ["to"],
  });

const noStore = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  if (!(await rateLimit("availability"))) {
    return new NextResponse("Too many requests. Please wait a minute and try again.", {
      status: 429,
      headers: { ...noStore, "Content-Type": "text/plain; charset=utf-8", "Retry-After": "60" },
    });
  }

  const sp = req.nextUrl.searchParams;
  const parsed = query.safeParse({ type: sp.get("type") ?? "", from: sp.get("from") ?? "", to: sp.get("to") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400, headers: noStore });
  }
  const { type: slug, from, to } = parsed.data;

  try {
    const type = await getApartmentTypeBySlug(slug);
    if (!type) return NextResponse.json({ error: "Unknown apartment." }, { status: 404, headers: noStore });
    const nights = await nightStates(type.id, from, to);
    return NextResponse.json(
      { nights: nights.map((n) => ({ date: n.date, state: n.state })) },
      { headers: { "Cache-Control": "public, s-maxage=60" } },
    );
  } catch (e) {
    console.error("availability lookup failed", e);
    return NextResponse.json({ error: "Availability could not be loaded." }, { status: 500, headers: noStore });
  }
}
