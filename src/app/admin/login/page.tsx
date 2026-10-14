import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { adminAuthMode, getAdmin } from "@/lib/admin-auth";
import { Field, Notice } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/shell";
import { signIn } from "./actions";

export const metadata: Metadata = {
  title: "Sign in · Crystal Royal admin",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const PAGE_ERRORS: Record<string, string> = {
  rate: "Too many sign-in attempts from this connection. Please wait 15 minutes and try again.",
  link: "That sign-in link has expired or has already been used. Request a new one below.",
  unavailable: "Sign-in is not available on this server. Admin sign-in needs Supabase Auth to be configured.",
};

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await getAdmin()) redirect("/admin");
  const sp = await searchParams;
  const error = one(sp.error);
  const sent = one(sp.sent) === "1";
  const next = one(sp.next);
  const mode = adminAuthMode();
  const emailError = error === "email" ? "Enter a valid email address." : null;
  const passwordError = error === "invalid" ? "That email and password did not match. Please try again." : null;
  const pageError = error ? PAGE_ERRORS[error] : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-ivory font-sans text-[14px] leading-[1.5] text-ink min-[900px]:flex-row">
      <div className="bg-midnight px-6 py-5 text-on-dark min-[900px]:w-[260px] min-[900px]:shrink-0 min-[900px]:py-7">
        <p className="m-0 text-[12px] tracking-[.22em]">CRYSTAL ROYAL · ADMIN</p>
      </div>
      <main id="main" className="flex flex-1 items-start justify-center px-4 py-12 min-[900px]:items-center min-[900px]:px-12">
        <div className="flex w-full max-w-[420px] flex-col gap-6">
          <div>
            <p className="eyebrow text-bronze">Owner&rsquo;s console</p>
            <h1 className="display text-ink" style={{ fontSize: "clamp(36px, 8vw, 44px)" }}>
              Sign in
            </h1>
          </div>

          {sent ? <Notice tone="ok" title="Check your email for a sign-in link." /> : null}
          {pageError ? <Notice tone="bad" title={pageError} /> : null}

          {mode === "none" ? null : (
            <form action={signIn} className="flex flex-col gap-5" noValidate>
              {next ? <input type="hidden" name="next" value={next} /> : null}
              <p className="m-0 text-[15px] text-ink-2">
                {mode === "supabase"
                  ? "Enter your email address and we will send you a link to sign in."
                  : "Enter your email address and the development password."}
              </p>
              <Field
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                error={emailError}
              />
              {mode === "local" ? (
                <Field
                  label="Password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  error={passwordError}
                  hint="Development sign-in with LOCAL_ADMIN_PASSWORD. In production, admins sign in with an email link."
                />
              ) : null}
              <SubmitButton variant="primary" className="self-start" pendingText={mode === "supabase" ? "Sending" : "Signing in"}>
                {mode === "supabase" ? "Send sign-in link" : "Sign in"}
              </SubmitButton>
            </form>
          )}

          <p className="m-0 text-[13px] text-ink-2">
            <Link href="/" className="text-bronze! underline underline-offset-2 hover:text-ink!">
              Back to the website
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
