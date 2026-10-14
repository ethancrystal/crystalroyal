"use client";

import Link from "next/link";
import { useEffect } from "react";
import { SiteHeader } from "@/components/site-header";

// The error boundary for guest pages. Concierge words, one thing to do next, and never a stack trace: the
// details go to the server log; the guest sees at most the short reference Next.js attaches.

export default function GuestError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <SiteHeader />
      <main id="main" className="on-ivory">
        <div className="container-site flex flex-col gap-6 py-28 max-[900px]:py-16">
          <p className="eyebrow" style={{ color: "var(--color-bronze)" }}>
            Something went wrong
          </p>
          <h1 className="display text-[64px] max-[900px]:text-[40px]" style={{ maxWidth: 760 }}>
            We could not open this page just now.
          </h1>
          <p className="m-0" style={{ maxWidth: 560, color: "var(--color-ink-2)" }}>
            Please try again in a moment. If it keeps happening, write to us and we will help.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <button type="button" onClick={reset} className="btn-light">
              Try again
            </button>
            <Link href="/" className="text-bronze! underline underline-offset-[6px]">
              Return to the home page
            </Link>
          </div>
          {error.digest ? (
            <p className="m-0" style={{ fontSize: 13, color: "var(--color-ink-2)" }}>
              Reference for the property: {error.digest}
            </p>
          ) : null}
        </div>
      </main>
    </>
  );
}
