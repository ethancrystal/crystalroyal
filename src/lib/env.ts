import "server-only";

// Server configuration. Every optional integration degrades to a safe local fallback when its keys are missing,
// so the site runs in development without third-party accounts. Production must set them all (see README).

function opt(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export const env = {
  siteUrl: (opt("SITE_URL") ?? "http://localhost:3000").replace(/\/$/, ""),
  databaseUrl: opt("DATABASE_URL"),
  supabaseUrl: opt("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: opt("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceKey: opt("SUPABASE_SERVICE_ROLE_KEY"),
  resendKey: opt("RESEND_API_KEY"),
  emailFrom: opt("EMAIL_FROM") ?? "Crystal Royal Apartment <onboarding@resend.dev>",
  turnstileSiteKey: opt("NEXT_PUBLIC_TURNSTILE_SITE_KEY"),
  turnstileSecret: opt("TURNSTILE_SECRET_KEY"),
  upstashUrl: opt("UPSTASH_REDIS_REST_URL"),
  upstashToken: opt("UPSTASH_REDIS_REST_TOKEN"),
  cronSecret: opt("CRON_SECRET"),
  draftSecret: opt("DRAFT_COOKIE_SECRET") ?? (process.env.NODE_ENV === "production" ? undefined : "dev-only-draft-secret-change-me"),
  localAdminPassword: opt("LOCAL_ADMIN_PASSWORD"),
  isProduction: process.env.NODE_ENV === "production",
};

/** Supabase Storage and Auth are used only when fully configured. */
export const hasSupabaseStorage = () => Boolean(env.supabaseUrl && env.supabaseServiceKey);
export const hasSupabaseAuth = () => Boolean(env.supabaseUrl && env.supabaseAnonKey);

export function requireDraftSecret(): string {
  if (!env.draftSecret) throw new Error("DRAFT_COOKIE_SECRET is not set.");
  return env.draftSecret;
}
