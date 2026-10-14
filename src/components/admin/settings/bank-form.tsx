"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { isPlaceholder } from "@/lib/site";
import { Ph, buttonClass } from "../ui";
import { SubmitButton } from "../shell";
import { FormField, FormNotice, FormResultProvider } from "./form-kit";
import { BANK_FORM_FIELDS, type BankField, type BankState } from "./bank-fields";

// "Review before saving" (brief) drawn as the canvas: the bronze fieldset with the six fields and "Save bank
// details"; submitting shows the midnight confirmation ("Confirm the bank details guests will pay into") with the
// stored and the new details side by side. "Yes, save these details" saves; "Go back" returns to the fields.
// While the confirmation is open the fields are read-only, so what is saved is exactly what was reviewed.

type Action = (prev: BankState, form: FormData) => Promise<BankState>;

export function BankForm({
  bankName,
  current,
  reviewAction,
  saveAction,
}: {
  bankName: string;
  current: Record<BankField, string>;
  reviewAction: Action;
  saveAction: Action;
}) {
  const [review, reviewDispatch] = useActionState(reviewAction, {} as BankState);
  const [save, saveDispatch] = useActionState(saveAction, {} as BankState);
  const [dismissed, setDismissed] = useState<number | undefined>(undefined);
  const headingRef = useRef<HTMLParagraphElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  const savedAfterReview = Boolean(save.ok) && (save.nonce ?? 0) > (review.nonce ?? 0);
  const reviewing = Boolean(review.review) && review.nonce !== dismissed && !savedAfterReview;

  useEffect(() => {
    if (reviewing) headingRef.current?.focus();
  }, [reviewing, review.nonce]);

  // After a save, the fields show the stored (normalised) details again.
  const fieldState: BankState = savedAfterReview ? {} : review;

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-4 border border-bronze p-4 min-[600px]:p-6">
      <legend className="eyebrow px-2 text-bronze">Meezan Bank details, shown to guests</legend>
      <p className="m-0 text-[14px] text-ink-2">
        Bank: <span className="text-ink">{bankName}</span>. Guests see these details only on their own payment page and in
        their emails.
      </p>
      {savedAfterReview ? (
        <FormResultProvider value={save}>
          <FormNotice />
        </FormResultProvider>
      ) : null}
      <FormResultProvider value={fieldState}>
        <form
          key={savedAfterReview ? `saved-${save.nonce}` : "edit"}
          action={reviewDispatch}
          noValidate
          className="flex flex-col gap-4"
          aria-describedby="bank-review-note"
        >
          {!reviewing ? <FormNotice /> : null}
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
            {BANK_FORM_FIELDS.map((f) => (
              <FormField
                key={f.key}
                label={f.label}
                name={f.key}
                id={`bank-${f.key}`}
                autoComplete="off"
                spellCheck={false}
                placeholder={f.placeholder}
                defaultValue={current[f.key]}
                placeholderValue={f.key === "raast_id" ? undefined : isPlaceholder(current[f.key])}
                readOnly={reviewing}
                inputClassName={`read-only:bg-ivory-2 ${f.key === "iban" || f.key === "account_number" || f.key === "swift" ? "num" : ""}`}
              />
            ))}
          </div>
          <p id="bank-review-note" className="m-0 text-[13px] text-ink-2">
            Review before saving: the next step shows the saved details beside the new ones.
          </p>
          {!reviewing ? (
            <div>
              <SubmitButton ref={saveButtonRef} pendingText="Checking">
                Save bank details
              </SubmitButton>
            </div>
          ) : null}
        </form>
      </FormResultProvider>

      {reviewing && review.review ? (
        <div
          role="alertdialog"
          aria-labelledby="bank-confirm-h"
          aria-describedby="bank-confirm-d"
          className="flex flex-col gap-3 bg-midnight p-5 text-on-dark"
        >
          <p id="bank-confirm-h" ref={headingRef} tabIndex={-1} className="m-0 font-medium">
            Confirm the bank details guests will pay into
          </p>
          <p id="bank-confirm-d" className="m-0 text-[14px] text-on-dark-2">
            Every new payment page will show these details. Check the IBAN against your Meezan Bank statement, digit by
            digit.
          </p>
          <div className="relative overflow-x-auto" role="region" aria-label="Saved and new bank details" tabIndex={0}>
            <table className="w-full border-collapse text-[14px]" style={{ minWidth: 520 }}>
              <caption className="sr-only">Saved and new bank details</caption>
              <thead>
                <tr>
                  {["Detail", "Saved now", "After saving"].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="border-b border-[var(--hair-gold-strong)] px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[.16em] text-on-dark-2"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {review.review.rows.map((r) => (
                  <tr key={r.key}>
                    <th scope="row" className="border-b border-[var(--hair-gold)] px-3 py-2.5 text-left align-top font-normal">
                      {r.label}
                      {r.changed ? (
                        <>
                          {" "}
                          <span className="eyebrow inline-block text-[10px] text-gold" style={{ marginLeft: 8 }}>
                            Changed
                          </span>
                        </>
                      ) : null}
                    </th>
                    <td className="num border-b border-[var(--hair-gold)] px-3 py-2.5 align-top break-all text-on-dark-2">
                      <Ph value={r.from} fallback="(empty)" />
                    </td>
                    <td className={`num border-b border-[var(--hair-gold)] px-3 py-2.5 align-top break-all ${r.changed ? "text-gold" : ""}`}>
                      <Ph value={r.to} fallback="(empty)" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <FormResultProvider value={save.ok || (save.nonce ?? 0) < (review.nonce ?? 0) ? {} : save}>
            <form action={saveDispatch} className="flex flex-col gap-3">
              {BANK_FORM_FIELDS.map((f) => (
                <input key={f.key} type="hidden" name={f.key} value={review.review!.values[f.key]} />
              ))}
              <input type="hidden" name="basis" value={review.review.basis} />
              <FormNotice />
              <div className="flex flex-wrap gap-2.5">
                <SubmitButton variant="gold" pendingText="Saving">
                  Yes, save these details
                </SubmitButton>
                <button
                  type="button"
                  className={buttonClass("secondary", "border-on-dark! text-on-dark! hover:bg-on-dark! hover:text-midnight!")}
                  onClick={() => {
                    setDismissed(review.nonce);
                    requestAnimationFrame(() => saveButtonRef.current?.focus());
                  }}
                >
                  Go back
                </button>
              </div>
            </form>
          </FormResultProvider>
        </div>
      ) : null}
    </fieldset>
  );
}
