"use client";

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { SubmitButton } from "@/components/admin/shell";
import { Button, Field, PAYMENT_METHOD_LABEL } from "@/components/admin/ui";
import { EMPTY_STATE, type ActionState, type ConsoleAction } from "./shared";

// The detail page's action forms. Each posts to a server action that calls requireAdmin(), validates with zod and
// runs the admin-queries mutation; on success it redirects back with a "Saved." notice, on a refusal it returns
// the message shown here (role="alert", linked to the fields it concerns). Inputs are controlled so a refusal never
// wipes what the owner typed. The page remounts these forms (key) after every successful action.

/** A refusal from a button-only action; focused when it appears, since the pending button gave up focus. */
export function ActionError({ state, id }: { state: ActionState; id?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.error) ref.current?.focus();
  }, [state]);
  if (!state.error) return null;
  return (
    <p ref={ref} id={id} role="alert" tabIndex={-1} className="err m-0 outline-none">
      {state.error}
    </p>
  );
}

/** Moves focus to the notice that arrives with the page after an action redirected back here. */
export function FocusOnMount({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div ref={ref} tabIndex={-1} className="outline-none">
      {children}
    </div>
  );
}

type Panel = "reject" | "record" | "cancel" | null;

export interface ActionAvailability {
  /** "Verify and confirm" (a receipt is waiting and the stay can be confirmed) or "Verify receipt" (already confirmed) */
  verify: "confirm" | "receipt" | null;
  reject: boolean;
  record: boolean;
  /** recording a payment confirms the stay (reserved / payment_submitted) */
  recordConfirms: boolean;
  cancel: boolean;
  checkIn: boolean;
  checkOut: boolean;
}

export function ReservationActions({
  reservationId,
  paymentId,
  can,
  recordDefault,
  rejectNote,
  cancelNote,
  hasEmail,
  checkInConfirm,
  actions,
}: {
  reservationId: string;
  /** the receipt awaiting verification (oldest first), if any */
  paymentId: string | null;
  can: ActionAvailability;
  /** amount prefilled in "Record payment" (the balance) */
  recordDefault: number;
  /** what rejecting does to the hold, in words */
  rejectNote: string;
  cancelNote: string;
  /** the reservation has a guest email address (changes what "Record payment" says) */
  hasEmail: boolean;
  /** a question to confirm before checking in (the stay starts on a later day), or null */
  checkInConfirm: string | null;
  actions: {
    verify: ConsoleAction;
    reject: ConsoleAction;
    record: ConsoleAction;
    cancel: ConsoleAction;
    checkIn: ConsoleAction;
    checkOut: ConsoleAction;
  };
}) {
  const [open, setOpen] = useState<Panel>(null);
  const [verifyState, verifyAction] = useActionState(actions.verify, EMPTY_STATE);
  const [checkInState, checkInAction] = useActionState(actions.checkIn, EMPTY_STATE);
  const [checkOutState, checkOutAction] = useActionState(actions.checkOut, EMPTY_STATE);
  const base = useId();
  const panelId = (p: Exclude<Panel, null>) => `${base}-${p}`;
  const toggle = (p: Exclude<Panel, null>) => setOpen((cur) => (cur === p ? null : p));

  const nothing = !can.verify && !can.reject && !can.record && !can.cancel && !can.checkIn && !can.checkOut;
  if (nothing) {
    return <p className="m-0 text-[15px] text-ink-2">No actions apply to a reservation in this state.</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-2.5">
        {can.verify && paymentId ? (
          <form action={verifyAction} className="contents">
            <input type="hidden" name="reservationId" value={reservationId} />
            <input type="hidden" name="paymentId" value={paymentId} />
            <SubmitButton variant="confirm" pendingText="Verifying…">
              {can.verify === "confirm" ? "Verify and confirm" : "Verify receipt"}
            </SubmitButton>
          </form>
        ) : null}
        {can.reject && paymentId ? (
          <ToggleButton expanded={open === "reject"} controls={panelId("reject")} onClick={() => toggle("reject")}>
            Reject receipt
          </ToggleButton>
        ) : null}
        {can.record ? (
          <ToggleButton expanded={open === "record"} controls={panelId("record")} onClick={() => toggle("record")}>
            Record payment
          </ToggleButton>
        ) : null}
        {can.checkIn ? (
          <form action={checkInAction} className="contents">
            <input type="hidden" name="reservationId" value={reservationId} />
            <SubmitButton variant="secondary" pendingText="Checking in…" confirm={checkInConfirm ?? undefined}>
              Check in
            </SubmitButton>
          </form>
        ) : null}
        {can.checkOut ? (
          <form action={checkOutAction} className="contents">
            <input type="hidden" name="reservationId" value={reservationId} />
            <SubmitButton variant="secondary" pendingText="Checking out…">
              Check out
            </SubmitButton>
          </form>
        ) : null}
        {can.cancel ? (
          <ToggleButton danger expanded={open === "cancel"} controls={panelId("cancel")} onClick={() => toggle("cancel")}>
            Cancel
          </ToggleButton>
        ) : null}
      </div>
      <ActionError state={verifyState} />
      <ActionError state={checkInState} />
      <ActionError state={checkOutState} />

      {open === "reject" && paymentId ? (
        <RejectPanel id={panelId("reject")} reservationId={reservationId} paymentId={paymentId} note={rejectNote} action={actions.reject} />
      ) : null}
      {open === "record" ? (
        <RecordPanel
          id={panelId("record")}
          reservationId={reservationId}
          amount={recordDefault}
          confirms={can.recordConfirms}
          hasEmail={hasEmail}
          action={actions.record}
        />
      ) : null}
      {open === "cancel" ? (
        <CancelPanel id={panelId("cancel")} reservationId={reservationId} note={cancelNote} action={actions.cancel} />
      ) : null}
    </div>
  );
}

