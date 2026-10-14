"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { RESERVE_STEPS, choicesFrom, stepHref, choicesQuery, type StepNumber } from "./shared";

// The reserve header (canvas Reserve1-4, ReserveMobile): midnight, the wordmark with "Reserve · {type name}", and the
// four steps with the current one underlined in gold. Earlier steps are links carrying the guest's choices; later
// steps are plain text. Below 1024px: a back link, "Step 1 of 4" and four gold segments.

function stepFromPath(pathname: string): StepNumber {
  if (pathname.endsWith("/amenities")) return 2;
  if (pathname.endsWith("/details")) return 3;
  if (pathname.endsWith("/review")) return 4;
  return 1;
}

const ON_DARK_2 = "var(--color-on-dark-2)";

function HeaderInner({ slug, typeName }: { slug: string; typeName: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = stepFromPath(pathname);
  const choices = choicesFrom(params);
  const backHref = current === 1 ? `/apartments/${slug}${choicesQuery({ ...choices, am: "" })}` : stepHref(slug, (current - 1) as StepNumber, choices);
  const backLabel = current === 1 ? "Back to the apartment" : `Back to ${RESERVE_STEPS[current - 2].label.toLowerCase()}`;

  return (
    <header className="on-midnight" style={{ borderBottom: "1px solid var(--hair-gold)" }}>
      {/* Desktop */}
      <div className="container-site flex items-center max-lg:hidden" style={{ minHeight: 76, gap: 24 }}>
        <div className="flex flex-col" style={{ gap: 2 }}>
          <Link href="/" className="no-underline" style={{ fontSize: 13, letterSpacing: ".22em", color: "var(--color-on-dark)" }}>
            CRYSTAL ROYAL APARTMENT
          </Link>
          <p className="m-0" style={{ fontSize: 12, letterSpacing: ".06em", color: ON_DARK_2 }}>
            Reserve · {typeName}
          </p>
        </div>
        <nav aria-label="Reservation steps" className="ml-auto">
          <ol
            className="m-0 flex list-none p-0"
            style={{ gap: 28, fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase" }}
          >
            {RESERVE_STEPS.map((s) => {
              const label = `${s.n} ${s.label}`;
              if (s.n === current) {
                return (
                  <li key={s.n} aria-current="step" className="flex items-center" style={{ minHeight: 44 }}>
                    <span style={{ color: "var(--color-on-dark)", borderBottom: "1px solid var(--color-gold)", paddingBottom: 4 }}>
                      {label}
                    </span>
                  </li>
                );
              }
              if (s.n < current) {
                return (
                  <li key={s.n} className="flex items-center">
                    <Link
                      href={stepHref(slug, s.n, choices)}
                      className="flex items-center no-underline hover:text-[var(--color-facet)]!"
                      style={{ minHeight: 44, color: ON_DARK_2, paddingBottom: 5 }}
                    >
                      {label}
                    </Link>
                  </li>
                );
              }
              return (
                <li key={s.n} className="flex items-center" style={{ minHeight: 44, color: ON_DARK_2, paddingBottom: 5 }}>
                  {label}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      {/* Mobile */}
      <div className="flex flex-col lg:hidden" style={{ padding: "14px 16px", gap: 10 }}>
        <div className="flex items-center justify-between" style={{ gap: 12 }}>
          <Link
            href={backHref}
            aria-label={backLabel}
            className="flex items-center justify-center no-underline"
            style={{ width: 44, height: 44, border: "1px solid var(--hair-gold-strong)", color: "var(--color-on-dark)", fontSize: 20 }}
          >
            <span aria-hidden="true">‹</span>
          </Link>
          <p className="eyebrow min-w-0 text-right" style={{ fontSize: 11, color: ON_DARK_2 }}>
            <span className="sr-only">Reserve · {typeName}. </span>
            Step {current} of 4<span className="sr-only">: {RESERVE_STEPS[current - 1].label}</span>
          </p>
        </div>
        <div aria-hidden="true" className="grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 4 }}>
          {RESERVE_STEPS.map((s) => (
            <span
              key={s.n}
              style={{ height: 2, background: s.n <= current ? "var(--color-gold)" : "rgba(197, 168, 128, 0.25)" }}
            />
          ))}
        </div>
      </div>
    </header>
  );
}

export function ReserveHeader(props: { slug: string; typeName: string }) {
  return (
    <Suspense
      fallback={
        <header className="on-midnight" style={{ minHeight: 76, borderBottom: "1px solid var(--hair-gold)" }}>
          <p className="container-site m-0 flex items-center" style={{ minHeight: 76, fontSize: 13, letterSpacing: ".22em" }}>
            CRYSTAL ROYAL APARTMENT
          </p>
        </header>
      }
    >
      <HeaderInner {...props} />
    </Suspense>
  );
}
