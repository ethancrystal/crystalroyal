import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { env, hasSupabaseAuth } from "./env";
import { db } from "./db/sql";
import { safeEqual, signPayload, verifyPayload } from "./security";

// Admin authentication. Two modes:
//  - "supabase": Supabase Auth (email magic link) through @supabase/ssr cookies; the user must also be an active
//    row in `admins`. This is the only mode in production.
//  - "local" (development only): LOCAL_ADMIN_PASSWORD signs a 12-hour "cr_admin" cookie.
// The middleware only checks that some session cookie exists; getAdmin()/requireAdmin() are the real gate and
// run in the console layout and in every admin server action and route handler.

export interface Admin {
  /** Supabase user id, or "local:<email>" for the development session. Written to activity_log.actor_id. */
  userId: string;
  email: string;
}

export type AdminAuthMode = "supabase" | "local" | "none";

export const LOCAL_ADMIN_COOKIE = "cr_admin";
const LOCAL_SESSION_MS = 12 * 60 * 60 * 1000;

export function adminAuthMode(): AdminAuthMode {
  if (hasSupabaseAuth()) return "supabase";
  // In production without Supabase Auth, admin login is refused.
  if (!env.isProduction && env.localAdminPassword && env.draftSecret) return "local";
  return "none";
}

/** A key derived from the cookie secret so a reserve-draft cookie can never be replayed as an admin session. */
function localSecret(): string {
  if (!env.draftSecret) throw new Error("DRAFT_COOKIE_SECRET is not set.");
  return `${env.draftSecret}:cr_admin`;
}

/** Supabase server client bound to the request cookies (Server Components cannot set cookies; middleware refreshes). */
export async function supabaseServer() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) throw new Error("Supabase Auth is not configured.");
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: the middleware refreshes the session cookies instead.
        }
      },
    },
  });
}

async function supabaseAdmin(): Promise<Admin | null> {
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    const [row] = await db()<{ email: string }[]>`
      select email from admins where user_id = ${data.user.id} and active`;
    if (!row) return null;
    return { userId: data.user.id, email: data.user.email ?? row.email };
  } catch (e) {
    console.error("admin session check failed", e);
    return null;
  }
}

async function localAdmin(): Promise<Admin | null> {
  const store = await cookies();
  const p = verifyPayload<{ email?: unknown; exp?: unknown }>(store.get(LOCAL_ADMIN_COOKIE)?.value, localSecret());
  if (!p || typeof p.email !== "string" || typeof p.exp !== "number" || p.exp <= Date.now()) return null;
  return { userId: `local:${p.email}`, email: p.email };
}

/** The signed-in admin, or null. Memoised per request. */
export const getAdmin = cache(async (): Promise<Admin | null> => {
  const mode = adminAuthMode();
  if (mode === "supabase") return supabaseAdmin();
  if (mode === "local") return localAdmin();
  return null;
});

/** The signed-in admin, or a redirect to /admin/login. Call at the top of every admin page, action and handler. */
export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/** Development sign-in: true (and the cookie is set) only when the password matches LOCAL_ADMIN_PASSWORD. */
export async function startLocalSession(email: string, password: string): Promise<boolean> {
  if (adminAuthMode() !== "local" || !env.localAdminPassword) return false;
  if (!safeEqual(password, env.localAdminPassword)) return false;
  const exp = Date.now() + LOCAL_SESSION_MS;
  const store = await cookies();
  store.set(LOCAL_ADMIN_COOKIE, signPayload({ email, exp }, localSecret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/admin",
    maxAge: LOCAL_SESSION_MS / 1000,
  });
  return true;
}

/** Is this address an active admin? Used before sending a magic link (the answer is never shown). */
export async function isActiveAdminEmail(email: string): Promise<boolean> {
  const [row] = await db()<{ ok: boolean }[]>`
    select exists (select 1 from admins where lower(email) = lower(${email}) and active) as ok`;
  return Boolean(row?.ok);
}
