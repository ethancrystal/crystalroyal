"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { PROPERTY_FIELDS, propertyInput, updateProperty } from "@/lib/db/admin-queries";
import { fieldsOf, invalid, refused, saved } from "@/components/admin/settings/action-helpers";
import type { FormState } from "@/components/admin/settings/form-state";

// Property settings: requireAdmin(), zod (the exported propertyInput, on the whitelisted fields only), then
// updateProperty(), which validates again, logs old and new values to activity_log and returns the row.

export async function savePropertyAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = fieldsOf(form);
  const picked = Object.fromEntries(Object.entries(values).filter(([k]) => (PROPERTY_FIELDS as readonly string[]).includes(k)));
  const parsed = propertyInput.safeParse(picked);
  if (!parsed.success) return invalid(parsed.error, values);
  try {
    await updateProperty(picked, admin);
  } catch (e) {
    return refused(e, values);
  }
  // Tax, hold hours, times and contact details appear on the public site too.
  revalidatePath("/", "layout");
  return saved("Property settings updated. New reservations use them from now on.");
}
