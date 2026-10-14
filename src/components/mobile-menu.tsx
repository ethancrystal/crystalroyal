"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { NAV_ITEMS } from "./nav-items";

/** Mobile menu: a real button with aria-expanded; closes on Escape and on link click; focus returns to the button. */
export function MobileMenu({ reserveHref }: { reserveHref: string }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    btn.current?.focus();
  };

  return (
    <div className="show-sm ml-auto">
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
        className="flex flex-col items-center justify-center gap-[5px]"
        style={{ width: 44, height: 44, background: "transparent", border: "1px solid var(--hair-gold-strong)", cursor: "pointer" }}
      >
        <span style={{ width: 18, height: 1, background: "var(--color-on-dark)" }} />
        <span style={{ width: 18, height: 1, background: "var(--color-on-dark)" }} />
      </button>
      {open ? (
        <nav
          id="mobile-nav"
          aria-label="Primary"
          className="on-midnight"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 84,
            zIndex: 40,
            borderBottom: "1px solid var(--hair-gold)",
            padding: "8px 16px 24px",
          }}
        >
          <ul className="m-0 list-none p-0">
            {NAV_ITEMS.map((n) => (
              <li key={n.href} style={{ borderBottom: "1px solid var(--hair-gold)" }}>
                <a href={n.href} onClick={close} className="block no-underline" style={{ padding: "14px 0", letterSpacing: ".14em", fontSize: 13, textTransform: "uppercase" }}>
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
          <Link href={reserveHref} onClick={close} className="btn-gold mt-5 w-full">
            Reserve your stay
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
