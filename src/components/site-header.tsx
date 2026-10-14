import Link from "next/link";
import { Mark } from "./brand";
import { MobileMenu } from "./mobile-menu";
import { NAV_ITEMS as NAV } from "./nav-items";

// Midnight masthead from the canvas: mark + wordmark left, primary nav, "Reserve your stay".
// `variant="crumb"` is the apartment-page header with a breadcrumb instead of the nav.

export function SiteHeader({
  variant = "nav",
  crumb,
  reserveHref = "/reserve/three-bedroom",
}: {
  variant?: "nav" | "crumb" | "minimal";
  crumb?: { label: string; current: string };
  reserveHref?: string;
}) {
  return (
    <header className="on-midnight" style={{ borderBottom: "1px solid var(--hair-gold)" }}>
      <div className="container-site flex items-center gap-8" style={{ height: 84 }}>
        <Link href="/" className="flex items-center gap-3.5 no-underline" aria-label="Crystal Royal Apartment, home">
          <Mark size={40} />
          <span className="hidden sm:inline" style={{ fontSize: 13, letterSpacing: ".22em" }}>
            CRYSTAL ROYAL APARTMENT
          </span>
          <span className="sm:hidden" style={{ fontSize: 11, letterSpacing: ".2em" }}>
            CRYSTAL ROYAL APARTMENT
          </span>
        </Link>
        {variant === "nav" ? (
          <>
            <nav
              aria-label="Primary"
              className="hide-sm ml-auto flex gap-8"
              style={{ fontSize: 13, letterSpacing: ".14em", textTransform: "uppercase" }}
            >
              {NAV.map((n) => (
                <a key={n.href} href={n.href} className="inline-flex min-h-[44px] items-center no-underline hover:text-[var(--color-facet)]">
                  {n.label}
                </a>
              ))}
            </nav>
            <Link href={reserveHref} className="btn-dark hide-sm" style={{ minHeight: 44, padding: "0 22px", fontSize: 12 }}>
              Reserve your stay
            </Link>
            <MobileMenu reserveHref={reserveHref} />
          </>
        ) : null}
        {variant === "crumb" && crumb ? (
          <nav aria-label="Breadcrumb" className="ml-auto" style={{ fontSize: 13, color: "var(--color-on-dark-2)" }}>
            <Link href="/" className="inline-flex min-h-[44px] items-center" style={{ color: "var(--color-on-dark-2)" }}>
              {crumb.label}
            </Link>{" "}
            · <span aria-current="page">{crumb.current}</span>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
