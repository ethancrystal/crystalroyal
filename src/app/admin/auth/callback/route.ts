import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hasSupabaseAuth } from "@/lib/env";
import { supabaseServer } from "@/lib/admin-auth";

// Magic-link landing. Exchanges the PKCE code (or verifies a token_hash link) for a Supabase session cookie,
// then sends the user to /admin, where requireAdmin() decides access. Never reveals why a link failed.

export const dynamic = "force-dynamic";

const params = z.union([
  z.object({ code: z.string().min(10).max(500) }),
  z.object({ token_hash: z.string().min(10).max(500), type: z.enum(["magiclink", "email"]) }),
]);

export async function GET(request: NextRequest) {
  const failed = NextResponse.redirect(new URL("/admin/login?error=link", request.url), 303);
  failed.headers.set("X-Robots-Tag", "noindex, nofollow");
  if (!hasSupabaseAuth()) return failed;

  const parsed = params.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return failed;

  try {
    const supabase = await supabaseServer();
    const { error } =
      "code" in parsed.data
        ? await supabase.auth.exchangeCodeForSession(parsed.data.code)
        : await supabase.auth.verifyOtp({ token_hash: parsed.data.token_hash, type: parsed.data.type });
    if (error) {
      console.error("admin sign-in link failed:", error.message);
      return failed;
    }
  } catch (e) {
    console.error("admin sign-in link failed", e);
    return failed;
  }

  const ok = NextResponse.redirect(new URL("/admin", request.url), 303);
  ok.headers.set("X-Robots-Tag", "noindex, nofollow");
  ok.headers.set("Cache-Control", "no-store");
  return ok;
}
