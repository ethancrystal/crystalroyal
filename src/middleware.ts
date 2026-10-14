import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Edge middleware for /admin. It only keeps people without any session cookie away from the console and,
// when Supabase Auth is configured, refreshes the Supabase session cookies. The real check (active row in
// `admins`, or a valid signed development session) is requireAdmin() in the console layout and every action.
// Edge-safe: no node:crypto, no database.

const ADMIN_COOKIE = "cr_admin";

function isOpenPath(pathname: string): boolean {
  return pathname === "/admin/login" || pathname.startsWith("/admin/auth/");
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (url && key) {
    // The standard @supabase/ssr updateSession pattern: refreshed tokens go to both the request and the response.
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    });
    try {
      await supabase.auth.getUser();
    } catch (e) {
      console.error("supabase session refresh failed", e);
    }
  }

  const { pathname, search } = request.nextUrl;
  if (!isOpenPath(pathname)) {
    const cookies = request.cookies.getAll();
    const hasSession = cookies.some((c) => (c.name.startsWith("sb-") || c.name === ADMIN_COOKIE) && c.value !== "");
    if (!hasSession) {
      const login = request.nextUrl.clone();
      login.pathname = "/admin/login";
      login.search = "";
      if (pathname !== "/admin" && request.method === "GET") login.searchParams.set("next", `${pathname}${search}`);
      const redirect = NextResponse.redirect(login);
      for (const c of response.cookies.getAll()) redirect.cookies.set(c);
      redirect.headers.set("X-Robots-Tag", "noindex, nofollow");
      return redirect;
    }
  }

  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
