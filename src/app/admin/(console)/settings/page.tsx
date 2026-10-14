import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";

// /admin/settings opens on the property settings tab.
export default async function SettingsIndex() {
  await requireAdmin();
  redirect("/admin/settings/property");
}
