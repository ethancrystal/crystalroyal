"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { blockInput, createBlock, deleteBlock, listTypesWithUnits } from "@/lib/db/admin-queries";
import { nightsBetween } from "@/lib/dates";
import { BLOCK_REASON_LABEL, fmtStay } from "@/components/admin/ui";
import { fieldsOf, invalid, refused, saved } from "@/components/admin/settings/action-helpers";
import type { FormState } from "@/components/admin/settings/form-state";

// Calendar and blocks. createBlockAction blocks the nights [startsOn, endsOn) of a unit; createBlock() refuses
// nights held by a reservation or another block and logs the block. deleteBlockAction removes one. Both refresh the
// console and the public site (blocked nights read as unavailable there).

function refresh() {
  revalidatePath("/", "layout");
}

export async function createBlockAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = fieldsOf(form);
  const input = {
    unitId: values.unitId ?? "",
    startsOn: values.startsOn ?? "",
    endsOn: values.endsOn ?? "",
    reason: values.reason ?? "",
    note: values.note ?? "",
  };
  const parsed = blockInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, values);
  let block;
  try {
    block = await createBlock(input, admin);
  } catch (e) {
    return refused(e, values);
  }
  refresh();
  const unit = (await listTypesWithUnits()).flatMap((t) => t.units).find((u) => u.id === block.unit_id);
  const n = nightsBetween(block.starts_on, block.ends_on);
  return saved(
    `${n} ${n === 1 ? "night" : "nights"} blocked in ${unit?.name ?? "the unit"}: ${fmtStay(block.starts_on, block.ends_on)}, ${BLOCK_REASON_LABEL[block.reason].toLowerCase()}.`,
  );
}

const deleteInput = z.object({ blockId: z.string().uuid("That block no longer exists.") });

export async function deleteBlockAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = fieldsOf(form);
  const parsed = deleteInput.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);
  try {
    await deleteBlock(parsed.data.blockId, admin);
  } catch (e) {
    return refused(e, values);
  }
  refresh();
  return saved("Block removed. Those nights are free again unless a reservation holds them.");
}
