import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseAuth } from "@/lib/env";
import { LOCAL_ADMIN_COOKIE, supabaseServer } from "@/lib/admin-auth";

// POST /admin/logout: ends the Supabase session (when configured) and clears the development cookie.

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (hasSupabaseAuth()) {
    try {
      const supabase = await supabaseServer();
      await supabase.auth.signOut();
    } catch (e) {
      console.error("admin sign-out failed", e);
    }
  }
  const res = NextResponse.redirect(new URL("/admin/login", request.url), 303);
  res.cookies.set(LOCAL_ADMIN_COOKIE, "", { path: "/admin", maxAge: 0, httpOnly: true, sameSite: "lax" });
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "no-store");
  return res;
}
