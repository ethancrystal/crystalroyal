import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

// An apartment slug that does not exist. No database read here, so this page renders even when the
// catalogue cannot be loaded.

export default function ApartmentNotFound() {
  return (
    <>
      <SiteHeader variant="crumb" crumb={{ label: "Home", current: "Apartments" }} />
      <main id="main" className="on-ivory">
        <div className="container-site flex flex-col gap-6 py-28 max-[900px]:py-16" style={{ maxWidth: 1280 }}>
          <p className="eyebrow" style={{ color: "var(--color-bronze)" }}>
            Apartments
          </p>
          <h1 className="display text-[64px] max-[900px]:text-[40px]">We could not find that apartment.</h1>
          <p className="m-0" style={{ maxWidth: 560, color: "var(--color-ink-2)" }}>
            The link may be incomplete. Both of our apartments are on the home page.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/apartments/three-bedroom" className="btn-light">
              Three-Bedroom Apartment
            </Link>
            <Link href="/apartments/two-bedroom" className="btn-ghost-light">
              Two-Bedroom Apartment
            </Link>
          </div>
          <Link href="/#apartments" className="self-start text-bronze! underline underline-offset-[6px]">
            Two ways to stay
          </Link>
        </div>
      </main>
    </>
  );
}
