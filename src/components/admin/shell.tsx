"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import type { ComponentProps, ReactNode } from "react";
import { buttonClass, type ButtonVariant } from "./ui";

// The console frame from the canvas: charcoal sidebar ("CRYSTAL ROYAL · ADMIN", 44px links, the current page
// marked with a 2px gold rule and aria-current) beside the ivory work surface. Below 900px the sidebar becomes a
// top band whose links wrap, so nothing scrolls sideways at 320px. Client component only for the active link.

export const ADMIN_NAV: { href: string; label: string }[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/reservations", label: "Reservations" },
  { href: "/admin/reservations/new", label: "New reservation" },
  { href: "/admin/calendar", label: "Calendar and blocks" },
  { href: "/admin/settings", label: "Settings" },
];

function isCurrent(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin" || pathname === "/admin/";
  if (href === "/admin/reservations") return pathname.startsWith(href) && !pathname.startsWith("/admin/reservations/new");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ email, children }: { email: string; children: ReactNode }) {
  const pathname = usePathname() ?? "/admin";
  return (
    <div className="flex min-h-screen flex-col bg-ivory font-sans text-[14px] leading-[1.5] text-ink min-[900px]:flex-row">
      <div className="bg-midnight text-on-dark min-[900px]:w-[260px] min-[900px]:shrink-0">
        <div className="flex flex-col py-5 min-[900px]:sticky min-[900px]:top-0 min-[900px]:h-screen min-[900px]:overflow-y-auto min-[900px]:py-7">
          <Link
            href="/admin"
            className="self-start px-6 pb-3 text-[12px] tracking-[.22em] text-on-dark! no-underline min-[900px]:pb-6"
          >
            CRYSTAL ROYAL · ADMIN
          </Link>
          <nav aria-label="Admin" className="flex flex-row flex-wrap gap-0.5 px-2 min-[900px]:flex-col min-[900px]:px-0">
            {ADMIN_NAV.map((item) => {
              const current = isCurrent(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className={`flex min-h-[44px] items-center border-b-2 px-4 text-[14px] tracking-[.06em] no-underline transition-colors min-[900px]:border-b-0 min-[900px]:border-l-2 min-[900px]:px-6 ${
                    current ? "border-gold text-on-dark!" : "border-transparent text-on-dark-2! hover:text-on-dark!"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--hair-gold)] px-6 pt-4 text-[13px] text-on-dark-2 min-[900px]:mt-auto min-[900px]:flex-col min-[900px]:items-start">
            <p className="m-0 min-w-0 break-all">
              <span className="sr-only">Signed in as </span>
              {email}
            </p>
            <form action="/admin/logout" method="post">
              <button
                type="submit"
                className="inline-flex min-h-[44px] cursor-pointer items-center border border-[var(--hair-gold-strong)] bg-transparent px-4 font-sans text-[12px] font-medium uppercase tracking-[.14em] text-on-dark transition-colors hover:bg-gold hover:text-midnight"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
      <main id="main" className="min-w-0 flex-1 px-4 py-6 min-[900px]:px-12 min-[900px]:py-10">
        {children}
      </main>
    </div>
  );
}

/**
 * Submit button for server-action forms: disabled while the form is pending, with an optional pending label and
 * an optional confirmation question (for Cancel, Delete, Reject).
 */
export function SubmitButton({
  children,
  variant = "primary",
  pendingText,
  confirm,
  className = "",
  disabled,
  onClick,
  ...rest
}: Omit<ComponentProps<"button">, "type"> & { variant?: ButtonVariant; pendingText?: ReactNode; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={buttonClass(variant, className)}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      {...rest}
    >
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
