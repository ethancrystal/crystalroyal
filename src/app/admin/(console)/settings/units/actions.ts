"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { saveUnit, setUnitActive, unitInput } from "@/lib/db/admin-queries";
import { fieldsOf, invalid, refused, saved } from "@/components/admin/settings/action-helpers";
import type { FormState } from "@/components/admin/settings/form-state";

// Units: add one to a type, rename or reorder one, activate or deactivate one. A unit with reservations that have
// not ended cannot be deactivated (setUnitActive names them). Guests never see units.

function refresh() {
  // Unit activity changes availability on the public site and the console calendar.
  revalidatePath("/", "layout");
}

export async function saveUnitAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = fieldsOf(form);
  const input = { id: values.id || null, typeId: values.typeId ?? "", name: values.name ?? "", sort: values.sort ?? "" };
  const parsed = unitInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, values);
  try {
    const unit = await saveUnit(input, admin);
    refresh();
    return saved(input.id ? `${unit.name} saved.` : `${unit.name} added. It can take reservations from now on.`);
  } catch (e) {
    return refused(e, values);
  }
}

const activeInput = z.object({ id: z.string().uuid("Unit not found."), active: z.enum(["true", "false"]) });

export async function setUnitActiveAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = fieldsOf(form);
  const parsed = activeInput.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);
  try {
    const unit = await setUnitActive(parsed.data.id, parsed.data.active === "true", admin);
    refresh();
    return saved(unit.active ? `${unit.name} is active and can take reservations.` : `${unit.name} is not active. It takes no new reservations.`);
  } catch (e) {
    return refused(e, values);
  }
}
