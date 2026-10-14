import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/db/queries";
import { Section } from "@/components/admin/ui";
import { BankForm } from "@/components/admin/settings/bank-form";
import { BANK_FORM_FIELDS, type BankField } from "@/components/admin/settings/bank-fields";
import { reviewBankAction, saveBankAction } from "./actions";

// Bank details (canvas fieldset "Meezan Bank details, shown to guests"), with the brief's "Review before saving"
// step and a log entry for every change.

export const metadata: Metadata = { title: "Bank details" };

export default async function BankSettingsPage() {
  await requireAdmin();
  const s = await getSettings();
  const current = Object.fromEntries(BANK_FORM_FIELDS.map((f) => [f.key, String(s[f.key] ?? "")])) as Record<BankField, string>;
  return (
    <Section id="bank" title="Bank details" variant="display" gap={20}>
      <BankForm bankName={s.bank_name} current={current} reviewAction={reviewBankAction} saveAction={saveBankAction} />
    </Section>
  );
}
