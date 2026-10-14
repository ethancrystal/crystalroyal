"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The settings tabs (brief: Amenities; Rates; Units; Property; Bank details; Email previews), drawn as the canvas
// segmented control: 44px charcoal-hairline tabs, the current one filled charcoal and marked aria-current. They wrap
// on narrow screens, so nothing scrolls sideways at 320px.

export const SETTINGS_TABS = [
  { href: "/admin/settings/amenities", label: "Amenities" },
  { href: "/admin/settings/rates", label: "Rates" },
  { href: "/admin/settings/units", label: "Units" },
  { href: "/admin/settings/property", label: "Property" },
  { href: "/admin/settings/bank", label: "Bank details" },
  { href: "/admin/settings/emails", label: "Email previews" },
] as const;

export function SettingsTabs() {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Settings sections">
      <ul className="m-0 flex list-none flex-wrap p-0 pl-px pt-px">
        {SETTINGS_TABS.map((t) => {
          const current = pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <li key={t.href} className="-ml-px -mt-px">
              <Link
                href={t.href}
                aria-current={current ? "page" : undefined}
                className={`inline-flex min-h-[44px] items-center border border-ink px-[18px] font-sans text-[13px] tracking-[.08em] no-underline transition-colors ${
                  current ? "bg-ink text-ivory!" : "bg-transparent text-ink! hover:bg-ivory-2"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
