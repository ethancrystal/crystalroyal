import { isPlaceholder } from "@/lib/site";
import type { Amenity, ApartmentType, Settings } from "@/lib/types";

// The values that still need the owner (canvas banner "11 values still need the owner."): every setting still
// [bracketed] or empty, every shown amenity without a price, and every apartment detail not yet confirmed.
// The optional Raast ID is not counted.

export interface PendingValue {
  label: string;
  href: string;
}

const PROPERTY: { key: keyof Settings; label: string }[] = [
  { key: "tax_rate_percent", label: "Tax rate" },
  { key: "tax_label", label: "Tax label" },
  { key: "confirm_within_hours", label: "Receipts confirmed within, hours" },
  { key: "free_cancellation_days", label: "Free cancellation, days before" },
  { key: "cancellation_text", label: "Cancellation wording" },
  { key: "child_max_age", label: "Child age" },
  { key: "whatsapp_number", label: "WhatsApp number" },
  { key: "phone_display", label: "Phone, as guests see it" },
  { key: "email", label: "Reservations email" },
  { key: "owner_notify_email", label: "Owner alerts email" },
  { key: "check_in", label: "Check-in time" },
  { key: "check_out", label: "Check-out time" },
];

const BANK: { key: keyof Settings; label: string }[] = [
  { key: "account_title", label: "Account title" },
  { key: "account_number", label: "Account number" },
  { key: "iban", label: "IBAN" },
  { key: "branch", label: "Branch name and code" },
  { key: "swift", label: "SWIFT" },
];

export function pendingOwnerValues(
  settings: Settings,
  amenities: Pick<Amenity, "name" | "price" | "active">[],
  types: Pick<ApartmentType, "short_name" | "standard_guests" | "max_guests" | "bathrooms" | "bed_configuration" | "active">[],
): PendingValue[] {
  const out: PendingValue[] = [];
  for (const f of PROPERTY) {
    if (isPlaceholder(settings[f.key] as string | number | null)) out.push({ label: f.label, href: "/admin/settings/property" });
  }
  if (settings.child_extra_policy === "reduced" && settings.child_extra_fee === null) {
    out.push({ label: "Reduced child rate", href: "/admin/settings/property" });
  }
  for (const f of BANK) {
    if (isPlaceholder(settings[f.key] as string)) out.push({ label: `Bank: ${f.label}`, href: "/admin/settings/bank" });
  }
  for (const a of amenities) {
    if (a.active && a.price === null) out.push({ label: `Price: ${a.name}`, href: "/admin/settings/amenities" });
  }
  for (const t of types) {
    if (!t.active) continue;
    if (t.standard_guests === null || t.max_guests === null) {
      out.push({ label: `${t.short_name}: standard and maximum guests`, href: "/admin/settings/rates" });
    }
    if (isPlaceholder(t.bathrooms)) out.push({ label: `${t.short_name}: bathrooms`, href: "/admin/settings/rates" });
    if (isPlaceholder(t.bed_configuration)) out.push({ label: `${t.short_name}: bed configuration`, href: "/admin/settings/rates" });
  }
  return out;
}