function ToggleButton({
  expanded,
  controls,
  onClick,
  danger,
  children,
}: {
  expanded: boolean;
  controls: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      variant={danger ? "danger" : "secondary"}
      aria-expanded={expanded}
      aria-controls={expanded ? controls : undefined}
      onClick={onClick}
      className="aria-expanded:bg-ivory-2"
    >
      {children}
    </Button>
  );
}

/**
 * Focus management for a form: the first field when it opens (onMount), and after a refusal the first field marked
 * invalid (else the first field), since the pending submit button gave up focus.
 */
function useFormFocus(state: ActionState, onMount = true) {
  const ref = useRef<HTMLFormElement>(null);
  // The state useActionState starts with: until an action answers, only the opening focus applies (and the check
  // survives React's development double-run of effects).
  const initial = useRef(state);
  useEffect(() => {
    if (state === initial.current && !onMount) return;
    const form = ref.current;
    if (!form) return;
    const target =
      (state.error ? form.querySelector<HTMLElement>('[aria-invalid="true"]') : null) ??
      form.querySelector<HTMLElement>("select, textarea, input:not([type=hidden])");
    target?.focus();
  }, [state, onMount]);
  return ref;
}

function PanelFrame({ id, danger, label, children }: { id: string; danger?: boolean; label: string; children: ReactNode }) {
  return (
    <div
      id={id}
      role="group"
      aria-label={label}
      className="flex flex-col gap-2 p-3.5"
      style={{ border: `1px solid ${danger ? "var(--color-bad)" : "var(--color-ink)"}` }}
    >
      {children}
    </div>
  );
}

