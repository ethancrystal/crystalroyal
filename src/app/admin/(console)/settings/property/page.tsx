import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/db/queries";
import { isPlaceholder } from "@/lib/site";
import { Section, labelClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/shell";
import { ActionForm, FormField } from "@/components/admin/settings/form-kit";
import { savePropertyAction } from "./actions";

// Property settings (canvas AdminSettings "Settings" grid, brief: check-in and check-out, hold hours, deposit
// policy, cancellation, tax rate and label, child policy and age, WhatsApp number, emails). Every field of
// updateProperty()'s whitelist. Stored [bracketed] values stay in the field, in dashed red, until replaced; an
// empty tax rate means tax is not configured and prices read "plus applicable taxes".

export const metadata: Metadata = { title: "Property settings" };

const GRID = "grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]";

function str(v: string | number | null): string {
  return v === null || v === undefined ? "" : String(v);
}

export default async function PropertySettingsPage() {
  await requireAdmin();
  const s = await getSettings();
  const ph = (v: string | number | null) => isPlaceholder(v);

  return (
    <Section id="property" title="Property" variant="display" gap={20}>
      <ActionForm action={savePropertyAction} className="flex flex-col gap-8">
        <div className={GRID}>
          <FormField
            label="Tax rate, percent"
            name="tax_rate_percent"
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            max={100}
            placeholder="[__]"
            defaultValue={str(s.tax_rate_percent)}
            placeholderValue={ph(s.tax_rate_percent)}
            hint="Leave empty until it is confirmed. Prices then read “plus applicable taxes” with no tax line."
          />
          <FormField
            label="Tax label"
            name="tax_label"
            defaultValue={s.tax_label}
            placeholderValue={ph(s.tax_label)}
            hint="The name of the tax line, for example Sindh Sales Tax."
          />
          <FormField
            label="Hold, hours"
            name="hold_hours"
            type="number"
            inputMode="numeric"
            min={1}
            max={168}
            defaultValue={s.hold_hours}
            hint="Reserved dates are held this long for the bank transfer."
          />
          <FormField
            as="select"
            label="Deposit policy"
            name="deposit_policy"
            defaultValue={s.deposit_policy}
            options={[
              { value: "full", label: "Full stay to confirm" },
              { value: "50", label: "50% to confirm, balance at check-in" },
            ]}
          />
          <FormField
            label="Free cancellation, days before"
            name="free_cancellation_days"
            type="number"
            inputMode="numeric"
            min={0}
            max={365}
            placeholder="[__]"
            defaultValue={str(s.free_cancellation_days)}
            placeholderValue={ph(s.free_cancellation_days)}
            hint="Days before arrival. 0 means non-refundable. Leave empty until it is confirmed."
          />
          <FormField
            as="select"
            label="Child as guest 7 or 8"
            name="child_extra_policy"
            defaultValue={s.child_extra_policy}
            options={[
              { value: "same_as_adult", label: "Same as adult" },
              { value: "reduced", label: "Reduced rate" },
              { value: "free", label: "Free" },
            ]}
            hint="How a child above the standard occupancy is charged."
          />
          <FormField
            label="WhatsApp number"
            name="whatsapp_number"
            inputMode="tel"
            autoComplete="off"
            defaultValue={s.whatsapp_number}
            placeholderValue={ph(s.whatsapp_number)}
            hint="Digits only, country code first, no plus."
          />
          <div role="group" aria-labelledby="times-label" aria-describedby="times-hint" className="min-w-0">
            <p id="times-label" className={labelClass}>
              Check-in / check-out
            </p>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Check-in from" labelHidden name="check_in" defaultValue={s.check_in} placeholderValue={ph(s.check_in)} />
              <FormField label="Check-out by" labelHidden name="check_out" defaultValue={s.check_out} placeholderValue={ph(s.check_out)} />
            </div>
            <p id="times-hint" className="m-0 mt-1.5 text-[13px] text-ink-2">
              Check-in from, check-out by; as HH:MM, Karachi time.
            </p>
          </div>
        </div>

        <div role="group" aria-labelledby="g-stays" className="flex flex-col gap-4">
          <h3 id="g-stays" className="eyebrow text-bronze">
            Stays and receipts
          </h3>
          <div className={GRID}>
            <FormField
              label="Shortest stay, nights"
              name="min_nights"
              type="number"
              inputMode="numeric"
              min={1}
              max={30}
              defaultValue={s.min_nights}
            />
            <FormField
              label="Longest stay, nights"
              name="max_nights"
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              defaultValue={s.max_nights}
            />
            <FormField
              label="Receipts confirmed within, hours"
              name="confirm_within_hours"
              defaultValue={s.confirm_within_hours}
              placeholderValue={ph(s.confirm_within_hours)}
              hint="The promise on the payment page: “usually within __ hours”."
            />
            <FormField
              label="Keep receipts, months"
              name="receipt_retention_months"
              type="number"
              inputMode="numeric"
              min={1}
              max={120}
              defaultValue={s.receipt_retention_months}
              hint="Receipts are deleted this many months after check-out."
            />
          </div>
          <FormField
            as="textarea"
            label="Cancellation wording"
            name="cancellation_text"
            rows={3}
            defaultValue={s.cancellation_text}
            placeholderValue={ph(s.cancellation_text)}
            hint="Shown at review and on the confirmation, as written."
          />
        </div>

        <div role="group" aria-labelledby="g-children" className="flex flex-col gap-4">
          <h3 id="g-children" className="eyebrow text-bronze">
            Children
          </h3>
          <div className={GRID}>
            <FormField
              label="Child age, up to"
              name="child_max_age"
              type="number"
              inputMode="numeric"
              min={0}
              max={17}
              placeholder="[12]"
              defaultValue={str(s.child_max_age)}
              placeholderValue={ph(s.child_max_age)}
              hint="A guest this age or younger counts as a child."
            />
            <FormField
              label="Reduced child rate, PKR per night"
              name="child_extra_fee"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="[PKR __]"
              defaultValue={str(s.child_extra_fee)}
              placeholderValue={s.child_extra_policy === "reduced" && s.child_extra_fee === null}
              hint="Used only when a child above the standard occupancy is charged a reduced rate."
            />
          </div>
        </div>

        <div role="group" aria-labelledby="g-contact" className="flex flex-col gap-4">
          <h3 id="g-contact" className="eyebrow text-bronze">
            Contact
          </h3>
          <div className={GRID}>
            <FormField
              label="Phone, as guests see it"
              name="phone_display"
              inputMode="tel"
              defaultValue={s.phone_display}
              placeholderValue={ph(s.phone_display)}
            />
            <FormField
              label="Reservations email"
              name="email"
              type="text"
              inputMode="email"
              autoComplete="off"
              defaultValue={s.email}
              placeholderValue={ph(s.email)}
              hint="Guests reply to this address."
            />
            <FormField
              label="Owner alerts email"
              name="owner_notify_email"
              type="text"
              inputMode="email"
              autoComplete="off"
              defaultValue={s.owner_notify_email}
              placeholderValue={ph(s.owner_notify_email)}
              hint="Receives new-reservation and receipt alerts."
            />
          </div>
        </div>

        <div>
          <SubmitButton pendingText="Saving">Save settings</SubmitButton>
        </div>
      </ActionForm>
    </Section>
  );
}
