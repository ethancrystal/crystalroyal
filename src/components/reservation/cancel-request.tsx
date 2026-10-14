"use client";

import { useActionState, useEffect, useRef } from "react";
import { PendingSubmit } from "@/components/reserve/pending-submit";
import { requestCancellation, type CancelResult } from "@/app/reservation/[reference]/actions";

// "Request cancellation" on the status page: a native disclosure holding a short form with a reason. Sending it
// records the request and tells the owner; the reservation itself does not change until the property acts.
// Works without JavaScript (server action form).

export function CancelRequest({
  reference,
  token,
  requestedOn,
  policy,
}: {
  reference: string;
  token: string;
  /** "Tue 3 Nov, 09:40 PKT" when the guest has already asked. */
  requestedOn: string | null;
  /** The cancellation policy line (may hold [placeholders]). */
  policy: React.ReactNode;
}) {
  const [state, action] = useActionState<CancelResult, FormData>(requestCancellation, { status: "idle" });
  const doneRef = useRef<HTMLParagraphElement>(null);
  const sent = state.status === "sent";

  useEffect(() => {
    if (sent) doneRef.current?.focus();
  }, [sent]);

  if (requestedOn || sent) {
    return (
      <section aria-labelledby="cancel-h" className="flex flex-col" style={{ gap: 8, borderTop: "1px solid var(--color-taupe)", paddingTop: 24 }}>
        <h2 id="cancel-h" className="eyebrow" style={{ color: "var(--color-bronze)" }}>
          Cancellation
        </h2>
        <p ref={doneRef} tabIndex={-1} role={sent ? "status" : undefined} className="m-0 outline-none" style={{ color: "var(--color-ink-2)", fontSize: 15 }}>
          {requestedOn ? `You asked to cancel on ${requestedOn}. ` : "Thank you. "}
          We have your request and will be in touch. Your reservation stays as it is until then.
        </p>
      </section>
    );
  }

  const reasonError = state.status === "error" && state.field === "reason" ? state.message : null;
  const formError = state.status === "error" && state.field !== "reason" ? state.message : null;

  return (
    <details
      className="group"
      style={{ borderTop: "1px solid var(--color-taupe)", paddingTop: 12 }}
      open={state.status === "error" ? true : undefined}
    >
      <summary
        className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 underline underline-offset-4 [&::-webkit-details-marker]:hidden"
        style={{ color: "var(--color-bronze)", fontSize: 15 }}
      >
        Request cancellation
      </summary>
      <form action={action} className="flex flex-col" style={{ gap: 14, marginTop: 12, maxWidth: 560 }} noValidate>
        <input type="hidden" name="reference" value={reference} />
        <input type="hidden" name="t" value={token} />
        <p className="m-0" style={{ fontSize: 15, color: "var(--color-ink-2)" }}>
          {policy}
        </p>
        <div>
          <label htmlFor="cancel-reason" className="lbl">
            Reason
          </label>
          <textarea
            id="cancel-reason"
            name="reason"
            className="inp"
            rows={3}
            maxLength={500}
            required
            aria-invalid={reasonError ? true : undefined}
            aria-describedby={reasonError ? "cancel-reason-err cancel-reason-hint" : "cancel-reason-hint"}
            style={{ minHeight: 104, ...(reasonError ? { borderColor: "var(--color-bad)" } : {}) }}
          />
          {reasonError ? (
            <p id="cancel-reason-err" className="err">
              {reasonError}
            </p>
          ) : null}
          <p id="cancel-reason-hint" className="m-0" style={{ marginTop: 6, fontSize: 14, color: "var(--color-ink-2)" }}>
            Your reservation stays as it is until we reply.
          </p>
        </div>
        {formError ? (
          <p role="alert" className="err m-0">
            {formError}
          </p>
        ) : null}
        <PendingSubmit className="btn-ghost-light" style={{ alignSelf: "flex-start" }}>
          Send the request
        </PendingSubmit>
      </form>
    </details>
  );
}