function RejectPanel({
  id,
  reservationId,
  paymentId,
  note,
  action,
}: {
  id: string;
  reservationId: string;
  paymentId: string;
  note: string;
  action: ConsoleAction;
}) {
  const [state, formAction] = useActionState(action, EMPTY_STATE);
  const [reason, setReason] = useState("");
  const ref = useFormFocus(state);
  const err = state.fieldErrors?.reason ?? state.error;
  return (
    <PanelFrame id={id} danger label="Reject receipt">
      <form ref={ref} action={formAction} noValidate className="flex flex-col gap-2">
        <input type="hidden" name="reservationId" value={reservationId} />
        <input type="hidden" name="paymentId" value={paymentId} />
        <label htmlFor={`${id}-why`} className="text-[13px] font-medium">
          Reason shown to the guest
        </label>
        <textarea
          id={`${id}-why`}
          name="reason"
          required
          minLength={2}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-describedby={`${id}-note${err ? ` ${id}-err` : ""}`}
          aria-invalid={err ? true : undefined}
          className="min-h-[64px] w-full border border-taupe bg-paper px-3.5 py-2.5 font-sans text-[15px] text-ink"
        />
        <span id={`${id}-note`} className="text-[13px] text-ink-2">
          {note}
        </span>
        {err ? (
          <p id={`${id}-err`} role="alert" className="err m-0">
            {err}
          </p>
        ) : null}
        <SubmitButton variant="secondary" pendingText="Rejecting…" className="self-start">
          Reject and tell the guest
        </SubmitButton>
      </form>
    </PanelFrame>
  );
}

const METHOD_OPTIONS = (Object.keys(PAYMENT_METHOD_LABEL) as (keyof typeof PAYMENT_METHOD_LABEL)[]).map((k) => ({
  value: k,
  label: PAYMENT_METHOD_LABEL[k],
}));

function RecordPanel({
  id,
  reservationId,
  amount: initialAmount,
  confirms,
  hasEmail,
  action,
}: {
  id: string;
  reservationId: string;
  amount: number;
  confirms: boolean;
  hasEmail: boolean;
  action: ConsoleAction;
}) {
  const [state, formAction] = useActionState(action, EMPTY_STATE);
  const [method, setMethod] = useState("bank_transfer");
  const [amount, setAmount] = useState(initialAmount > 0 ? String(initialAmount) : "");
  const [reference, setReference] = useState("");
  const ref = useFormFocus(state);
  const fe = state.fieldErrors ?? {};
  const general = state.error && !fe.method && !fe.amount && !fe.bankReference ? state.error : null;
  return (
    <PanelFrame id={id} label="Record payment">
      <form ref={ref} action={formAction} noValidate className="flex flex-col gap-3">
        <input type="hidden" name="reservationId" value={reservationId} />
        <p className="m-0 text-[13px] text-ink-2">
          {confirms
            ? `For a transfer or cash the guest paid without uploading a receipt. Recording it confirms the stay${hasEmail ? " and emails the guest" : ""}.`
            : "Adds to the amount received. The stay is already confirmed, so no email is sent."}
        </p>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
          <Field
            as="select"
            label="Method"
            name="method"
            id={`${id}-method`}
            options={METHOD_OPTIONS}
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            error={fe.method}
          />
          <Field
            label="Amount, PKR"
            name="amount"
            id={`${id}-amount`}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={fe.amount}
          />
          <Field
            label="Reference"
            name="bankReference"
            id={`${id}-ref`}
            maxLength={100}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            hint="Optional: the bank or receipt reference."
            error={fe.bankReference}
          />
        </div>
        {general ? (
          <p role="alert" className="err m-0">
            {general}
          </p>
        ) : null}
        <SubmitButton variant={confirms ? "confirm" : "primary"} pendingText="Saving…" className="self-start">
          {confirms ? "Record and confirm" : "Record payment"}
        </SubmitButton>
      </form>
    </PanelFrame>
  );
}

