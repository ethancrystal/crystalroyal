import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/shell";

// The owner's console. Every page under this route group (URLs /admin/...) is behind requireAdmin(); each server
// action and route handler must call requireAdmin() again, since layouts do not guard actions.

export const metadata: Metadata = {
  title: { default: "Admin · Crystal Royal", template: "%s · Crystal Royal admin" },
  robots: { index: false, follow: false, nocache: true },
};
export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return <AdminShell email={admin.email}>{children}</AdminShell>;
}
