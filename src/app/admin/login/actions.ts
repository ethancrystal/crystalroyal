"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/protect";
import { adminAuthMode, isActiveAdminEmail, startLocalSession, supabaseServer } from "@/lib/admin-auth";

// Admin sign-in. Errors stay generic: the response never says whether an address belongs to an admin.
// Outcomes travel back to /admin/login as ?sent=1 or ?error=<code>, so the form works without JavaScript.

const emailSchema = z.string().trim().toLowerCase().email().max(200);
const passwordSchema = z.string().min(1).max(200);

/** Only console paths are accepted as a post-login destination (no open redirects). */
const nextSchema = z
  .string()
  .max(300)
  .regex(/^\/admin(?:\/[A-Za-z0-9\-_/.]*)?(?:\?[A-Za-z0-9\-_=&%.]*)?$/)
  .refine((p) => !p.includes("//") && !/^\/admin\/(login|auth|logout)/.test(p));

function loginUrl(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `/admin/login?${s}` : "/admin/login";
}

export async function signIn(form: FormData): Promise<void> {
  const next = nextSchema.safeParse(form.get("next"));
  const nextPath = next.success ? next.data : undefined;
  const mode = adminAuthMode();
  if (mode === "none") redirect(loginUrl({ error: "unavailable" }));
  if (!(await rateLimit("adminLogin"))) redirect(loginUrl({ error: "rate", next: nextPath }));

  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) redirect(loginUrl({ error: "email", next: nextPath }));

  if (mode === "supabase") {
    try {
      // Links go only to active admins; everyone else sees the same message and nothing is sent.
      if (await isActiveAdminEmail(email.data)) {
        const supabase = await supabaseServer();
        const { error } = await supabase.auth.signInWithOtp({
          email: email.data,
          options: { emailRedirectTo: `${env.siteUrl}/admin/auth/callback`, shouldCreateUser: false },
        });
        if (error) console.error("admin magic link failed:", error.message);
      }
    } catch (e) {
      console.error("admin magic link failed", e);
    }
    redirect(loginUrl({ sent: "1" }));
  }

  // Development: LOCAL_ADMIN_PASSWORD, compared in constant time.
  const password = passwordSchema.safeParse(form.get("password"));
  const ok = password.success && (await startLocalSession(email.data, password.data));
  if (!ok) redirect(loginUrl({ error: "invalid", next: nextPath }));
  redirect(nextPath ?? "/admin");
}
