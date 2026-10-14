import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-auth";
import { listTypesWithUnits } from "@/lib/db/admin-queries";
import { getSettings, listAmenities } from "@/lib/db/queries";
import { todayInKarachi } from "@/lib/dates";
import { isReservable } from "@/lib/quote";
import { AdminPage, PageHeader, TextLink } from "@/components/admin/ui";
import { previewRates } from "@/components/admin/reservations/data";
import { NewReservationForm, type NewTypeOption } from "@/components/admin/reservations/new-reservation-form";
import { createPhoneReservation } from "./actions";

// New reservation (canvas "Manual reservation": "For phone or walk-in bookings. Priced by the same engine as online
// reservations."). One page for the reserve flow's steps; the server action prices and creates it with source 'admin'.

export const metadata: Metadata = { title: "New reservation" };

export default async function NewReservationPage() {
  await requireAdmin();
  const [types, settings, amenities, rates] = await Promise.all([listTypesWithUnits(), getSettings(), listAmenities(true), previewRates()]);

  const options: NewTypeOption[] = types
    .filter((t) => t.active)
    .map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      short_name: t.short_name,
      standard_guests: t.standard_guests,
      max_guests: t.max_guests,
      min_nights: t.min_nights,
      blocked: !isReservable(t)
        ? "Its standard and maximum guests are not set yet, so it cannot be priced. Set them in"
        : !t.units.some((u) => u.active)
          ? "It has no active unit. Activate one in"
          : !rates.some((r) => r.apartment_type_id === t.id)
            ? "It has no rate. Add one in"
            : null,
    }));

  return (
    <AdminPage gap={28}>
      <PageHeader eyebrow="Manual reservation" title="New reservation" />
      <p className="m-0 max-w-[640px] text-[15px] text-ink-2">
        For phone or walk-in bookings. Priced by the same engine as online reservations. The unit is assigned as it is
        online; you can move it afterwards from the reservation.{" "}
        <TextLink href="/admin/reservations">Back to reservations</TextLink>
      </p>
      <NewReservationForm
        types={options}
        rates={rates}
        settings={{
          tax_rate_percent: settings.tax_rate_percent,
          tax_label: settings.tax_label,
          deposit_policy: settings.deposit_policy,
          child_extra_policy: settings.child_extra_policy,
          child_extra_fee: settings.child_extra_fee,
          min_nights: settings.min_nights,
          max_nights: settings.max_nights,
          child_max_age: settings.child_max_age,
        }}
        amenities={amenities.map((a) => ({ id: a.id, name: a.name, pricing_type: a.pricing_type, price: a.price, max_quantity: a.max_quantity }))}
        today={todayInKarachi()}
        holdHours={settings.hold_hours}
        action={createPhoneReservation}
      />
    </AdminPage>
  );
}
