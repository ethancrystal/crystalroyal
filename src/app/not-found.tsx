import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

// Any address that does not exist. No database read, so it renders even when the catalogue cannot be loaded.

export const metadata: Metadata = {
  title: "Page not found — Crystal Royal Apartment",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="on-ivory">
        <div className="container-site flex flex-col gap-6 py-28 max-[900px]:py-16">
          <p className="eyebrow" style={{ color: "var(--color-bronze)" }}>
            Page not found
          </p>
          <h1 className="display text-[64px] max-[900px]:text-[40px]" style={{ maxWidth: 760 }}>
            We could not find that page.
          </h1>
          <p className="m-0" style={{ maxWidth: 560, color: "var(--color-ink-2)" }}>
            The link may be incomplete or out of date. If you were looking for your reservation, use the link in your
            email.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/" className="btn-light">
              Return to the home page
            </Link>
            <Link href="/#apartments" className="text-bronze! underline underline-offset-[6px]">
              See the apartments
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
