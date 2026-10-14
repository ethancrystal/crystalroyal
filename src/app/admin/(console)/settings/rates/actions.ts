"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { addRate, listTypesWithUnits, rateInput, TYPE_FIELDS, typeInput, updateType } from "@/lib/db/admin-queries";
import { formatDate, todayInKarachi } from "@/lib/dates";
import { formatPKR } from "@/lib/money";
import { isReservable } from "@/lib/quote";
import { fieldsOf, invalid, refused, saved } from "@/components/admin/settings/action-helpers";
import type { FormState } from "@/components/admin/settings/form-state";

// Rates and occupancy per apartment type. addRateAction schedules a rate from a date (today or later; stays are
// priced at the rate in force on their arrival date). saveOccupancyAction sets standard/maximum guests and the
// type's details through updateType(); setting both guests is what makes a type reservable online.

function refresh() {
  revalidatePath("/", "layout");
}

export async function addRateAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = fieldsOf(form);
  const parsed = rateInput.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);
  let rate;
  try {
    rate = await addRate(parsed.data, admin);
  } catch (e) {
    return refused(e, values);
  }
  refresh();
  const when = rate.effective_from === todayInKarachi() ? "from today" : `from ${formatDate(rate.effective_from).replace(",", "")}`;
  const extra = rate.extra_adult_per_night === null ? "no extra-guest charge" : `${formatPKR(rate.extra_adult_per_night)} per additional adult`;
  return saved(`${formatPKR(rate.nightly_rate)} per night, ${extra}, ${when}. Reservations already made keep their price.`);
}

const typeId = z.object({ typeId: z.string().uuid("Apartment type not found.") });
const OCCUPANCY_FIELDS = ["standard_guests", "max_guests", "min_nights", "bathrooms", "bed_configuration", "size_sqft"] as const;

export async function saveOccupancyAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = fieldsOf(form);
  const id = typeId.safeParse(values);
  if (!id.success) return invalid(id.error, values);
  const picked = Object.fromEntries(
    OCCUPANCY_FIELDS.filter((k) => (TYPE_FIELDS as readonly string[]).includes(k)).map((k) => [k, values[k] ?? ""]),
  );
  const parsed = typeInput.safeParse(picked);
  if (!parsed.success) return invalid(parsed.error, values);
  const before = (await listTypesWithUnits()).find((t) => t.id === id.data.typeId);
  if (!before) return { error: "Apartment type not found.", values, nonce: Date.now() };
  let after;
  try {
    after = await updateType(id.data.typeId, picked, admin);
  } catch (e) {
    return refused(e, values);
  }
  refresh();
  const was = isReservable(before);
  const now = isReservable(after);
  if (now && !was) return saved(`The ${after.short_name} can now be reserved online.`);
  if (!now && was) {
    return saved(`The ${after.short_name} is no longer reservable online. Guests are asked to confirm occupancy directly with the property.`);
  }
  if (!now) return saved("Details updated. Online reservations stay closed until the standard and maximum guests are set.");
  return saved("Occupancy and details updated.");
}
