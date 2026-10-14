import "server-only";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/security";

// Shared guard for /api/cron/*. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set
// in the project's environment. Without a secret the routes refuse in production and run in development, so they
// can be exercised locally with a plain curl.

export const CRON_HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } as const;

/** Returns a 401 response when the request may not run the cron job, or null when it may. */
export function refuseUnlessCron(req: Request): Response | null {
  const secret = env.cronSecret;
  if (!secret) {
    if (!env.isProduction) return null;
    console.error("CRON_SECRET is not set in production; refusing the cron request.");
    return unauthorized();
  }
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  if (!match || !safeEqual(match[1], secret)) return unauthorized();
  return null;
}

function unauthorized(): Response {
  return Response.json({ error: "Unauthorized." }, { status: 401, headers: { ...CRON_HEADERS, "WWW-Authenticate": "Bearer" } });
}
