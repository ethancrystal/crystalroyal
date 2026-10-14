import type { ReactNode } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/db/queries";
import { listAllAmenities, listTypesWithUnits } from "@/lib/db/admin-queries";
import { AdminPage, Notice, PageHeader } from "@/components/admin/ui";
import { SettingsTabs } from "@/components/admin/settings/tabs";
import { pendingOwnerValues } from "@/components/admin/settings/owner-values";

// Settings (canvas AdminSettings): the owner-values banner, the title and the six tabs from the brief. Each tab is
// its own route under /admin/settings/{amenities,rates,units,property,bank,emails}.

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  const [settings, amenities, types] = await Promise.all([getSettings(), listAllAmenities(), listTypesWithUnits()]);
  const pending = pendingOwnerValues(settings, amenities, types);
  const n = pending.length;

  return (
    <AdminPage gap={32}>
      {n > 0 ? (
        <Notice tone="wait" title={`${n} ${n === 1 ? "value still needs" : "values still need"} the owner.`}>
          Values in dashed red are placeholders. Online payment stays marked as not live until every bank field is set.
          <details className="mt-2">
            <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-[14px] text-bronze underline underline-offset-2">
              Show {n === 1 ? "it" : `all ${n}`}
            </summary>
            <ul className="m-0 mt-1 grid list-none gap-x-6 gap-y-1 p-0 text-[14px] [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
              {pending.map((p, i) => (
                <li key={`${p.label}-${i}`}>
                  <Link href={p.href} className="text-ink! underline-offset-2 hover:underline">
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </Notice>
      ) : null}
      <div className="flex flex-col gap-5">
        <PageHeader title="Settings" />
        <SettingsTabs />
      </div>
      {children}
    </AdminPage>
  );
}