function CancelPanel({ id, reservationId, note, action }: { id: string; reservationId: string; note: string; action: ConsoleAction }) {
  const [state, formAction] = useActionState(action, EMPTY_STATE);
  const [reason, setReason] = useState("");
  const ref = useFormFocus(state);
  const err = state.fieldErrors?.reason ?? state.error;
  return (
    <PanelFrame id={id} danger label="Cancel the reservation">
      <form ref={ref} action={formAction} noValidate className="flex flex-col gap-2">
        <input type="hidden" name="reservationId" value={reservationId} />
        <label htmlFor={`${id}-why`} className="text-[13px] font-medium">
          Reason for cancelling
        </label>
        <textarea
          id={`${id}-why`}
          name="reason"
          required
          minLength={2}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-describedby={`${id}-note${err ? ` ${id}-err` : ""}`}
          aria-invalid={err ? true : undefined}
          className="min-h-[64px] w-full border border-taupe bg-paper px-3.5 py-2.5 font-sans text-[15px] text-ink"
        />
        <span id={`${id}-note`} className="text-[13px] text-ink-2">
          {note}
        </span>
        {err ? (
          <p id={`${id}-err`} role="alert" className="err m-0">
            {err}
          </p>
        ) : null}
        <SubmitButton variant="danger" pendingText="Cancelling…" className="self-start" confirm="Cancel this reservation? This cannot be undone.">
          Cancel the reservation
        </SubmitButton>
      </form>
    </PanelFrame>
  );
}

/** "Add a note": a textarea visible to admins only, and "Save note". */
export function NoteForm({ reservationId, action }: { reservationId: string; action: ConsoleAction }) {
  const [state, formAction] = useActionState(action, EMPTY_STATE);
  const [text, setText] = useState("");
  const id = useId();
  const ref = useFormFocus(state, false);
  const err = state.fieldErrors?.text ?? state.error;
  return (
    <form ref={ref} action={formAction} noValidate className="flex flex-col gap-2">
      <input type="hidden" name="reservationId" value={reservationId} />
      <label htmlFor={`${id}-note`} className="sr-only">
        Note
      </label>
      <textarea
        id={`${id}-note`}
        name="text"
        maxLength={2000}
        placeholder="Visible to admins only"
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-describedby={err ? `${id}-err` : undefined}
        aria-invalid={err ? true : undefined}
        className="h-20 min-h-[80px] w-full border border-taupe bg-paper px-3.5 py-2.5 font-sans text-[15px] text-ink placeholder:text-ink-2"
      />
      {err ? (
        <p id={`${id}-err`} role="alert" className="err m-0">
          {err}
        </p>
      ) : null}
      <SubmitButton variant="secondary" pendingText="Saving…" className="self-start">
        Save note
      </SubmitButton>
    </form>
  );
}

/** "Move to another unit": the free units of the same type, or why there are none. */
export function MoveUnitForm({
  reservationId,
  units,
  emptyText,
  action,
}: {
  reservationId: string;
  units: { id: string; name: string }[];
  /** shown instead of the form when no unit can take the stay */
  emptyText: string | null;
  action: ConsoleAction;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, EMPTY_STATE);
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const id = useId();
  const formRef = useFormFocus(state);
  const err = state.fieldErrors?.unitId ?? state.error;
  return (
    <div className="mt-1.5 flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? `${id}-move` : undefined}
        onClick={() => setOpen((v) => !v)}
        className="-my-2.5 inline-flex min-h-[44px] cursor-pointer items-center self-start border-0 bg-transparent p-0 font-sans text-[15px] text-bronze underline underline-offset-2 hover:text-ink"
      >
        Move to another unit
      </button>
      {open ? (
        <div id={`${id}-move`}>
          {units.length === 0 ? (
            <p className="m-0 text-[14px] text-ink-2">{emptyText}</p>
          ) : (
            <form ref={formRef} action={formAction} noValidate className="flex flex-wrap items-end gap-2.5">
              <input type="hidden" name="reservationId" value={reservationId} />
              <Field
                as="select"
                label="Free unit of the same type"
                name="unitId"
                id={`${id}-unit`}
                options={units.map((u) => ({ value: u.id, label: u.name }))}
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                error={err}
                className="min-w-[200px] flex-[1_1_200px]"
              />
              <SubmitButton variant="secondary" pendingText="Moving…">
                Move
              </SubmitButton>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
