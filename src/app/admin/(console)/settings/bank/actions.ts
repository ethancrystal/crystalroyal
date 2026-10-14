"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/db/queries";
import { bankInput, updateBank } from "@/lib/db/admin-queries";
import type { Settings } from "@/lib/types";
import { fieldsOf, invalid, refused, saved } from "@/components/admin/settings/action-helpers";
import { BANK_FORM_FIELDS, type BankField, type BankState } from "@/components/admin/settings/bank-fields";

// Bank details, in two steps ("Review before saving"):
//  1. reviewBankAction validates the typed details with zod and returns them beside the stored ones; nothing is saved.
//  2. saveBankAction re-validates the reviewed details and saves them with updateBank(), which logs
//     'bank_details_changed' with masked values. It refuses if the stored details changed after the review.

function pick(values: Record<string, string>): Record<BankField, string> {
  return Object.fromEntries(BANK_FORM_FIELDS.map((f) => [f.key, values[f.key] ?? ""])) as Record<BankField, string>;
}

/** Fingerprint of the stored details the owner reviewed against. */
function basisOf(s: Settings): string {
  return createHash("sha256")
    .update(JSON.stringify(BANK_FORM_FIELDS.map((f) => s[f.key])))
    .digest("hex");
}

export async function reviewBankAction(_prev: BankState, form: FormData): Promise<BankState> {
  await requireAdmin();
  const values = fieldsOf(form);
  const parsed = bankInput.safeParse(pick(values));
  if (!parsed.success) return invalid(parsed.error, values);
  const current = await getSettings();
  const next = pick(parsed.data as Record<string, string>);
  const rows = BANK_FORM_FIELDS.map((f) => ({
    key: f.key,
    label: f.label,
    from: String(current[f.key] ?? ""),
    to: next[f.key],
    changed: String(current[f.key] ?? "") !== next[f.key],
  }));
  if (!rows.some((r) => r.changed)) {
    return { error: "Nothing has changed. The bank details are as saved.", values, nonce: Date.now() };
  }
  return { review: { rows, values: next, basis: basisOf(current) }, values, nonce: Date.now() };
}

export async function saveBankAction(_prev: BankState, form: FormData): Promise<BankState> {
  const admin = await requireAdmin();
  const values = fieldsOf(form);
  const parsed = bankInput.safeParse(pick(values));
  if (!parsed.success) return invalid(parsed.error, values);
  const current = await getSettings();
  if (values.basis !== basisOf(current)) {
    return {
      error: "The bank details were changed by someone else while you were reviewing. Go back and review them again.",
      values,
      nonce: Date.now(),
    };
  }
  try {
    await updateBank(pick(values), admin);
  } catch (e) {
    return refused(e, values);
  }
  revalidatePath("/", "layout");
  return saved("Bank details updated. Every new payment page shows them from now on.");
}
