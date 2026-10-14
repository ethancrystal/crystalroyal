"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import {
  amenityInput,
  deleteAmenity,
  listAllAmenities,
  reorderAmenities,
  saveAmenity,
  setAmenityActive,
} from "@/lib/db/admin-queries";
import { fieldsOf, invalid, refused, saved } from "@/components/admin/settings/action-helpers";
import type { FormState } from "@/components/admin/settings/form-state";

// Amenities: create and edit (an empty price means "to be confirmed": requested, quoted separately, never added
// to a total), show or hide, reorder, and delete one no reservation has used. Each action: requireAdmin(), zod,
// the admin-queries mutation (which logs to activity_log), revalidatePath, and a result for the form.

const PATH = "/admin/settings/amenities";

function refresh() {
  // The amenity list and prices appear on the home page, apartment pages and the reserve flow.
  revalidatePath("/", "layout");
}

export async function saveAmenityAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = fieldsOf(form);
  const input = {
    id: values.id || null,
    name: values.name ?? "",
    description: values.description ?? "",
    pricing_type: values.pricing_type ?? "",
    price: values.price ?? "",
    max_quantity: values.max_quantity ?? "",
    // The edit form leaves visibility to Hide/Show; the add form sends the checkbox.
    ...(values.id ? {} : { active: values.active === "on" }),
  };
  const parsed = amenityInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, values);
  let name: string;
  try {
    ({ name } = await saveAmenity(input, admin));
  } catch (e) {
    return refused(e, values);
  }
  refresh();
  return saved(input.id ? `${name} updated.` : `${name} added at the end of the list.`);
}

const idInput = z.object({ id: z.string().uuid("Amenity not found.") });

export async function setAmenityShownAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = fieldsOf(form);
  const parsed = idInput.extend({ active: z.enum(["true", "false"]) }).safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);
  try {
    const row = await setAmenityActive(parsed.data.id, parsed.data.active === "true", admin);
    refresh();
    return saved(row.active ? `${row.name} is shown to guests.` : `${row.name} is hidden from guests.`);
  } catch (e) {
    return refused(e, values);
  }
}

export async function moveAmenityAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = fieldsOf(form);
  const parsed = idInput.extend({ direction: z.enum(["up", "down"]) }).safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);
  try {
    const list = await listAllAmenities();
    const i = list.findIndex((a) => a.id === parsed.data.id);
    if (i === -1) return { error: "That amenity no longer exists. Reload the page.", nonce: Date.now() };
    const j = parsed.data.direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= list.length) {
      return saved(`${list[i].name} is already ${parsed.data.direction === "up" ? "first" : "last"}.`);
    }
    const ids = list.map((a) => a.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await reorderAmenities(ids, admin);
    refresh();
    return saved(`${list[i].name} moved ${parsed.data.direction}, to position ${j + 1} of ${list.length}.`);
  } catch (e) {
    return refused(e, values);
  }
}

export async function deleteAmenityAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = fieldsOf(form);
  const parsed = idInput.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);
  try {
    await deleteAmenity(parsed.data.id, admin);
  } catch (e) {
    return refused(e, values);
  }
  refresh();
  redirect(`${PATH}?done=deleted`);
}
